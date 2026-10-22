import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase } from './helpers/sqlite.mjs';
const { getDatabase } = await import('../src/database/database.ts');
const goals = await import('../src/repositories/goal.repository.ts');
const tx = await import('../src/repositories/transaction.repository.ts');
const { getDashboardSummary } = await import('../src/services/dashboard.service.ts');
const { getMonthlyReport } = await import('../src/services/reports.service.ts');
const { runMigrations } = await import('../src/database/migrations.ts');
const month = new Date().toLocaleDateString('sv-SE').slice(0, 7);
const rows = () => database.native.prepare('SELECT * FROM transactions ORDER BY id').all();
const state = () => [database.native.prepare('SELECT balance FROM accounts WHERE id=1').get().balance,
  database.native.prepare('SELECT current_amount FROM goals WHERE id=1').get().current_amount];
before(getDatabase);
after(closeDatabase);
beforeEach(() => database.native.exec(`DROP TRIGGER IF EXISTS fail_goal;
  DELETE FROM transactions; DELETE FROM goals; DELETE FROM accounts;
  INSERT INTO accounts (id,name,type,balance,created_at,updated_at) VALUES
  (1,'Banco','bank',100,'old','old'),(2,'Carteira','cash',0,'old','old'),(3,'Cartão','credit_card',0,'old','old');
  INSERT INTO goals (id,name,target_amount,current_amount,created_at,updated_at) VALUES (1,'Reserva',200,0,'old','old');`));

