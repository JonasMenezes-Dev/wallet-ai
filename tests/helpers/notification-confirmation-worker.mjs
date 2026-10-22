import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { database, closeDatabase } from './sqlite.mjs';
const { getDatabase } = await import('../../src/database/database.ts');
const financial = await import('../../src/services/transaction.service.ts');
const { createNotificationConfirmation } = await import('../../src/services/notification-confirmation.service.ts');
const sql = JSON.parse(readFileSync(new URL('../../modules/notification-listener/android/src/main/assets/notification-inbox-v1.json',import.meta.url)));
const native = new DatabaseSync(process.env.WALLET_TEST_DATABASE_PATH+'.inbox');
native.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL');
for(const statement of [...sql.schema,...sql.confirmationSchema])native.exec(statement);
const id='22222222-2222-4222-8222-222222222222';
const key='11111111-1111-4111-8111-111111111111:'+id;
const now=Date.now();
const run=(name,...args)=>Number(native.prepare(sql[name]).run(...args).changes);
const transaction=work=>{native.exec('BEGIN IMMEDIATE');try{const value=work();native.exec('COMMIT');return value;}catch(e){native.exec('ROLLBACK');throw e;}};
// The Android/Keystore boundary is replaced; the native SQL and financial services are real.
// All inputs are fictional. The approved intent is ciphertext even in these process tests.
const testKey=Buffer.alloc(32,7);
function encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',testKey,iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);}
function decrypt(value){const b=Buffer.from(value),cipher=createDecipheriv('aes-256-gcm',testKey,b.subarray(0,12));cipher.setAuthTag(b.subarray(-16));return Buffer.concat([cipher.update(b.subarray(12,-16)),cipher.final()]).toString();}
const intent=()=>{const row=native.prepare(sql.confirmationById).get(id);return row?{localId:id,eventKey:row.event_key,requestJson:decrypt(row.request_cipher),reference:row.reference}:null;};
const phase=process.argv[2];
const kind=process.argv[3];
const input={kind,amountCents:1234,accountId:1,toAccountId:kind==='internal_transfer'?2:null,
  categoryId:kind==='internal_transfer'?null:1,date:'2026-10-20',description:null};
const bridge={
  getNotificationConfirmation:async()=>intent(),
  reserveNotificationReview:async()=>run('reviewReserve','lease',now+10000,now,id,now,now)?{localId:id,eventKey:key,leaseToken:'lease'}:null,
  completeNotificationReview:async()=>Boolean(run('reviewFail',now,id,'lease',now,now)),
  beginNotificationConfirmation:async(localId,token,requestJson)=>transaction(()=>{
    assert.equal(run('confirmationBegin',localId,key,encrypt(requestJson),now,localId,token,now,now),1);
    run('confirmationDetachLease',localId);return intent();}),
  listPendingNotificationConfirmations:async()=>native.prepare(sql.confirmationPending).all().map(row=>({localId:row.local_id,eventKey:row.event_key})),
  finishNotificationConfirmation:async(localId,eventKey,requestJson,reference)=>{
    if(phase==='crash-after-commit')process.exit(23);
    return transaction(()=>{const saved=intent();assert.equal(saved.eventKey,eventKey);assert.equal(saved.requestJson,requestJson);
      if(saved.reference!==null){assert.equal(saved.reference,reference);return true;}
      assert.equal(run('confirmationFinish',reference,now,localId),1);assert.equal(run('confirmationAcknowledge',reference,localId),1);return true;});},
};
await getDatabase();
const service=createNotificationConfirmation(bridge,{getReceipt:financial.getNotificationFinancialReceipt,
  confirm:phase==='reconcile'||phase==='reconcile-empty'?async()=>{throw Error('Recovery must not write');}:financial.confirmNotificationFinancial});
try{
  if(['duplicate-seed','duplicate-restart','manual-duplicate-seed','manual-duplicate-restart'].includes(phase)){
    const isManual=phase.startsWith('manual-');
    if(phase.endsWith('-seed')){
      database.native.exec("INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES (1,'A','bank',100,'old','old'),(2,'B','bank',10,'old','old')");
      if(isManual)await financial.addTransaction({amount:12.34,type:'expense',accountId:1,date:input.date,
        description:null,merchant:null,categoryId:1,paymentMethod:null,goalId:null,isAutomatic:false,
        source:'manual',externalId:null,provider:null,institution:null});
      else await financial.confirmNotificationFinancial(key.replace(/^1/,'3'),input);
      run('insert',id,'com.walletai.notificationfixture',now,now,'identity','fingerprint',Buffer.from('identity'),Buffer.from('raw'),null,now+86400000,now+30*86400000,now);
      await assert.rejects(service.confirm(id,input),/possível duplicidade.*revis/i);
    }else{
      assert.deepEqual(await service.reconcile(),{resolved:0,unresolved:1});
      await assert.rejects(service.retry(id),/possível duplicidade.*revis/i);
    }
    assert.equal(intent().reference,null);
    assert.ok(['received','pending','error'].includes(native.prepare(sql.byId).get(id).state));
    assert.equal(database.native.prepare('SELECT count(*) n FROM transactions').get().n,1);
    assert.equal(database.native.prepare('SELECT count(*) n FROM notification_confirmation_receipts').get().n,isManual?0:1);
    assert.deepEqual(database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(row=>row.balance),[87.66,10]);
    assert.equal(await financial.getNotificationFinancialReceipt(key),null);
  }else if(phase==='crash-after-commit'||phase==='fail-before-commit'){
    database.native.exec("INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES (1,'A','bank',100,'old','old'),(2,'B','bank',10,'old','old')");
    run('insert',id,'com.walletai.notificationfixture',now,now,'identity','fingerprint',Buffer.from('identity'),Buffer.from('raw'),null,now+86400000,now+30*86400000,now);
    if(phase==='fail-before-commit'){
      database.native.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON notification_confirmation_receipts BEGIN SELECT RAISE(ABORT,'failed receipt'); END");
      await assert.rejects(service.confirm(id,input),/failed receipt/);
      assert.equal(database.native.prepare('SELECT count(*) n FROM transactions').get().n,0);
      database.native.exec('DROP TRIGGER fail_receipt');
    }else await service.confirm(id,input);
  }else if(phase==='reconcile-empty'){
    assert.deepEqual(await service.reconcile(),{resolved:0,unresolved:1});
    assert.equal(database.native.prepare('SELECT count(*) n FROM transactions').get().n,0);
    assert.equal(intent().reference,null);
  }else{
    if(phase==='reconcile')assert.deepEqual(await service.reconcile(),{resolved:1,unresolved:0});
    else await service.retry(id);
    assert.equal(native.prepare(sql.byId).get(id).state,'confirmed');
    assert.equal(database.native.prepare('SELECT count(*) n FROM transactions').get().n,kind==='internal_transfer'?2:1);
    const actual=database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(row=>row.balance);
    assert.deepEqual(actual,kind==='income'?[112.34,10]:kind==='internal_transfer'?[87.66,22.34]:[87.66,10]);
    assert.equal(database.native.prepare('SELECT count(*) n FROM notification_confirmation_receipts').get().n,1);
  }
}finally{native.close();closeDatabase();}
