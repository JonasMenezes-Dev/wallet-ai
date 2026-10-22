import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test, beforeEach, afterEach } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Execute the SAME SQL asset used by SQLiteOpenHelper, not a second implementation.
// These tests validate SQL contracts; they do not execute Android/Kotlin or Keystore.
const sql = JSON.parse(readFileSync(new URL('../modules/notification-listener/android/src/main/assets/notification-inbox-v1.json', import.meta.url), 'utf8'));
const NOW = 1_800_000_000_000;
const DAY = 86400000;
let db;
let directory;
const migrate = () => [...sql.schema, ...(sql.confirmationSchema ?? [])].forEach(statement => db.exec(statement));
const get = id => db.prepare(sql.byId).get(id);
const run = (name, ...args) => db.prepare(sql[name]).run(...args).changes;
function insert(id, identity = `stable-${id}`, fingerprint = 'same-content-fingerprint', received = NOW) {
  // Opaque ciphertext fixtures only. Cryptography itself needs Android validation.
  return run('insert', id, 'com.ficticio.bank', NOW - 1000, received, identity, fingerprint,
    Buffer.from('identity-cipher'), Buffer.from('raw-cipher'), Buffer.from('structured-cipher'),
    received + DAY, received + 30 * DAY, received);
}
const claim = (token = 'worker-1', now = NOW, state = 'received') => run('claim', token, now + 1000, now, state, now, now);
function update(id, expected, next, token = null, now = NOW, receipt = null, retry = null) {
  return run('update', next, null, next === 'error' ? 'processing_failed' : null, retry, receipt,
    next, now, id, expected, now, token, token, now);
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'wallet-native-inbox-'));
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  db.exec('PRAGMA journal_mode = WAL');
  migrate();
});
afterEach(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });

const reserveReview = (id, token, now = NOW) => run('reviewReserve', token, now + 1000, now, id, now, now);
const finishReview = (id, token, now = NOW) => run('reviewFinish', Buffer.from('review-cipher'), now, id, token, now, now);
const discardReview = (id, token, now = NOW) => run('reviewDiscard', now, id, token, now, now);

test('durable confirmation blocks discard and interpretation after lease expiry and restart', () => {
  insert('confirm'); reserveReview('confirm','owner');
  assert.ok(sql.confirmationBegin, 'durable confirmation SQL is required');
  assert.equal(run('confirmationBegin','confirm','namespace:event',Buffer.from('encrypted-approved-data'),NOW,'confirm','wrong',NOW,NOW),0);
  assert.equal(run('confirmationBegin','confirm','namespace:event',Buffer.from('encrypted-approved-data'),NOW,'confirm','owner',NOW,NOW),1);
  assert.equal(discardReview('confirm','owner'),0);
  db.close(); db = new DatabaseSync(join(directory,'notification-inbox.db'));
  run('recover', NOW+2000,NOW+2000,NOW+2000);
  assert.equal(reserveReview('confirm','next',NOW+2000),0);
  run('purgeStructured',NOW+31*DAY,NOW+31*DAY);
  assert.equal(get('confirm').state,'error');
  assert.equal(db.prepare(sql.reviewList).all(NOW+31*DAY,25,0).length,1);
  assert.equal(db.prepare('SELECT count(*) n FROM inbox_confirmation_intents').get().n,1);
});

test('confirmation intent is unique, ciphertext only, and cannot attach to discarded history', () => {
  insert('confirm'); reserveReview('confirm','owner');
  assert.ok(sql.confirmationBegin);
  assert.equal(run('confirmationBegin','confirm','namespace:event','plaintext',NOW,'confirm','owner',NOW,NOW),0);
  assert.equal(run('confirmationBegin','confirm','namespace:event',Buffer.from('cipher'),NOW,'confirm','owner',NOW,NOW),1);
  assert.equal(run('confirmationBegin','confirm','namespace:event',Buffer.from('other'),NOW,'confirm','owner',NOW,NOW),0);
  assert.throws(()=>db.prepare("UPDATE inbox_events SET state='ignored' WHERE local_id='confirm'").run());
  assert.throws(()=>db.prepare("UPDATE inbox_events SET local_id='reused' WHERE local_id='confirm'").run());
  assert.throws(()=>db.prepare("DELETE FROM inbox_events WHERE local_id='confirm'").run());
});

