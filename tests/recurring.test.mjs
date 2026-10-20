import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { database, closeDatabase } from './helpers/sqlite.mjs';

const { getDatabase } = await import('../src/database/database.ts');
const { saveRecurringItem, listRecurringItems, advanceRecurringItem, deleteRecurringItem, getCashflowForecast } =
  await import('../src/services/recurring.service.ts');
const payload = (patch = {}) => ({ title: 'Mensalidade', type: 'expense', amount: 10,
  categoryId: null, nextDueDate: '2027-01-31', ...patch });
const freeze = (t, year, month, day) => t.mock.timers.enable({ apis: ['Date'], now: new Date(year, month - 1, day, 12) });
const row = () => database.native.prepare('SELECT * FROM recurring_items ORDER BY id LIMIT 1').get();
const actualState = () => ({
  accounts: database.native.prepare('SELECT * FROM accounts ORDER BY id').all(),
  transactions: database.native.prepare('SELECT * FROM transactions ORDER BY id').all(),
});

before(async () => { await getDatabase(); });
after(closeDatabase);
beforeEach(() => {
  database.native.exec(`DELETE FROM recurring_items; DELETE FROM transactions; DELETE FROM monthly_budgets;
    DELETE FROM goals; DELETE FROM accounts;
    INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES
    (1, 'Banco', 'bank', 100, 'old', 'old'), (2, 'Cartão', 'credit_card', 20, 'old', 'old');`);
});

for (const [year, february, horizon] of [[2027, '2027-02-28', 150], [2028, '2028-02-29', 151]]) {
  test(`monthly recurrence preserves day 31 through February, April and May in ${year}`, async t => {
    freeze(t, year, 1, 1);
    await saveRecurringItem(payload({ nextDueDate: `${year}-01-31` }));
    const id = row().id;
    for (const expected of [february, `${year}-03-31`, `${year}-04-30`, `${year}-05-31`]) {
      await advanceRecurringItem(id);
      assert.equal(row().next_due_date, expected);
      assert.equal(row().due_day, 31);
    }
    assert.equal(actualState().transactions.length, 0);
  });

  test(`forecast counts 28/29/30/31-day months without writing actual transactions in ${year}`, async t => {
    freeze(t, year, 1, 1);
    await saveRecurringItem(payload({ nextDueDate: `${year}-01-31` }));
    await saveRecurringItem(payload({ title: 'Receita', type: 'income', amount: 20, nextDueDate: `${year}-01-31` }));
    const before = actualState();
    assert.deepEqual(await getCashflowForecast(horizon), {
      currentBalance: 80, projectedBalance: 130, upcomingIncome: 100, upcomingExpenses: 50, horizonDays: horizon,
    });
    assert.deepEqual(actualState(), before);
    assert.equal((await listRecurringItems())[0].nextDueDate, `${year}-01-31`);
  });
}

test('forecast includes today and the final horizon day, excluding later dates', async t => {
  freeze(t, 2027, 1, 1);
  await saveRecurringItem(payload({ nextDueDate: '2027-01-01' }));
  await saveRecurringItem(payload({ title: 'Fim', amount: 20, nextDueDate: '2027-01-31' }));
  assert.equal((await getCashflowForecast(0)).upcomingExpenses, 10);
  assert.equal((await getCashflowForecast(29)).upcomingExpenses, 10);
  assert.equal((await getCashflowForecast(30)).upcomingExpenses, 30);
});

test('overdue recurrence contributes one pending amount today without generating transactions', async t => {
  freeze(t, 2027, 5, 15);
  await saveRecurringItem(payload());
  assert.equal((await getCashflowForecast(0)).upcomingExpenses, 10);
  await advanceRecurringItem(row().id);
  assert.equal(row().next_due_date, '2027-05-31');
  assert.equal(actualState().transactions.length, 0);
});

test('editing changes the forecast in place and changing the date sets a new monthly day', async t => {
  freeze(t, 2027, 1, 1);
  await saveRecurringItem(payload());
  const id = row().id;
  await saveRecurringItem(payload({ id, title: 'Salário', type: 'income', amount: 35, nextDueDate: '2027-01-30' }));
  assert.equal((await listRecurringItems()).length, 1);
  assert.equal(row().id, id);
  assert.equal(row().due_day, 30);
  assert.deepEqual(await getCashflowForecast(30), {
    currentBalance: 80, projectedBalance: 115, upcomingIncome: 35, upcomingExpenses: 0, horizonDays: 30,
  });
  assert.equal(actualState().transactions.length, 0);
});

for (const [start, clamped, following] of [
  ['2027-01-31', '2027-02-28', '2027-03-31'],
  ['2028-01-31', '2028-02-29', '2028-03-31'],
  ['2027-03-31', '2027-04-30', '2027-05-31'],
]) test(`editing the amount after clamping to ${clamped} preserves the original monthly day`, async t => {
  freeze(t, 2027, 1, 1);
  await saveRecurringItem(payload({ nextDueDate: start }));
  const id = row().id;
  await advanceRecurringItem(id);
  assert.equal(row().next_due_date, clamped);
  await saveRecurringItem(payload({ id, amount: 25, nextDueDate: clamped }));
  assert.equal(row().due_day, 31);
  await advanceRecurringItem(id);
  assert.equal(row().next_due_date, following);
});

test('deletion cancels future forecasts and prevents editing or advancing an inactive item', async t => {
  freeze(t, 2027, 1, 1);
  await saveRecurringItem(payload());
  const id = row().id;
  const before = actualState();
  await deleteRecurringItem(id);
  assert.equal(row().is_active, 0);
  assert.deepEqual(await listRecurringItems(), []);
  assert.equal((await getCashflowForecast(365)).projectedBalance, 80);
  await assert.rejects(saveRecurringItem(payload({ id })));
  await assert.rejects(advanceRecurringItem(id));
  await assert.rejects(deleteRecurringItem(id));
  assert.deepEqual(actualState(), before);
});

test('invalid calendar dates are rejected and leap-day recurrence is accepted', async () => {
  for (const date of ['2027-02-29', '2028-02-30', '2027-04-31', '2027-13-01']) {
    await assert.rejects(saveRecurringItem(payload({ nextDueDate: date })));
  }
  assert.equal((await listRecurringItems()).length, 0);
  await saveRecurringItem(payload({ nextDueDate: '2028-02-29' }));
  assert.equal(row().due_day, 29);
});

test('reopening the app and reading forecasts repeatedly cannot duplicate recurring or actual entries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wallet-recurring-'));
  try {
    for (const phase of ['seed', 'reopen', 'reopen']) {
      const result = spawnSync(process.execPath, [
        '--experimental-strip-types', fileURLToPath(new URL('./helpers/recurring-worker.mjs', import.meta.url)), phase,
      ], { env: { ...process.env, WALLET_TEST_DATABASE_PATH: join(directory, 'wallet.db') }, encoding: 'utf8', timeout: 15000 });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${phase}: ${result.stderr}\n${result.stdout}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
