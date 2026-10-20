import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase, setReadHook } from './helpers/sqlite.mjs';

const { getDatabase } = await import('../src/database/database.ts');
const service = await import('../src/services/transaction.service.ts');
const { addTransaction, editTransaction, removeTransaction, listTransactions, transferBetweenAccounts } = service;
const { getMonthlyReport } = await import('../src/services/reports.service.ts');
const payload = (patch = {}) => ({ amount: 25, type: 'expense', accountId: 1, categoryId: null,
  description: 'Teste', merchant: null, date: '2026-10-15', paymentMethod: null, goalId: null,
  isAutomatic: false, source: 'manual', externalId: null, provider: null, institution: null, ...patch });
const editPayload = (patch = {}) => ({ amount: 25, type: 'expense', accountId: 1, categoryId: null, description: 'Editado', ...patch });
const balances = () => database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(r => r.balance);
const snapshot = () => ({ accounts: database.native.prepare('SELECT * FROM accounts ORDER BY id').all(),
  transactions: database.native.prepare('SELECT * FROM transactions ORDER BY id').all() });

before(async () => { await getDatabase(); });
after(closeDatabase);
beforeEach(() => {
  setReadHook(undefined);
  database.native.exec(`DROP TRIGGER IF EXISTS fail_write;
    DELETE FROM transactions; DELETE FROM monthly_budgets; DELETE FROM goals; DELETE FROM accounts; DELETE FROM user_settings;
    INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES
    (1, 'Banco', 'bank', 100, 'old', 'old'), (2, 'Carteira', 'cash', 50, 'old', 'old'),
    (3, 'Cartão', 'credit_card', 60, 'old', 'old');`);
});

for (const [accountId, type, afterCreate, afterEdit, original] of [
  [1, 'expense', 75, 60, 100], [1, 'income', 125, 140, 100],
  [3, 'expense', 85, 100, 60], [3, 'income', 35, 20, 60],
]) test(`create/edit/delete ${type} on account ${accountId} applies each effect once`, async () => {
  const id = await addTransaction(payload({ accountId, type }));
  assert.equal(balances()[accountId - 1], afterCreate);
  await editTransaction(id, editPayload({ accountId, type, amount: 40 }));
  assert.equal(balances()[accountId - 1], afterEdit);
  await removeTransaction(id);
  assert.equal(balances()[accountId - 1], original);
  assert.equal((await listTransactions()).length, 0);
});

test('editing an expense between bank and card reverses the original account first', async () => {
  const id = await addTransaction(payload());
  await editTransaction(id, editPayload({ accountId: 3, amount: 40 }));
  assert.deepEqual(balances(), [100, 50, 100]);
  await removeTransaction(id);
  assert.deepEqual(balances(), [100, 50, 60]);
});

test('changing a transaction from expense to income recomputes the same account', async () => {
  const id = await addTransaction(payload());
  await editTransaction(id, editPayload({ type: 'income', amount: 10 }));
  assert.deepEqual(balances(), [110, 50, 60]);
});

test('editing income after spending validates the final balance instead of an intermediate negative balance', async () => {
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 1');
  const id = await addTransaction(payload({ type: 'income', amount: 100 }));
  await addTransaction(payload({ amount: 80 }));
  await editTransaction(id, editPayload({ type: 'income', amount: 120 }));
  assert.equal(balances()[0], 40);
});

test('editing a paid card expense validates the final debt', async () => {
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 3');
  const id = await addTransaction(payload({ accountId: 3, amount: 100 }));
  await addTransaction(payload({ accountId: 3, type: 'income', amount: 80 }));
  await editTransaction(id, editPayload({ accountId: 3, amount: 120 }));
  assert.equal(balances()[2], 40);
});

test('deleting spent income cannot leave a negative bank balance', async () => {
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 1');
  const id = await addTransaction(payload({ type: 'income', amount: 100 }));
  await addTransaction(payload({ amount: 80 }));
  const before = snapshot();
  await assert.rejects(removeTransaction(id));
  assert.deepEqual(snapshot(), before);
});

