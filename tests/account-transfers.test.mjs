import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase, setReadHook } from './helpers/sqlite.mjs';

const { getDatabase } = await import('../src/database/database.ts');
const { runMigrations } = await import('../src/database/migrations.ts');
const { createAccountTransfer, deleteTransaction, getAllTransactions, updateTransaction } =
  await import('../src/repositories/transaction.repository.ts');
const { getMonthlyReport } = await import('../src/services/reports.service.ts');
const { getFinancialInsights } = await import('../src/services/financial-insights.service.ts');
const { getDashboardSummary } = await import('../src/services/dashboard.service.ts');
const { listMonthlyBudgets } = await import('../src/services/budget.service.ts');
const transfer = (overrides = {}) => createAccountTransfer({
  amount: 25, fromAccountId: 1, toAccountId: 2, description: null,
  date: new Date().toISOString().slice(0, 10), ...overrides,
});
const balances = () => database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(r => r.balance);
const entries = () => database.native.prepare('SELECT * FROM transactions ORDER BY id').all();

before(async () => { await getDatabase(); });
after(closeDatabase);
beforeEach(() => {
  database.native.exec(`
    DROP TRIGGER IF EXISTS fail_transfer;
    DELETE FROM transactions; DELETE FROM monthly_budgets; DELETE FROM goals;
    DELETE FROM accounts; DELETE FROM user_settings;
    INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES
      (1, 'Origem', 'bank', 100, 'old', 'old'),
      (2, 'Destino', 'cash', 10, 'old', 'old'),
      (3, 'Cartão', 'credit_card', 20, 'old', 'old');
  `);
});