test('native acknowledgement and reference roll back together and preserve confirmed history',()=>{
  insert('confirm'); reserveReview('confirm','owner');
  run('confirmationBegin','confirm','namespace:event',Buffer.from('cipher'),NOW,'confirm','owner',NOW,NOW);
  db.exec("CREATE TRIGGER fail_ack BEFORE UPDATE OF reference ON inbox_confirmation_intents BEGIN SELECT RAISE(ABORT,'ack failure'); END");
  db.exec('BEGIN');
  assert.equal(run('confirmationFinish','expense:123',NOW,'confirm'),1);
  assert.throws(()=>run('confirmationAcknowledge','expense:123','confirm'),/ack failure/);
  db.exec('ROLLBACK'); assert.equal(get('confirm').state,'received');
  db.exec('DROP TRIGGER fail_ack; BEGIN');
  run('confirmationFinish','expense:123',NOW,'confirm');run('confirmationAcknowledge','expense:123','confirm');db.exec('COMMIT');
  assert.equal(get('confirm').state,'confirmed');assert.equal(get('confirm').confirmation_reference,'expense:123');
  assert.equal(reserveReview('confirm','other'),0);
  run('purgeStructured',NOW+31*DAY,NOW+31*DAY);
  assert.equal(get('confirm').state,'confirmed');assert.equal(get('confirm').confirmation_reference,'expense:123');
});

test('migration 2 extends an existing v1 queue without replacing identities or ciphertext',()=>{
  insert('legacy');const original=get('legacy');
  db.exec(`DROP TABLE inbox_confirmation_intents; DROP TABLE inbox_metadata;
    DROP TRIGGER protect_confirmation_state; DROP TRIGGER protect_event_identity; DROP TRIGGER retain_event_identity;`);
  migrate();migrate();
  assert.deepEqual(get('legacy'),original);
  assert.equal(get('legacy').local_id,'legacy');
});

test('review reserves pending events atomically across connections and requires a live owner token', () => {
  insert('review'); update('review', 'received', 'pending');
  const other = new DatabaseSync(join(directory, 'notification-inbox.db'));
  try {
    assert.equal(reserveReview('review', 'owner'), 1);
    assert.equal(other.prepare(sql.reviewReserve).run('competitor', NOW + 1000, NOW, 'review', NOW, NOW).changes, 0);
    assert.equal(finishReview('review', 'wrong'), 0);
    assert.equal(discardReview('review', null), 0);
    assert.equal(discardReview('review', 'wrong'), 0);
    assert.equal(finishReview('review', 'owner'), 1);
    assert.equal(get('review').state, 'pending');
    assert.equal(get('review').lease_token, null);
  } finally { other.close(); }
});

test('review expired reservation is reclaimed without losing data and rejects the stale owner', () => {
  insert('review'); update('review', 'received', 'pending');
  reserveReview('review', 'old');
  assert.equal(finishReview('review', 'old', NOW + 1000), 0);
  assert.equal(discardReview('review', 'old', NOW + 1000), 0);
  db.close();
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  assert.equal(reserveReview('review', 'new', NOW + 1000), 1);
  assert.equal(finishReview('review', 'old', NOW + 1001), 0);
  assert.equal(discardReview('review', 'old', NOW + 1001), 0);
  assert.ok(get('review').raw_cipher instanceof Uint8Array);
  assert.equal(finishReview('review', 'new', NOW + 1001), 1);
});

test('review interpretation failure preserves ciphertext and can be retried', () => {
  insert('review'); reserveReview('review', 'failed');
  assert.equal(run('reviewFail', NOW, 'review', 'wrong', NOW, NOW), 0);
  assert.equal(run('reviewFail', NOW, 'review', 'failed', NOW, NOW), 1);
  assert.equal(get('review').state, 'error');
  assert.ok(get('review').raw_cipher instanceof Uint8Array);
  assert.equal(reserveReview('review', 'retry'), 1);
  assert.equal(finishReview('review', 'retry'), 1);
  assert.equal(get('review').state, 'pending');
});

test('review discard clears content but preserves the persistent deduplication tombstone', () => {
  insert('review', 'review-identity'); reserveReview('review', 'owner');
  assert.equal(discardReview('review', 'owner'), 1);
  assert.equal(get('review').state, 'ignored');
  assert.equal(get('review').raw_cipher, null);
  assert.equal(get('review').structured_cipher, null);
  assert.equal(insert('replay', 'review-identity'), 0);
  assert.equal(reserveReview('review', 'again'), 0);
  assert.equal(finishReview('review', 'owner'), 0);
});

test('review listing is read-only, excludes finalized or expired events and never selects raw content', () => {
  insert('review'); insert('ignored'); insert('expired', 'expired', 'fingerprint', NOW - 31 * DAY);
  update('ignored', 'received', 'ignored');
  reserveReview('review', 'owner');
  const before = get('review');
  const rows = db.prepare(sql.reviewList).all(NOW, 25, 0);
  assert.deepEqual(rows.map(row => row.local_id), ['review']);
  assert.equal('raw_cipher' in rows[0], false);
  assert.equal('android_identity_cipher' in rows[0], false);
  assert.equal('lease_token' in rows[0], false);
  assert.deepEqual(get('review'), before);
});