test('deleting a paid card purchase cannot leave negative used debt', async () => {
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 3');
  const id = await addTransaction(payload({ accountId: 3, amount: 100 }));
  await addTransaction(payload({ accountId: 3, type: 'income', amount: 80 }));
  const before = snapshot();
  await assert.rejects(removeTransaction(id));
  assert.deepEqual(snapshot(), before);
});

for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: NaN }, { amount: Infinity },
  { amount: 101 }, { accountId: 999 }, { categoryId: 999 }, { accountId: 3, type: 'income', amount: 61 }]) {
  test(`invalid creation is atomic: ${JSON.stringify(patch)}`, async () => {
    const before = snapshot();
    await assert.rejects(addTransaction(payload(patch)));
    assert.deepEqual(snapshot(), before);
  });
}

test('invalid edit preserves the original transaction and both account balances', async () => {
  const id = await addTransaction(payload());
  const before = snapshot();
  await assert.rejects(editTransaction(id, editPayload({ accountId: 2, amount: 51 })));
  assert.deepEqual(snapshot(), before);
});

test('SQL failures roll back creation, cross-account editing and deletion', async () => {
  const id = await addTransaction(payload());
  const before = snapshot();
  database.native.exec(`CREATE TRIGGER fail_write BEFORE UPDATE ON accounts WHEN NEW.id = 2
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
  await assert.rejects(addTransaction(payload({ accountId: 2 })), /injected failure/);
  assert.deepEqual(snapshot(), before);
  await assert.rejects(editTransaction(id, editPayload({ accountId: 2 })), /injected failure/);
  assert.deepEqual(snapshot(), before);
  database.native.exec(`DROP TRIGGER fail_write;
    CREATE TRIGGER fail_write BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
  await assert.rejects(removeTransaction(id), /injected failure/);
  assert.deepEqual(snapshot(), before);
});

for (const operation of ['create', 'edit']) test(`${operation} rollback does not undo an unrelated write`, async () => {
  const id = operation === 'edit' ? await addTransaction(payload()) : null;
  let injected = false;
  setReadHook(async sql => {
    if (!injected && sql.includes('FROM accounts')) {
      injected = true;
      await database.runAsync("INSERT INTO user_settings (id, salary, created_at, updated_at) VALUES (1, 100, 'old', 'old')");
    }
  });
  try {
    if (operation === 'create') await assert.rejects(addTransaction(payload({ amount: 1000 })));
    else await assert.rejects(editTransaction(id, editPayload({ amount: 1000 })));
    assert.equal(database.native.prepare('SELECT salary FROM user_settings').get()?.salary, 100);
  } finally { setReadHook(undefined); }
});

test('linked card payment debits bank and debt once, stays out of totals, and reverses as a whole', async () => {
  assert.equal(typeof service.payCreditCard, 'function');
  await service.payCreditCard({ amount: 40, fromAccountId: 1, toAccountId: 3, description: null, date: '2026-10-15' });
  assert.deepEqual(balances(), [60, 50, 20]);
  const transactions = await listTransactions();
  assert.equal(transactions.length, 1);
  assert.ok(transactions[0].transferId);
  const report = await getMonthlyReport('2026-10');
  assert.equal(report.income, 0);
  assert.equal(report.expenses, 0);
  await assert.rejects(editTransaction(transactions[0].id, editPayload()));
  await removeTransaction(transactions[0].id);
  assert.deepEqual(balances(), [100, 50, 60]);
  assert.equal((await listTransactions()).length, 0);
});

test('card payment rejects insufficient bank balance, overpayment and incompatible accounts without partial writes', async () => {
  assert.equal(typeof service.payCreditCard, 'function');
  for (const patch of [{ amount: 61 }, { fromAccountId: 3 }, { toAccountId: 2 }, { toAccountId: 999 }]) {
    const before = snapshot();
    await assert.rejects(service.payCreditCard({ amount: 20, fromAccountId: 1, toAccountId: 3, description: null, ...patch }));
    assert.deepEqual(snapshot(), before);
  }
  database.native.exec('UPDATE accounts SET balance = 10 WHERE id = 1');
  const before = snapshot();
  await assert.rejects(service.payCreditCard({ amount: 20, fromAccountId: 1, toAccountId: 3, description: null }));
  assert.deepEqual(snapshot(), before);
});

test('ordinary account transfers still reject cards', async () => {
  const before = snapshot();
  await assert.rejects(transferBetweenAccounts({ amount: 10, fromAccountId: 1, toAccountId: 3, description: null }));
  assert.deepEqual(snapshot(), before);
});

test('successive cent-valued expenses and reversals keep exact account balances', async () => {
  database.native.exec('UPDATE accounts SET balance = 0.30 WHERE id = 1');
  const first = await addTransaction(payload({ amount: 0.1 }));
  const second = await addTransaction(payload({ amount: 0.2 }));
  assert.equal(balances()[0], 0);
  await removeTransaction(first);
  await removeTransaction(second);
  assert.equal(balances()[0], 0.3);
});

test('fractional cents cannot be saved as transactions with inconsistent balance effects', async () => {
  const before = snapshot();
  await assert.rejects(addTransaction(payload({ amount: 0.001 })));
  assert.deepEqual(snapshot(), before);
});

test('an imported card notification cannot be applied twice', async () => {
  const input = payload({ accountId: 3, externalId: 'card-purchase-1', provider: 'notification', institution: 'bank' });
  await addTransaction(input);
  const before = snapshot();
  await assert.rejects(addTransaction(input));
  assert.deepEqual(snapshot(), before);
  assert.equal(balances()[2], 85);
});

test('failure updating the card rolls back the linked payment and its bank debit', async () => {
  const before = snapshot();
  database.native.exec(`CREATE TRIGGER fail_write BEFORE UPDATE ON accounts WHEN NEW.id = 3
    BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
  await assert.rejects(service.payCreditCard({ amount: 20, fromAccountId: 1, toAccountId: 3, description: null }), /injected failure/);
  assert.deepEqual(snapshot(), before);
});

test('a payment can be reversed from its paying-account entry', async () => {
  await service.payCreditCard({ amount: 60, fromAccountId: 1, toAccountId: 3, description: null });
  assert.deepEqual(balances(), [40, 50, 0]);
  const outgoing = database.native.prepare("SELECT id FROM transactions WHERE type = 'expense'").get();
  await removeTransaction(outgoing.id);
  assert.deepEqual(balances(), [100, 50, 60]);
  assert.equal((await listTransactions()).length, 0);
});

test('paying a recorded card purchase does not count its expense twice', async () => {
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 3');
  await addTransaction(payload({ accountId: 3, amount: 25 }));
  assert.deepEqual(balances(), [100, 50, 25]);
  await service.payCreditCard({ amount: 25, fromAccountId: 1, toAccountId: 3, description: null, date: '2026-10-15' });
  assert.deepEqual(balances(), [75, 50, 0]);
  const report = await getMonthlyReport('2026-10');
  assert.equal(report.income, 0);
  assert.equal(report.expenses, 25);
  assert.equal(report.balance, -25);
});

test('failure during a payment reversal preserves both entries and both balances', async () => {
  await service.payCreditCard({ amount: 40, fromAccountId: 1, toAccountId: 3, description: null });
  const payment = (await listTransactions())[0];
  const before = snapshot();
  database.native.exec(`CREATE TRIGGER fail_write BEFORE UPDATE ON accounts WHEN NEW.id = 3
    BEGIN SELECT RAISE(ABORT, 'injected reversal failure'); END;`);
  await assert.rejects(removeTransaction(payment.id), /injected reversal failure/);
  assert.deepEqual(snapshot(), before);
});
