import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Only replace the native Expo boundary; repositories, migrations and SQL are real.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo-sqlite') return { url: 'test:sqlite', shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      if (!existsSync(fileURLToPath(url)) && existsSync(fileURLToPath(url) + '.ts')) {
        return { url: url.href + '.ts', shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:sqlite') return {
      format: 'module', shortCircuit: true,
      source: 'export async function openDatabaseAsync(name, options) { return options?.useNewConnection ? globalThis.walletTestConnect() : globalThis.walletTestDatabase; }',
    };
    if (url.endsWith('.ts')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return next(url, context);
  },
});

const directory = process.env.WALLET_TEST_DATABASE_PATH ? null : mkdtempSync(join(tmpdir(), 'wallet-transfer-'));
const path = process.env.WALLET_TEST_DATABASE_PATH ?? join(directory, 'wallet.db');
export function connect() {
  const native = new DatabaseSync(path);
  native.exec('PRAGMA busy_timeout = 0;');
  const args = (params) => params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  const db = {
    native,
    async execAsync(sql) { native.exec(sql); },
    async runAsync(sql, ...params) {
      const result = native.prepare(sql).run(...args(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync(sql, ...params) {
      const result = native.prepare(sql).get(...args(params)) ?? null;
      await readHook?.(sql);
      return result;
    },
    async getAllAsync(sql, ...params) { return native.prepare(sql).all(...args(params)); },
    async withTransactionAsync(task) {
      try { native.exec('BEGIN'); await task(); native.exec('COMMIT'); }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
    async closeAsync() { native.close(); },
  };
  return db;
}
export const database = connect();
globalThis.walletTestDatabase = database;
globalThis.walletTestConnect = connect;
let readHook;
export function setReadHook(hook) { readHook = hook; }
export function closeDatabase() {
  database.native.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
}
