import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase } from './helpers/sqlite.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { getDatabase } = await import('../src/database/database.ts');
const service = await import('../src/services/transaction.service.ts');
const { deleteTransaction } = await import('../src/repositories/transaction.repository.ts');
const { runMigrations } = await import('../src/database/migrations.ts');
const event = '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222';
const input = (patch = {}) => ({ kind: 'expense', amountCents: 1234, accountId: 1,
  toAccountId: null, categoryId: 1, date: '2026-10-20', description: null, ...patch });
const entries = () => database.native.prepare('SELECT * FROM transactions ORDER BY id').all();
const balances = () => database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(r => r.balance);
before(async () => { await getDatabase(); });
after(closeDatabase);
beforeEach(() => {
  database.native.exec(`DROP TRIGGER IF EXISTS fail_receipt; DROP TRIGGER IF EXISTS fail_movement;
    DELETE FROM transactions; DELETE FROM notification_confirmation_receipts; DELETE FROM accounts;
    INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES
    (1,'A','bank',100,'old','old'),(2,'B','bank',10,'old','old');`);
});
test('migration 10 preserves v9 movements, reruns safely and rolls back on failure', async () => {
  database.native.exec('DROP TABLE notification_confirmation_receipts; PRAGMA user_version=9');
  const exec = database.execAsync;
  database.execAsync = async sql => { await exec(sql); if(sql.includes('CREATE TABLE IF NOT EXISTS notification_confirmation_receipts')) throw new Error('migration failure'); };
  try { await assert.rejects(runMigrations(database),/migration failure/); }
  finally { database.execAsync = exec; }
  assert.equal(database.native.prepare('PRAGMA user_version').get().user_version,9);
  assert.equal(database.native.prepare("SELECT name FROM sqlite_master WHERE name='notification_confirmation_receipts'").get(),undefined);
  await runMigrations(database); await runMigrations(database);
  assert.equal(database.native.prepare('PRAGMA user_version').get().user_version,10);
  assert.deepEqual(balances(),[100,10]);
});
test('receipt and expense are atomic, replayable and survive deletion', async () => {
  const receipt = await service.confirmNotificationFinancial(event, input());
  assert.equal(receipt.kind, 'expense');
  assert.equal(entries().length, 1);
  assert.equal(entries()[0].source, 'notification');
  assert.equal(entries()[0].is_automatic, 0);
  assert.equal(entries()[0].institution, null);
  assert.deepEqual(balances(), [87.66,10]);
  assert.deepEqual(await service.confirmNotificationFinancial(event, input()), receipt);
  await deleteTransaction(Number(receipt.reference));
  assert.deepEqual(await service.confirmNotificationFinancial(event, input()), receipt);
  assert.equal(entries().length, 0);
  assert.deepEqual(balances(), [100,10]);
});
test('income and internal transfer use existing movement paths', async () => {
  await service.confirmNotificationFinancial(event, input({ kind:'income' }));
  assert.deepEqual(balances(), [112.34,10]);
  const other = event.replace(/^1/, '3');
  const data = input({ kind:'internal_transfer', toAccountId:2, categoryId:null });
  const receipt = await service.confirmNotificationFinancial(other, data);
  assert.equal(receipt.reference, `notification-transfer-${other}`);
  assert.deepEqual(balances(), [100,22.34]);
  assert.equal(entries().filter(r => r.transfer_id === receipt.reference).length, 2);
  assert.deepEqual(await service.confirmNotificationFinancial(other, data), receipt);
  assert.equal(entries().length, 3);
});
test('failure writing receipt rolls back movements and balances', async () => {
  database.native.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON notification_confirmation_receipts BEGIN SELECT RAISE(ABORT,'injected'); END");
  await assert.rejects(service.confirmNotificationFinancial(event,input()), /injected/);
  assert.equal(entries().length,0); assert.deepEqual(balances(),[100,10]);
});
test('failure writing transfer second side rolls back the entire operation', async () => {
  database.native.exec("CREATE TRIGGER fail_movement BEFORE INSERT ON transactions WHEN NEW.type='income' BEGIN SELECT RAISE(ABORT,'injected'); END");
  await assert.rejects(service.confirmNotificationFinancial(event,input({kind:'internal_transfer',toAccountId:2,categoryId:null})), /injected/);
  assert.equal(entries().length,0); assert.deepEqual(balances(),[100,10]);
  assert.equal(database.native.prepare('SELECT count(*) n FROM notification_confirmation_receipts').get().n,0);
});
test('conflicting replay never overwrites a receipt or alters balances', async () => {
  const receipt = await service.confirmNotificationFinancial(event,input());
  await assert.rejects(service.confirmNotificationFinancial(event,input({amountCents:2000})), /conflito/i);
  assert.deepEqual({ ...await service.getNotificationFinancialReceipt(event) },receipt);
  assert.deepEqual(balances(),[87.66,10]);
});
test('concurrent confirmations across connections cannot create two movements', async () => {
  const attempts = await Promise.allSettled([service.confirmNotificationFinancial(event,input()),service.confirmNotificationFinancial(event,input())]);
  assert.ok(attempts.some(r=>r.status==='fulfilled'));
  assert.equal(entries().length,1);
  await service.confirmNotificationFinancial(event,input());
  assert.deepEqual(balances(),[87.66,10]);
});
test('ambiguous, missing, nonexistent and incompatible fields do not commit', async () => {
  for (const patch of [{kind:null},{amountCents:null},{amountCents:1.1},{accountId:null},{categoryId:null},
    {categoryId:999},{date:'2026-02-30'},{kind:'internal_transfer',toAccountId:1,categoryId:null}]) {
    await assert.rejects(service.confirmNotificationFinancial(event,input(patch)));
  }
  assert.equal(entries().length,0); assert.deepEqual(balances(),[100,10]);
});

