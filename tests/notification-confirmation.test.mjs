import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './notification-confirmation-data') return { url: new URL(specifier+'.ts',context.parentURL).href,shortCircuit:true };
  return next(specifier,context);
}});
const { createNotificationConfirmation } = await import('../src/services/notification-confirmation.service.ts');
const formData = await import('../src/services/notification-confirmation-data.ts');
const key='11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222';
const data={kind:'expense',amountCents:1234,accountId:1,toAccountId:null,categoryId:1,date:'2026-10-20',description:null};
test('draft never selects accounts, categories or internal transfer from banking text',()=>{
  const incoming=formData.createNotificationConfirmationDraft({direction:'incoming',amountCents:1234,date:'2026-10-20'});
  assert.equal(incoming.kind,'income');assert.equal(incoming.accountId,null);assert.equal(incoming.categoryId,null);
  assert.equal(formData.createNotificationConfirmationDraft({direction:'internal',amountCents:null,date:null}).kind,null);
  assert.equal(formData.createNotificationConfirmationDraft(null).amount,'');
  assert.equal(formData.parseNotificationAmount('12,34'),1234);
  for(const invalid of ['','0','1,001','1.234,56','-1','Infinity'])assert.throws(()=>formData.parseNotificationAmount(invalid));
});
function fixture() {
  let intent=null,receipt=null,writes=0,failFinancial=false,failFinish=false,discarded=false;
  const bridge={
    reserveNotificationReview:async()=>discarded||intent?null:{localId:'event',eventKey:key,leaseToken:'lease'},
    completeNotificationReview:async()=>true,
    getNotificationConfirmation:async()=>intent,
    beginNotificationConfirmation:async(id,token,requestJson)=>{ if(discarded)throw Error('discarded');
      if(intent&&intent.requestJson!==requestJson)throw Error('conflict');
      intent??={localId:id,eventKey:key,requestJson,reference:null};return {...intent}; },
    listPendingNotificationConfirmations:async()=>intent&&!intent.reference?[{localId:'event',eventKey:key}]:[],
    finishNotificationConfirmation:async(id,eventKey,requestJson,reference)=>{
      if(failFinish)throw Error('storage unavailable');
      assert.equal(receipt?.requestJson,requestJson);assert.equal(intent.eventKey,eventKey);
      intent.reference=reference;return true;},
  };
  const financial={
    getReceipt:async()=>receipt,
    confirm:async(eventKey,input)=>{writes++;if(failFinancial)throw Error('write failed');
      receipt??={eventKey,requestJson:JSON.stringify(input),kind:input.kind,reference:'123'};return receipt;},
  };
  return {bridge,financial,service:createNotificationConfirmation(bridge,financial),
    get intent(){return intent;}, get receipt(){return receipt;},get writes(){return writes;},
    failFinancial(value){failFinancial=value;},failFinish(value){failFinish=value;},discard(){discarded=true;}};
}
test('explicit confirmation creates intent before finance and finalizes after receipt',async()=>{
  const f=fixture();assert.equal(f.service.available,true);
  await f.service.confirm('event',data);assert.equal(f.writes,1);assert.ok(f.intent.reference);
  await f.service.confirm('event',data);assert.equal(f.writes,1);
});
test('double tap and changed data cannot create a second financial operation',async()=>{
  const f=fixture();const first=f.service.confirm('event',data);
  await assert.rejects(f.service.confirm('event',data));await first;
  await assert.rejects(f.service.confirm('event',{...data,amountCents:999}),/conflito/i);
  assert.equal(f.writes,1);
});
test('restart after finance commit reconciles only the queue, never writes finance',async()=>{
  const f=fixture();f.failFinish(true);
  await assert.rejects(f.service.confirm('event',data));assert.ok(f.receipt);assert.equal(f.intent.reference,null);
  f.failFinish(false);const restarted=createNotificationConfirmation(f.bridge,f.financial);
  assert.deepEqual(await restarted.reconcile(),{resolved:1,unresolved:0});assert.equal(f.writes,1);
});
test('failed finance retains intent and recovery waits for explicit retry',async()=>{
  const f=fixture();f.failFinancial(true);await assert.rejects(f.service.confirm('event',data));
  assert.ok(f.intent);assert.equal(f.receipt,null);
  assert.deepEqual(await createNotificationConfirmation(f.bridge,f.financial).reconcile(),{resolved:0,unresolved:1});
  assert.equal(f.writes,1);f.failFinancial(false);await f.service.retry('event');assert.equal(f.writes,2);
});
test('reconciliation read failures are errors, not an empty queue or permission to write',async()=>{
  const f=fixture();f.failFinancial(true);await assert.rejects(f.service.confirm('event',data));
  f.financial.getReceipt=async()=>{throw Error('read failed');};
  await assert.rejects(f.service.reconcile());assert.equal(f.writes,1);
});
test('discarded, invalid and unsupported events cannot start confirmation',async()=>{
  const f=fixture();f.discard();await assert.rejects(f.service.confirm('event',data));assert.equal(f.writes,0);
  const g=fixture();await assert.rejects(g.service.confirm('event',{...data,kind:null}));assert.equal(g.intent,null);
  assert.equal(createNotificationConfirmation(null,g.financial).available,false);
});