test('migration 9 upgrades v8 without changing existing transactions and can rerun', async () => {
  // Reconstruct the exact v8 shape while retaining its other tables and indexes.
  database.native.exec(`DROP INDEX idx_transactions_transfer; ALTER TABLE transactions DROP COLUMN transfer_id;
    PRAGMA user_version = 8;
    INSERT INTO transactions (id, amount, type, date, account_id, created_at, updated_at)
    VALUES (1, 12, 'expense', '2026-10-01', 1, 'old', 'old');`);
  await runMigrations(database);
  await runMigrations(database);
  assert.equal(database.native.prepare('PRAGMA user_version').get().user_version, 9);
  assert.equal(entries()[0].transfer_id, null);
  assert.equal(entries()[0].amount, 12);
  assert.ok(database.native.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_transactions_transfer'").get());
});

test('migration 9 failure rolls back its column and version together', async () => {
  database.native.exec('DROP INDEX idx_transactions_transfer; ALTER TABLE transactions DROP COLUMN transfer_id; PRAGMA user_version = 8;');
  const exec = database.execAsync;
  database.execAsync = async sql => {
    if (sql.includes('CREATE INDEX IF NOT EXISTS idx_transactions_transfer')) throw new Error('injected migration failure');
    return exec(sql);
  };
  try {
    await assert.rejects(runMigrations(database), /injected migration failure/);
    assert.equal(database.native.prepare('PRAGMA user_version').get().user_version, 8);
    assert.equal(database.native.prepare('PRAGMA table_info(transactions)').all().some(row => row.name === 'transfer_id'), false);
  } finally {
    database.execAsync = exec;
    await runMigrations(database);
  }
});

test('creates two linked entries conserving balances and shows one transfer', async () => {
  const id = await transfer();
  assert.deepEqual(balances(), [75, 35, 20]);
  assert.deepEqual(entries().map(r => [r.type, r.amount, r.transfer_id]), [['expense', 25, id], ['income', 25, id]]);
  const list = await getAllTransactions();
  assert.equal(list.length, 1);
  assert.equal(list[0].type, 'transfer');
});

test('a deduplicated transfer can be found by either account and account name', async () => {
  const { filterTransactions, emptyTransactionFilters } = await import('../src/types/transaction-filters.ts');
  await transfer();
  const list = await getAllTransactions();
  for (const accountId of [1, 2]) {
    assert.equal(filterTransactions(list, { ...emptyTransactionFilters, accountId }).length, 1);
  }
  assert.equal(filterTransactions(list, { ...emptyTransactionFilters, accountId: 3 }).length, 0);
  for (const search of ['Origem', 'Destino']) {
    assert.equal(filterTransactions(list, { ...emptyTransactionFilters, search }).length, 1);
  }
});

for (const entryIndex of [0, 1]) test(`reversing side ${entryIndex} restores both accounts and removes both entries`, async () => {
  await transfer();
  await deleteTransaction(entries()[entryIndex].id);
  assert.deepEqual(balances(), [100, 10, 20]);
  assert.equal(entries().length, 0);
});

test('transfers exact cents without floating-point insufficient balance or reversal drift', async () => {
  database.native.exec('UPDATE accounts SET balance = 0.30 WHERE id = 1; UPDATE accounts SET balance = 0 WHERE id = 2');
  await transfer({ amount: 0.1 });
  await transfer({ amount: 0.2 });
  assert.deepEqual(balances(), [0, 0.3, 20]);
  await deleteTransaction(entries()[2].id);
  await deleteTransaction(entries()[0].id);
  assert.deepEqual(balances(), [0.3, 0, 20]);
});

for (const invalid of [
  { fromAccountId: 1, toAccountId: 1 }, { fromAccountId: 999 }, { toAccountId: 3 },
  { fromAccountId: 3 }, { amount: 101 }, { amount: 0 }, { amount: NaN }, { amount: Infinity }, { amount: 0.001 },
]) test(`invalid transfer leaves all balances and entries unchanged: ${JSON.stringify(invalid)}`, async () => {
  await assert.rejects(transfer(invalid));
  assert.deepEqual(balances(), [100, 10, 20]);
  assert.equal(entries().length, 0);
});

test('failure after the source balance update rolls back entries and both balances', async () => {
  database.native.exec(`CREATE TRIGGER fail_transfer BEFORE UPDATE ON accounts WHEN NEW.id = 2
    BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;`);
  await assert.rejects(transfer(), /injected write failure/);
  assert.deepEqual(balances(), [100, 10, 20]);
  assert.equal(entries().length, 0);
});

test('failed reversal retains both entries and all balances', async () => {
  await transfer();
  database.native.exec('UPDATE accounts SET balance = 0 WHERE id = 2');
  await assert.rejects(deleteTransaction(entries()[0].id));
  assert.deepEqual(balances(), [75, 0, 20]);
  assert.equal(entries().length, 2);
});

test('a malformed pair is rejected rather than crediting two accounts', async () => {
  await transfer();
  database.native.exec("UPDATE transactions SET type = 'expense'");
  await assert.rejects(deleteTransaction(entries()[0].id));
  assert.deepEqual(balances(), [75, 35, 20]);
  assert.equal(entries().length, 2);
});

test('an unrelated write cannot be rolled back with a failed transfer', async () => {
  let injected = false;
  setReadHook(async sql => {
    if (!injected && sql.includes('SELECT id, balance, type FROM accounts')) {
      injected = true;
      await database.runAsync("INSERT INTO user_settings (id, salary, created_at, updated_at) VALUES (1, 100, 'old', 'old')");
    }
  });
  try {
    await assert.rejects(transfer({ amount: 101 }));
    assert.equal(database.native.prepare('SELECT salary FROM user_settings').get()?.salary, 100);
  } finally {
    setReadHook(undefined);
  }
});

test('linked entries cannot be edited independently', async () => {
  await transfer();
  await assert.rejects(updateTransaction(entries()[0].id, { amount: 1, type: 'expense', accountId: 1, categoryId: null, description: null }));
  assert.deepEqual(balances(), [75, 35, 20]);
});

test('a normal transaction cannot be converted into an unlinked transfer', async () => {
  database.native.exec("INSERT INTO transactions (id, amount, type, date, account_id, created_at, updated_at) VALUES (1, 10, 'expense', '2026-10-01', 1, 'old', 'old')");
  await assert.rejects(updateTransaction(1, { amount: 10, type: 'transfer', accountId: 1, categoryId: null, description: null }));
  assert.equal(entries()[0].type, 'expense');
  assert.deepEqual(balances(), [100, 10, 20]);
});

test('concurrent transfers never overspend or commit a partial pair', async () => {
  const results = await Promise.allSettled([transfer({ amount: 80 }), transfer({ amount: 80 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual(balances(), [20, 90, 20]);
  assert.equal(entries().length, 2);
});

test('an incomplete transfer is kept intact when reversal is requested', async () => {
  await transfer();
  database.native.prepare('DELETE FROM transactions WHERE id = ?').run(entries()[1].id);
  await assert.rejects(deleteTransaction(entries()[0].id));
  assert.deepEqual(balances(), [75, 35, 20]);
  assert.equal(entries().length, 1);
});

test('a SQL failure while deleting a pair rolls back the reversal', async () => {
  await transfer();
  database.native.exec(`CREATE TRIGGER fail_transfer BEFORE DELETE ON transactions
    BEGIN SELECT RAISE(ABORT, 'injected delete failure'); END;`);
  await assert.rejects(deleteTransaction(entries()[1].id), /injected delete failure/);
  assert.deepEqual(balances(), [75, 35, 20]);
  assert.equal(entries().length, 2);
});

test('ordinary transaction reversal still restores the account', async () => {
  database.native.exec("UPDATE accounts SET balance = 75 WHERE id = 1; INSERT INTO transactions (id, amount, type, date, account_id, created_at, updated_at) VALUES (1, 25, 'expense', '2026-10-01', 1, 'old', 'old')");
  await deleteTransaction(1);
  assert.deepEqual(balances(), [100, 10, 20]);
  assert.equal(entries().length, 0);
});

test('goal contribution reversal still restores the account and the goal', async () => {
  database.native.exec(`INSERT INTO goals (id, name, target_amount, current_amount, created_at, updated_at) VALUES (1, 'Reserva', 100, 25, 'old', 'old');
    UPDATE accounts SET balance = 75 WHERE id = 1;
    INSERT INTO transactions (id, amount, type, date, account_id, goal_id, created_at, updated_at) VALUES (1, 25, 'transfer', '2026-10-01', 1, 1, 'old', 'old');`);
  await deleteTransaction(1);
  assert.deepEqual(balances(), [100, 10, 20]);
  assert.equal(database.native.prepare('SELECT current_amount FROM goals WHERE id = 1').get().current_amount, 0);
  assert.equal(entries().length, 0);
});

test('transfer selection replaces hidden cards and keeps origin and destination distinct', async () => {
  const { selectTransferAccounts } = await import('../src/services/transfer-selection.ts');
  const accounts = [{ id: 1, type: 'credit_card' }, { id: 2, type: 'bank' }, { id: 3, type: 'cash' }];
  assert.deepEqual(selectTransferAccounts(accounts, 1, 2), { fromAccountId: 2, toAccountId: 3 });
  assert.deepEqual(selectTransferAccounts(accounts, 3, 3), { fromAccountId: 3, toAccountId: 2 });
  assert.deepEqual(selectTransferAccounts(accounts.slice(0, 2), 1, 2), { fromAccountId: 2, toAccountId: null });
  assert.deepEqual(selectTransferAccounts([], null, null), { fromAccountId: null, toAccountId: null });
});

test('reports, dashboard, budgets and insights exclude transfer income and expenses', async () => {
  const month = new Date().toISOString().slice(0, 7);
  database.native.exec("UPDATE accounts SET balance = 2000 WHERE id = 1; INSERT INTO user_settings (id, salary, created_at, updated_at) VALUES (1, 1000, 'old', 'old')");
  await transfer({ amount: 950 });
  const category = database.native.prepare('SELECT id FROM categories LIMIT 1').get().id;
  database.native.prepare(`INSERT INTO transactions (amount, type, date, category_id, account_id, created_at, updated_at)
    VALUES (100, 'income', date('now', 'localtime'), NULL, 1, 'old', 'old'),
    (25, 'expense', date('now', 'localtime'), ?, 1, 'old', 'old'),
    (50, 'income', date('now', 'localtime', 'start of month', '-1 month'), NULL, 1, 'old', 'old'),
    (10, 'expense', date('now', 'localtime', 'start of month', '-1 month'), ?, 1, 'old', 'old')`).run(category, category);
  const report = await getMonthlyReport(month);
  assert.equal(report.income, 100);
  assert.equal(report.expenses, 25);
  assert.equal(report.previousIncome, 50);
  assert.equal(report.previousExpenses, 10);
  assert.equal(report.transactionCount, 3);
  assert.equal(report.expensesByCategory.length, 1);
  assert.equal(report.expensesByCategory[0].total, 25);
  const dashboard = await getDashboardSummary();
  assert.equal(dashboard.totalIncome, 150);
  assert.equal(dashboard.totalExpenses, 35);
  assert.equal(dashboard.recentTransactions.filter(item => item.type === 'transfer').length, 1);
  const insights = await getFinancialInsights();
  assert.equal(insights[0].tone, 'positive');
  // A legacy categorized transfer must not inflate category spending either.
  database.native.prepare('UPDATE transactions SET category_id = ?').run(category);
  database.native.prepare("INSERT INTO monthly_budgets (category_id, month_key, amount, created_at, updated_at) VALUES (?, ?, 100, 'old', 'old')").run(category, month);
  assert.equal((await listMonthlyBudgets(month))[0].spent, 25);
});