test('income, expense and both transfer sides persist the exact chosen datetime and offset',async()=>{
  const date='2026-10-25T08:09:10.123-03:00';
  for(const [index,kind] of ['income','expense','internal_transfer'].entries()){
    const eventKey=event.replace(/^1/,String(index+4));
    const receipt=await service.confirmNotificationFinancial(eventKey,input({kind,date,
      toAccountId:kind==='internal_transfer'?2:null,categoryId:kind==='internal_transfer'?null:1}));
    assert.equal(JSON.parse(receipt.requestJson).date,date);
  }
  assert.equal(entries().length,4);assert.ok(entries().every(row=>row.date===date));
});

const anotherEvent = event.replace(/^1/, '9');
const occurred = '2026-10-20T10:00:00.000-03:00';
const receiptCount = () => database.native.prepare('SELECT count(*) n FROM notification_confirmation_receipts').get().n;
const manual = (patch = {}) => ({ amount: 12.34, type: 'expense', accountId: 1, date: occurred,
  description: 'Manually approved', merchant: null, categoryId: 1, paymentMethod: null, goalId: null,
  isAutomatic: false, source: 'manual', externalId: null, provider: null, institution: null, ...patch });

test('another bank or wallet event for the same approved payment blocks a second write despite descriptive differences', async () => {
  const first = await service.confirmNotificationFinancial(event, input({ date: occurred, description: 'Bank payment' }));
  await assert.rejects(service.confirmNotificationFinancial(anotherEvent,
    input({ date: '2026-10-20T13:01:00.000Z', description: 'Wallet purchase', categoryId: 2 })), /possível duplicidade.*revis/i);
  assert.equal(entries().length, 1);
  assert.equal(receiptCount(), 1);
  assert.equal(await service.getNotificationFinancialReceipt(anotherEvent), null);
  assert.deepEqual(balances(), [87.66, 10]);
  assert.deepEqual(await service.confirmNotificationFinancial(event, input({ date: occurred, description: 'Bank payment' })), first);
});

test('possible duplicate transfer never writes either side or reuses the other event receipt', async () => {
  const transfer = input({ kind: 'internal_transfer', toAccountId: 2, categoryId: null, date: occurred });
  await service.confirmNotificationFinancial(event, transfer);
  await assert.rejects(service.confirmNotificationFinancial(anotherEvent, { ...transfer, description: 'Wallet transfer' }), /possível duplicidade/i);
  assert.equal(entries().length, 2);
  assert.equal(receiptCount(), 1);
  assert.deepEqual(balances(), [87.66, 22.34]);
});

