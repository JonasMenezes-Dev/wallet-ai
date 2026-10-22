import assert from 'node:assert/strict';
import { database, closeDatabase } from './sqlite.mjs';

const phase = process.argv[2];
// The pre-migration schema intentionally omits structures introduced by versions 1–10.
if (phase === 'legacy-upgrade') {
  database.native.exec(`
    CREATE TABLE user_settings (id INTEGER PRIMARY KEY, salary REAL NOT NULL DEFAULT 0,
      benefit_amount REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      type TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, type TEXT NOT NULL,
      description TEXT, merchant TEXT, date TEXT NOT NULL, category_id INTEGER, account_id INTEGER,
      payment_method TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id), FOREIGN KEY(account_id) REFERENCES accounts(id));
    CREATE TABLE goals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0, deadline TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO accounts VALUES (1, 'Legado', 'bank', 75, 'old', 'old'), (2, 'Cartão legado', 'credit_card', -20, 'old', 'old');
    INSERT INTO categories VALUES (1, 'Categoria legada', 'old');
    INSERT INTO goals VALUES (1, 'Meta legada', 500, 15, NULL, 'old', 'old');
    INSERT INTO transactions VALUES (1, 25, 'expense', 'Compra legada', NULL, '2026-10-01', 1, 1, NULL, 'old', 'old');
  `);
}

const { addGoalWithdrawal, updateGoalMovement } = await import('../../src/repositories/goal.repository.ts');
const { getDatabase } = await import('../../src/database/database.ts');
const { createAccount, getAllAccounts } = await import('../../src/repositories/account.repository.ts');
const { createTransaction, createAccountTransfer, getAllTransactions, deleteTransaction } = await import('../../src/repositories/transaction.repository.ts');
const { createGoal, addGoalContribution, getAllGoals } = await import('../../src/repositories/goal.repository.ts');
const { saveMonthlyBudget, listMonthlyBudgets } = await import('../../src/services/budget.service.ts');

async function assertOriginal() {
  const accounts = await getAllAccounts();
  assert.deepEqual(accounts.map(a => [a.id, a.balance]), [[1, 949.75], [2, 30]]);
  const goals = await getAllGoals();
  assert.deepEqual(goals.map(g => [g.id, g.targetAmount, g.currentAmount, g.deadline]), [[1, 500, 20, '2027-01-01']]);
  const transactions = await getAllTransactions();
  assert.equal(transactions.length, 3);
  const expense = transactions.find(t => t.type === 'expense');
  assert.equal(expense.amount, 10.25);
  assert.equal(expense.accountId, 1);
  assert.equal(expense.description, 'Compra persistida');
  assert.equal(expense.date, '2026-10-15T12:34:56.000Z');
  assert.equal(transactions.filter(t => t.transferId).length, 1);
  const contribution = transactions.find(t => t.goalId === 1);
  assert.equal(contribution.amount, 20);
  assert.equal(contribution.accountId, 1);
  const budgets = await listMonthlyBudgets('2026-10');
  assert.equal(budgets.length, 1);
  assert.equal(budgets[0].amount, 200);
  assert.equal(budgets[0].spent, 10.25);
  assert.equal(budgets[0].categoryId, expense.categoryId);
  assert.ok(accounts.every(a => a.createdAt && a.updatedAt));
}

try {
  await getDatabase();
  if (phase === 'seed') {
    await createAccount({ name: 'Banco', type: 'bank', balance: 1000, limitAmount: null });
    await createAccount({ name: 'Dinheiro', type: 'cash', balance: 10, limitAmount: null });
    const categoryId = database.native.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
    await createTransaction({ amount: 10.25, type: 'expense', description: 'Compra persistida', merchant: null,
      date: '2026-10-15T12:34:56.000Z', categoryId, accountId: 1, paymentMethod: null, goalId: null,
      isAutomatic: false, source: 'manual', externalId: null, provider: null, institution: null });
    await createGoal({ name: 'Reserva', targetAmount: 500, currentAmount: 0, deadline: '2027-01-01' });
    await addGoalContribution(1, 1, 20);
    await createAccountTransfer({ amount: 20, fromAccountId: 1, toAccountId: 2, description: 'Transferência persistida', date: '2026-10-15' });
    await saveMonthlyBudget(categoryId, '2026-10', 200);
    await assertOriginal();
  } else if (phase === 'read-and-update') {
    await assertOriginal();
    const expense = (await getAllTransactions()).find(t => t.type === 'expense');
    await saveMonthlyBudget(expense.categoryId, '2026-10', 250);
    const transfer = (await getAllTransactions()).find(t => t.transferId);
    await deleteTransaction(transfer.id);
  } else if (phase === 'read-updated') {
    assert.deepEqual((await getAllAccounts()).map(a => a.balance), [969.75, 10]);
    assert.equal((await getAllTransactions()).length, 2);
    const budgets = await listMonthlyBudgets('2026-10');
    assert.equal(budgets.length, 1);
    assert.equal(budgets[0].amount, 250);
    assert.equal(budgets[0].spent, 10.25);
    assert.equal((await getAllGoals())[0].currentAmount, 20);
  } else if (phase === 'withdraw-and-edit') {
    await assertOriginal();
    await addGoalWithdrawal(1, 1, 5);
    const withdrawal = (await getAllTransactions()).find(t => t.goalMovement === 'withdrawal');
    await updateGoalMovement(withdrawal.id, 1, 10);
  } else if (phase === 'read-withdrawal') {
    assert.deepEqual((await getAllAccounts()).map(a => a.balance), [959.75, 30]);
    assert.equal((await getAllGoals())[0].currentAmount, 10);
    const withdrawal = (await getAllTransactions()).find(t => t.goalMovement === 'withdrawal');
    assert.equal(withdrawal.amount, 10);
    await deleteTransaction(withdrawal.id);
    await assertOriginal();
  } else if (phase === 'fail-contribution') {
    await assertOriginal();
    database.native.exec(`CREATE TRIGGER fail_contribution BEFORE INSERT ON transactions
      WHEN NEW.goal_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'injected contribution failure'); END;`);
    await assert.rejects(addGoalContribution(1, 1, 5), /injected contribution failure/);
    database.native.exec('DROP TRIGGER fail_contribution');
  } else if (phase === 'read-original') {
    await assertOriginal();
  } else if (phase === 'legacy-upgrade' || phase === 'read-legacy') {
    assert.deepEqual((await getAllAccounts()).map(a => [a.id, a.balance, a.limitAmount]).sort(), [[1, 75, null], [2, 20, null]]);
    const transactions = await getAllTransactions();
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].description, 'Compra legada');
    assert.equal(transactions[0].amount, 25);
    assert.equal(transactions[0].transferId, null);
    assert.equal(transactions[0].categoryName, 'Categoria legada');
    assert.equal((await getAllGoals())[0].currentAmount, 15);
    assert.deepEqual(await listMonthlyBudgets('2026-10'), []);
  } else {
    throw new Error(`Unknown phase: ${phase}`);
  }
  assert.equal(database.native.prepare('PRAGMA user_version').get().user_version, 12);
  assert.equal(database.native.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.deepEqual(database.native.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(database.native.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
} finally {
  closeDatabase();
}
