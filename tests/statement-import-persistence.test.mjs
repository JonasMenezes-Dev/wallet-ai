import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('import receipts, corrections, rollback and reserves survive process restarts and deletion',()=>{
 const directory=mkdtempSync(join(tmpdir(),'wallet-statement-'));
 try{
  for(const phase of ['seed','read','interrupt','retry','delete-and-reopen','read-deleted']){
   const result=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(new URL('./helpers/statement-import-worker.mjs',import.meta.url)),phase],{
    env:{...process.env,WALLET_TEST_DATABASE_PATH:join(directory,'wallet.db')},encoding:'utf8',timeout:15000});
   assert.ifError(result.error);assert.equal(result.status,0,`${phase}: ${result.stderr}`);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
