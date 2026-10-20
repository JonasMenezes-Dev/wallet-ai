import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function withDatabase(phases) {
  const directory = mkdtempSync(join(tmpdir(), 'wallet-persistence-'));
  try {
    for (const phase of phases) {
      const result = spawnSync(process.execPath, [
        '--experimental-strip-types',
        fileURLToPath(new URL('./helpers/persistence-worker.mjs', import.meta.url)), phase,
      ], {
        env: { ...process.env, WALLET_TEST_DATABASE_PATH: join(directory, 'wallet.db') },
        encoding: 'utf8', timeout: 15000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${phase}: ${result.stderr}\n${result.stdout}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('persistence retains accounts, transactions, goals and budgets across process restarts', () => {
  withDatabase(['seed', 'read-and-update', 'read-updated']);
});

test('persistence retains rollback after a failed goal contribution and reopening', () => {
  withDatabase(['seed', 'fail-contribution', 'read-original']);
});

test('legacy migrations preserve financial records across reopening and reinitialization', () => {
  withDatabase(['legacy-upgrade', 'read-legacy']);
});