test('review maintenance releases expired pending reservations without dropping the event', () => {
  insert('review'); update('review', 'received', 'pending'); reserveReview('review', 'owner');
  assert.equal(run('recover', NOW + 1000, NOW + 1000, NOW + 1000), 1);
  assert.equal(get('review').state, 'pending');
  assert.equal(get('review').lease_token, null);
  assert.ok(get('review').raw_cipher instanceof Uint8Array);
});

test('initial schema is idempotent and preserves rows after reopening the separate inbox', () => {
  insert('first');
  migrate();
  db.close();
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  migrate();
  assert.equal(get('first').state, 'received');
  assert.equal(get('first').source, 'com.ficticio.bank');
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name IN ('accounts','transactions','goals')").get().n, 0);
});

test('proven identity duplicates retain the original record and state across restart', () => {
  assert.equal(insert('first', 'proven-identity'), 1);
  assert.equal(update('first', 'received', 'pending'), 1);
  db.close();
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  assert.equal(insert('duplicate', 'proven-identity'), 0);
  assert.equal(db.prepare(sql.existing).get('proven-identity').local_id, 'first');
  assert.equal(get('first').state, 'pending');
});

test('equal content alone never suppresses different or unidentified events', () => {
  insert('first', 'app-key-time-1');
  insert('second', 'app-key-time-2');
  insert('unknown-1', null);
  insert('unknown-2', null);
  assert.equal(db.prepare(sql.list).all('received', 100).length, 4);
});

test('fixture duplicate delivery preserves exactly one encrypted row across restart', () => {
  const write = (id) => run('insert', id, 'com.walletai.notificationfixture', NOW, NOW,
    'same-android-key-user-id-post-time-and-content-hmac', 'fixture-fingerprint-hmac',
    Buffer.from('opaque-identity-cipher'), Buffer.from('opaque-raw-cipher'), null,
    NOW + DAY, NOW + 30 * DAY, NOW);
  assert.equal(write('fixture-original'), 1);
  db.close();
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  assert.equal(write('fixture-duplicate'), 0);
  const count = db.prepare('SELECT count(*) AS n FROM inbox_events WHERE source = ?')
    .get('com.walletai.notificationfixture').n;
  assert.equal(count, 1);
  assert.equal(db.prepare(sql.existing).get('same-android-key-user-id-post-time-and-content-hmac').local_id, 'fixture-original');
  assert.ok(get('fixture-original').raw_cipher instanceof Uint8Array);
});

test('query by state and limit returns only the requested events', () => {
  insert('first'); insert('second');
  update('second', 'received', 'pending');
  assert.deepEqual(db.prepare(sql.list).all('pending', 1).map(r => r.local_id), ['second']);
  assert.deepEqual(db.prepare(sql.list).all('received', 1).map(r => r.local_id), ['first']);
});

test('a single lease owns work and stale or absent tokens cannot acknowledge it', () => {
  insert('first');
  assert.equal(claim(), 1);
  assert.equal(claim('worker-2'), 0);
  assert.equal(get('first').attempts, 1);
  assert.equal(update('first', 'received', 'pending'), 0);
  assert.equal(update('first', 'received', 'pending', 'wrong'), 0);
  assert.equal(update('first', 'received', 'pending', 'worker-1'), 1);
  assert.equal(get('first').lease_token, null);
});

test('interrupted work survives restart, recovers after expiration and rejects the old worker', () => {
  insert('first'); claim();
  db.close();
  db = new DatabaseSync(join(directory, 'notification-inbox.db'));
  assert.equal(run('recover', NOW + 999, NOW + 999, NOW + 999), 0);
  assert.equal(run('recover', NOW + 1000, NOW + 1000, NOW + 1000), 1);
  assert.equal(get('first').state, 'error');
  assert.equal(get('first').error_code, 'interrupted');
  assert.equal(claim('worker-2', NOW + 1000, 'error'), 1);
  assert.equal(update('first', 'error', 'pending', 'worker-1', NOW + 1001), 0);
  assert.equal(update('first', 'error', 'pending', 'worker-2', NOW + 1001), 1);
  assert.equal(get('first').attempts, 2);
});

test('retry time and five-attempt cap prevent a hot retry loop', () => {
  insert('first'); claim();
  update('first', 'received', 'error', 'worker-1', NOW, null, NOW + 100);
  assert.equal(claim('early', NOW + 99, 'error'), 0);
  assert.equal(claim('retry', NOW + 100, 'error'), 1);
  db.prepare("UPDATE inbox_events SET attempts = 5, lease_token = NULL, lease_until = NULL WHERE local_id = 'first'").run();
  assert.equal(claim('exhausted', NOW + 200, 'error'), 0);
});