test('distinct event confirmations competing on separate connections serialize the duplicate decision', async () => {
  const approved = input({ date: occurred });
  const attempts = await Promise.allSettled([service.confirmNotificationFinancial(event, approved),
    service.confirmNotificationFinancial(anotherEvent, approved)]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(entries().length, 1);
  assert.equal(receiptCount(), 1);
  const blockedKey = attempts[0].status === 'rejected' ? event : anotherEvent;
  await assert.rejects(service.confirmNotificationFinancial(blockedKey, approved), /possível duplicidade/i);
  assert.deepEqual(balances(), [87.66, 10]);
});

test('different kind, account, cents or occurrence outside 120 seconds remains confirmable', async () => {
  database.native.exec('UPDATE accounts SET balance=100 WHERE id=2');
  await service.confirmNotificationFinancial(event, input({ date: occurred }));
  for (const [index, patch] of [
    { kind: 'income' }, // A refund is not a duplicate expense.
    { accountId: 2 },
    { amountCents: 1235 },
    { date: '2026-10-20T10:02:00.001-03:00' },
    { date: '2026-10-18T10:00:00.000-03:00' },
  ].entries()) {
    await service.confirmNotificationFinancial(event.replace(/^1/, String(index + 3)), input({ date: occurred, ...patch }));
  }
  assert.equal(entries().length, 6);
  assert.equal(receiptCount(), 6);
});

test('transfer destination is part of the duplicate comparison', async () => {
  database.native.exec("INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES(3,'C','bank',0,'old','old')");
  const approved = input({ kind: 'internal_transfer', toAccountId: 2, categoryId: null, date: occurred });
  await service.confirmNotificationFinancial(event, approved);
  await service.confirmNotificationFinancial(anotherEvent, { ...approved, toAccountId: 3 });
  assert.equal(entries().length, 4);
  assert.deepEqual(balances(), [75.32, 22.34, 12.34]);
});

test('window includes 120 seconds and compares instants across offsets and midnight', async () => {
  await service.confirmNotificationFinancial(event, input({ date: '2026-10-20T23:59:00.000-03:00' }));
  await assert.rejects(service.confirmNotificationFinancial(anotherEvent,
    input({ date: '2026-10-21T03:01:00.000Z' })), /possível duplicidade/i);
  assert.equal(entries().length, 1);
});

test('legacy date-only approvals require review on the same civil day, never use receipt creation time', async () => {
  await service.confirmNotificationFinancial(event, input());
  database.native.exec("UPDATE notification_confirmation_receipts SET created_at='2099-01-01T00:00:00Z'");
  await assert.rejects(service.confirmNotificationFinancial(anotherEvent, input({ date: occurred })), /possível duplicidade/i);
  await service.confirmNotificationFinancial(event.replace(/^1/, '8'), input({ date: '2026-10-21' }));
  assert.equal(entries().length, 2);
});

test('a rolled back approval leaves no candidate that blocks another event', async () => {
  database.native.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON notification_confirmation_receipts BEGIN SELECT RAISE(ABORT,'injected'); END");
  await assert.rejects(service.confirmNotificationFinancial(event, input({ date: occurred })), /injected/);
  database.native.exec('DROP TRIGGER fail_receipt');
  await service.confirmNotificationFinancial(anotherEvent, input({ date: occurred }));
  assert.equal(entries().length, 1);
  assert.equal(receiptCount(), 1);
  assert.deepEqual(balances(), [87.66, 10]);
});

test('malformed persisted receipt data fails closed without another financial write', async () => {
  await service.confirmNotificationFinancial(event, input({ date: occurred }));
  database.native.exec("UPDATE notification_confirmation_receipts SET request_json='{}'");
  await assert.rejects(service.confirmNotificationFinancial(anotherEvent, input({ date: occurred })), /comprovante.*inválid/i);
  assert.equal(entries().length, 1);
  assert.equal(receiptCount(), 1);
});

test('possible bank-wallet duplicate remains pending across process restart and reconciliation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wallet-duplicate-'));
  const worker = fileURLToPath(new URL('./helpers/notification-confirmation-worker.mjs', import.meta.url));
  try {
    for (const phase of ['duplicate-seed', 'duplicate-restart']) {
      const result = spawnSync(process.execPath, ['--experimental-strip-types', worker, phase, 'expense'], {
        env: { ...process.env, WALLET_TEST_DATABASE_PATH: join(directory, 'financial.db') }, encoding: 'utf8', timeout: 20000,
      });
      assert.equal(result.status, 0, result.stderr);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const kind of ['income', 'expense']) test(`a ${kind} already recorded manually blocks a matching notification without editing the manual record`, async () => {
  await service.addTransaction(manual({ type: kind }));
  const original = entries();
  const initialBalances = balances();
  await assert.rejects(service.confirmNotificationFinancial(event,
    input({ kind, date: '2026-10-20T13:02:00.000Z', description: 'Wallet', categoryId: 2 })), /possível duplicidade.*revis/i);
  assert.deepEqual(entries(), original);
  assert.deepEqual(balances(), initialBalances);
  assert.equal(receiptCount(), 0);
});

test('a real manual transfer blocks the same approved from-to pair without writing either notification side', async () => {
  await service.transferBetweenAccounts({ amount: 12.34, fromAccountId: 1, toAccountId: 2, description: null, date: occurred });
  const original = entries();
  await assert.rejects(service.confirmNotificationFinancial(event,
    input({ kind: 'internal_transfer', toAccountId: 2, categoryId: null, date: occurred })), /possível duplicidade.*revis/i);
  assert.deepEqual(entries(), original);
  assert.deepEqual(balances(), [87.66, 22.34]);
  assert.equal(receiptCount(), 0);
});

test('manual candidates with another kind, account, amount or date do not block a distinct notification', async () => {
  database.native.exec('UPDATE accounts SET balance=100 WHERE id=2');
  for (const patch of [{ type: 'income' }, { accountId: 2 }, { amount: 12.35 },
    { date: '2026-10-20T10:02:00.001-03:00' }, { date: '2026-10-19' }]) {
    await service.addTransaction(manual(patch));
  }
  await service.confirmNotificationFinancial(event, input({ date: occurred }));
  assert.equal(entries().length, 6);
  assert.equal(receiptCount(), 1);
});

test('manual day-only approvals block matching civil days cautiously without using created_at', async () => {
  await service.addTransaction(manual({ date: '2026-10-20' }));
  database.native.exec("UPDATE transactions SET created_at='2099-01-01T00:00:00Z'");
  await assert.rejects(service.confirmNotificationFinancial(event, input({ date: occurred })), /possível duplicidade/i);
  assert.equal(entries().length, 1);
  assert.equal(receiptCount(), 0);
});

test('a manual transfer to another destination is distinct from the requested transfer', async () => {
  database.native.exec("INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES(3,'C','bank',0,'old','old')");
  await service.transferBetweenAccounts({ amount: 12.34, fromAccountId: 1, toAccountId: 3, description: null, date: occurred });
  await service.confirmNotificationFinancial(event, input({ kind: 'internal_transfer', toAccountId: 2, categoryId: null, date: occurred }));
  assert.equal(entries().length, 4);
  assert.deepEqual(balances(), [75.32, 22.34, 12.34]);
});

test('manual linked transfer legs are not ordinary expense or income candidates', async () => {
  await service.transferBetweenAccounts({ amount: 12.34, fromAccountId: 1, toAccountId: 2, description: null, date: occurred });
  await service.confirmNotificationFinancial(event, input({ date: occurred }));
  await service.confirmNotificationFinancial(anotherEvent, input({ kind: 'income', accountId: 2, date: occurred }));
  assert.equal(entries().length, 4);
  assert.equal(receiptCount(), 2);
});

test('card payments and goal contributions are not manual internal-transfer candidates', async () => {
  database.native.exec("INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES(3,'Card','credit_card',100,'old','old')");
  await service.payCreditCard({ amount: 12.34, fromAccountId: 1, toAccountId: 3, description: null, date: occurred });
  database.native.exec("INSERT INTO goals(id,name,target_amount,current_amount,created_at,updated_at) VALUES(1,'Goal',100,0,'old','old')");
  await service.addTransaction(manual({ type: 'transfer', categoryId: null, goalId: 1 }));
  await service.confirmNotificationFinancial(event, input({ kind: 'internal_transfer', toAccountId: 2, categoryId: null, date: occurred }));
  assert.equal(entries().length, 5);
  assert.equal(receiptCount(), 1);
});

test('a manual duplicate remains pending after restart, without automatic confirmation or another write', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wallet-manual-duplicate-'));
  const worker = fileURLToPath(new URL('./helpers/notification-confirmation-worker.mjs', import.meta.url));
  try {
    for (const phase of ['manual-duplicate-seed', 'manual-duplicate-restart']) {
      const result = spawnSync(process.execPath, ['--experimental-strip-types', worker, phase, 'expense'], {
        env: { ...process.env, WALLET_TEST_DATABASE_PATH: join(directory, 'financial.db') }, encoding: 'utf8', timeout: 20000,
      });
      assert.equal(result.status, 0, result.stderr);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
