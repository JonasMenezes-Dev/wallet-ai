import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationConfirmationDraft, notificationConfirmationDateTime, normalizeNotificationConfirmation } from '../src/services/notification-confirmation-data.ts';

test('captured instant initializes local date and time, including midnight rollover and milliseconds', () => {
  const previous = process.env.TZ; process.env.TZ = 'America/Sao_Paulo';
  try {
    const stamp = Date.parse('2026-10-21T01:23:45.678Z');
    const draft = createNotificationConfirmationDraft({date:'1999-01-01'}, stamp);
    assert.equal(draft.date,'2026-10-20'); assert.equal(draft.time,'22:23:45.678');
    const saved = notificationConfirmationDateTime(draft.date,draft.time,stamp);
    assert.equal(saved,'2026-10-20T22:23:45.678-03:00');
    assert.equal(Date.parse(saved),stamp);
    assert.equal(notificationConfirmationDateTime('2026-10-22','09:10',stamp),'2026-10-22T09:10:00.000-03:00');
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
test('missing or invalid timestamps require manual fields instead of using now or interpreted date', () => {
  for(const stamp of [undefined,null,NaN,Infinity,-1,8.64e15+1,'2026-10-20']) {
    const draft=createNotificationConfirmationDraft({date:'2026-10-20'},stamp);
    assert.equal(draft.date,''); assert.equal(draft.time,'');
  }
  for(const [date,time] of [['',''],['2026-02-30','12:00'],['2026-10-20','24:00'],['2026-10-20','12:60'],['2026-10-20','']]) {
    assert.throws(()=>notificationConfirmationDateTime(date,time));
  }
});
test('local DST gap is rejected and original repeated-hour instant is preserved',()=>{
  const previous=process.env.TZ;process.env.TZ='America/New_York';
  try{
    assert.throws(()=>notificationConfirmationDateTime('2026-03-08','02:30'));
    const stamp=Date.parse('2026-11-01T06:30:00Z');
    const draft=createNotificationConfirmationDraft(null,stamp);
    assert.equal(Date.parse(notificationConfirmationDateTime(draft.date,draft.time,stamp)),stamp);
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('normalization accepts exact offset datetime and preserves legacy approved date-only requests',()=>{
  const base={kind:'income',amountCents:100,accountId:1,toAccountId:null,categoryId:1,description:null};
  for(const date of ['2026-10-20','2026-10-20T22:23:45.678-03:00','2026-10-20T09:10:00.000+05:30']) {
    assert.equal(normalizeNotificationConfirmation({...base,date}).date,date);
  }
  for(const date of ['2026-02-30T10:00:00.000-03:00','2026-10-20T24:00:00.000-03:00','2026-10-20T10:00:00.000+25:00']) {
    assert.throws(()=>normalizeNotificationConfirmation({...base,date}));
  }
});