test('raw ciphertext expires at 24 hours while structured data remains available', () => {
  insert('first');
  assert.equal(run('purgeRaw', NOW + DAY - 1), 0);
  assert.equal(run('purgeRaw', NOW + DAY), 1);
  assert.equal(get('first').raw_cipher, null);
  assert.ok(get('first').structured_cipher instanceof Uint8Array);
  assert.equal(get('first').state, 'received');
});

test('pending data expires at 30 days but dedup tombstones prevent replay', () => {
  insert('first', 'proven-identity');
  update('first', 'received', 'pending');
  run('purgeStructured', NOW + 30 * DAY, NOW + 30 * DAY);
  const event = get('first');
  assert.equal(event.state, 'ignored');
  assert.equal(event.error_code, 'retention_expired');
  assert.equal(event.raw_cipher, null);
  assert.equal(event.structured_cipher, null);
  assert.equal(event.android_identity_cipher, null);
  assert.equal(insert('replay', 'proven-identity'), 0);
  assert.equal(update('first', 'ignored', 'pending', null, NOW + 30 * DAY), 0);
});

test('confirmation requires a reference and clears raw text without creating financial records', () => {
  insert('first'); update('first', 'received', 'pending');
  assert.throws(() => update('first', 'pending', 'confirmed'));
  assert.equal(get('first').state, 'pending');
  assert.equal(update('first', 'pending', 'confirmed', null, NOW, 'future-ledger-receipt'), 1);
  assert.equal(get('first').raw_cipher, null);
  assert.equal(get('first').confirmation_reference, 'future-ledger-receipt');
});

test('plaintext payloads and invalid states are rejected by the schema', () => {
  insert('first');
  assert.throws(() => db.prepare("UPDATE inbox_events SET raw_cipher = 'unprotected text' WHERE local_id = 'first'").run());
  assert.throws(() => db.prepare("UPDATE inbox_events SET structured_cipher = 'unprotected text' WHERE local_id = 'first'").run());
  assert.throws(() => db.prepare("UPDATE inbox_events SET android_identity_cipher = 'unprotected text' WHERE local_id = 'first'").run());
  assert.throws(() => db.prepare("UPDATE inbox_events SET state = 'invalid' WHERE local_id = 'first'").run());
  assert.throws(() => db.prepare("UPDATE inbox_events SET error_code = 'bank message leaked' WHERE local_id = 'first'").run());
});

test('failed database transaction leaves no partial event or attempt changes', () => {
  insert('first');
  db.exec('BEGIN');
  try {
    claim(); insert('second');
    db.prepare("UPDATE inbox_events SET state = 'invalid' WHERE local_id = 'first'").run();
  } catch { db.exec('ROLLBACK'); }
  assert.equal(get('first').attempts, 0);
  assert.equal(get('first').lease_token, null);
  assert.equal(get('second'), undefined);
});

test('decryption failures release reservations with a sanitized error, retaining ciphertext for recovery', () => {
  insert('first'); claim();
  const observed = get('first');
  assert.equal(run('decryptionError', NOW, 'first', observed.state, observed.lease_token, observed.revision), 1);
  assert.equal(get('first').state, 'error');
  assert.equal(get('first').lease_token, null);
  assert.equal(get('first').error_code, 'decryption_failed');
  assert.ok(get('first').raw_cipher instanceof Uint8Array);
});

test('a stale decryption failure cannot revoke a newer lease or overwrite newer data', () => {
  insert('first'); claim();
  const observed = get('first');
  run('recover', NOW + 1000, NOW + 1000, NOW + 1000);
  claim('new-worker', NOW + 1000, 'error');
  assert.equal(run('decryptionError', NOW + 1001, 'first', observed.state, observed.lease_token, observed.revision), 0);
  assert.equal(get('first').lease_token, 'new-worker');
  update('first', 'error', 'pending', 'new-worker', NOW + 1001);
  const pending = get('first');
  // Even updates in the same millisecond increment the revision.
  update('first', 'pending', 'error', null, NOW + 1001);
  update('first', 'error', 'pending', null, NOW + 1001);
  assert.equal(run('decryptionError', NOW + 1001, 'first', pending.state, pending.lease_token, pending.revision), 0);
  assert.equal(get('first').state, 'pending');
});

test('two independent connections cannot reserve the same event', () => {
  insert('first');
  const other = new DatabaseSync(join(directory, 'notification-inbox.db'));
  try {
    assert.equal(claim(), 1);
    assert.equal(other.prepare(sql.claim).run('other-worker', NOW + 1000, NOW, 'received', NOW, NOW).changes, 0);
    assert.equal(other.prepare(sql.byId).get('first').lease_token, 'worker-1');
  } finally { other.close(); }
});
