import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { database, closeDatabase } from './sqlite.mjs';

const { getDatabase } = await import('../../src/database/database.ts');
const { saveRecurringItem, listRecurringItems, getCashflowForecast } = await import('../../src/services/recurring.service.ts');
mock.timers.enable({ apis: ['Date'], now: new Date(2027, 0, 1, 12) });
try {
  await getDatabase();
  if (process.argv[2] === 'seed') {
    database.native.exec("INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES (1, 'Banco', 'bank', 100, 'old', 'old')");
    await saveRecurringItem({ title: 'Mensalidade', type: 'expense', amount: 10, categoryId: null, nextDueDate: '2027-01-31' });
  }
  for (let index = 0; index < 2; index++) {
    assert.equal((await listRecurringItems()).length, 1);
    assert.deepEqual(await getCashflowForecast(30), {
      currentBalance: 100, projectedBalance: 90, upcomingIncome: 0, upcomingExpenses: 10, horizonDays: 30,
    });
  }
  assert.equal(database.native.prepare('SELECT COUNT(*) AS total FROM recurring_items').get().total, 1);
  assert.equal(database.native.prepare('SELECT COUNT(*) AS total FROM transactions').get().total, 0);
  assert.equal(database.native.prepare('SELECT balance FROM accounts WHERE id = 1').get().balance, 100);
  assert.equal(database.native.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
} finally {
  mock.timers.reset();
  closeDatabase();
}