test('contribution reduces free money, preserves wealth and never creates income or consumption', async () => {
  await goals.addGoalContribution(1,1,40);
  assert.deepEqual(state(),[60,40]);
  const summary = await getDashboardSummary();
  assert.equal(summary.availableBalance,60);
  assert.equal(summary.reservedBalance,40);
  assert.equal(summary.totalBalance,100);
  assert.equal(summary.monthContributions,40);
  assert.equal(summary.monthIncome,0);
  assert.equal(summary.monthExpenses,0);
  const report = await getMonthlyReport(month);
  assert.equal(report.contributions,40);
  assert.equal(report.effectiveSavings,0);
});
test('partial and full withdrawal restore money without revenue', async () => {
  await goals.addGoalContribution(1,1,40);
  await goals.addGoalWithdrawal(1,1,15);
  assert.deepEqual(state(),[75,25]);
  await goals.addGoalWithdrawal(1,1,25);
  assert.deepEqual(state(),[100,0]);
  const report = await getMonthlyReport(month);
  assert.equal(report.income,0); assert.equal(report.expenses,0);
  assert.equal(report.contributions,40); assert.equal(report.withdrawals,40);
  assert.equal((await tx.getAllTransactions())[0].goalMovement,'withdrawal');
});
test('deleting a spent contribution is rejected without inventing money', async () => {
  await goals.addGoalContribution(1,1,40);
  const id=rows()[0].id;
  await goals.addGoalWithdrawal(1,1,30);
  await assert.rejects(tx.deleteTransaction(id));
  assert.deepEqual(state(),[90,10]); assert.equal(rows().length,2);
});
test('withdrawal deletion and contribution deletion exactly reverse balances', async () => {
  await goals.addGoalContribution(1,1,40);
  await goals.addGoalWithdrawal(1,1,15);
  await tx.deleteTransaction(rows()[1].id);
  assert.deepEqual(state(),[60,40]);
  await tx.deleteTransaction(rows()[0].id);
  assert.deepEqual(state(),[100,0]);
});
test('editing reserve movements recomputes both balances atomically', async () => {
  await goals.addGoalContribution(1,1,40);
  await goals.updateGoalMovement(rows()[0].id,1,50);
  assert.deepEqual(state(),[50,50]);
  await goals.addGoalWithdrawal(1,1,20);
  await goals.updateGoalMovement(rows()[1].id,1,10);
  assert.deepEqual(state(),[60,40]);
  await assert.rejects(goals.updateGoalMovement(rows()[0].id,1,5));
  assert.deepEqual(state(),[60,40]);
});
for (const amount of [0,-1,NaN,Infinity,0.001,101]) test(`invalid contribution is atomic: ${amount}`,async()=>{
  await assert.rejects(goals.addGoalContribution(1,1,amount));
  assert.deepEqual(state(),[100,0]); assert.equal(rows().length,0);
});
test('withdrawal cannot overspend reserves or use a card; failed write rolls back',async()=>{
  await goals.addGoalContribution(1,1,40);
  await assert.rejects(goals.addGoalWithdrawal(1,1,41));
  await assert.rejects(goals.addGoalWithdrawal(1,3,10));
  database.native.exec(`CREATE TRIGGER fail_goal BEFORE INSERT ON transactions BEGIN SELECT RAISE(ABORT,'injected'); END;`);
  await assert.rejects(goals.addGoalWithdrawal(1,1,10),/injected/);
  assert.deepEqual(state(),[60,40]); assert.equal(rows().length,1);
});
test('editing contribution and withdrawal across accounts conserves every cent',async()=>{
  await goals.addGoalContribution(1,1,40);
  const contribution=rows()[0].id;
  database.native.exec('UPDATE accounts SET balance=50 WHERE id=2');
  await goals.updateGoalMovement(contribution,2,30);
  assert.deepEqual(state(),[100,30]);
  assert.equal(database.native.prepare('SELECT balance FROM accounts WHERE id=2').get().balance,20);
  await goals.addGoalWithdrawal(1,2,10);
  await goals.updateGoalMovement(rows()[1].id,1,15);
  assert.deepEqual(state(),[115,15]);
  assert.equal(database.native.prepare('SELECT balance FROM accounts WHERE id=2').get().balance,20);
  await assert.rejects(goals.updateGoalMovement(contribution,3,20));
  assert.deepEqual(state(),[115,15]);
});
test('spent withdrawal cannot be deleted or moved away from its receiving account',async()=>{
  await goals.addGoalContribution(1,1,40);
  await goals.addGoalWithdrawal(1,2,20);
  const id=rows()[1].id;
  database.native.exec('UPDATE accounts SET balance=0 WHERE id=2');
  await assert.rejects(tx.deleteTransaction(id));
  await assert.rejects(goals.updateGoalMovement(id,1,20));
  assert.deepEqual(state(),[60,20]); assert.equal(rows().length,2);
});
test('concurrent contributions and withdrawals cannot overspend either side',async()=>{
  const deposits=await Promise.allSettled([goals.addGoalContribution(1,1,80),goals.addGoalContribution(1,1,80)]);
  assert.equal(deposits.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual(state(),[20,80]);
  const withdrawals=await Promise.allSettled([goals.addGoalWithdrawal(1,1,60),goals.addGoalWithdrawal(1,1,60)]);
  assert.equal(withdrawals.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual(state(),[80,20]);
});
test('v10 upgrade preserves legacy contribution and confirmed bank transaction byte for byte',async()=>{
  await goals.addGoalContribution(1,1,20);
  database.native.exec(`INSERT INTO transactions (amount,type,date,account_id,source,external_id,provider,created_at,updated_at)
    VALUES (10,'income',date('now','localtime'),1,'notification','legacy-key','wallet-notification-listener','old','old');`);
  const beforeRows=rows().map(({goal_movement,...rest})=>rest);
  database.native.exec('ALTER TABLE transactions DROP COLUMN goal_movement; PRAGMA user_version=10;');
  await runMigrations(database); await runMigrations(database);
  assert.deepEqual(rows().map(({goal_movement,...rest})=>rest),beforeRows);
  assert.deepEqual(state(),[80,20]);
  const report=await getMonthlyReport(month);
  assert.equal(report.income,10); assert.equal(report.contributions,20);
});
test('confirmed legacy transactions and transfers remain ordinary editable financial records',async()=>{
  const input={ amount:20,type:'income',accountId:1,goalId:null,date:new Date().toISOString(),
    categoryId:null,description:'Legado',merchant:null,paymentMethod:null,isAutomatic:false,
    source:'notification',externalId:'legacy-income',provider:'old-provider',institution:null };
  const id=await tx.createTransaction(input);
  await tx.updateTransaction(id,{amount:30,type:'income',accountId:1,categoryId:null,description:'Editado'});
  assert.deepEqual(state(),[130,0]);
  const reference=await tx.createAccountTransfer({amount:10,fromAccountId:1,toAccountId:2,date:input.date});
  database.native.prepare("UPDATE transactions SET source='notification' WHERE transfer_id=?").run(reference);
  const report=await getMonthlyReport(month);
  assert.equal(report.income,30); assert.equal(report.expenses,0);
  await tx.deleteTransaction(rows().find(r=>r.transfer_id===reference).id);
  await tx.deleteTransaction(id);
  assert.deepEqual(state(),[100,0]); assert.equal(rows().length,0);
});
test('failed v11 migration rolls back its schema and version without touching financial history',async()=>{
  await goals.addGoalContribution(1,1,20);
  database.native.exec('ALTER TABLE transactions DROP COLUMN goal_movement; PRAGMA user_version=10;');
  const execute=database.execAsync;
  database.execAsync=async sql=>{
    if (sql.includes('PRAGMA user_version = 11')) throw new Error('injected version failure');
    return execute(sql);
  };
  try {
    await assert.rejects(runMigrations(database),/injected version failure/);
    assert.equal(database.native.prepare('PRAGMA user_version').get().user_version,10);
    assert.equal(database.native.prepare('PRAGMA table_info(transactions)').all().some(r=>r.name==='goal_movement'),false);
    assert.deepEqual(state(),[80,20]); assert.equal(rows().length,1);
  } finally {
    database.execAsync=execute;
    await runMigrations(database);
  }
});
