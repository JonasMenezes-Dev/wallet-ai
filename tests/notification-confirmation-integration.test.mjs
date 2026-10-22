import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const worker=fileURLToPath(new URL('./helpers/notification-confirmation-worker.mjs',import.meta.url));
for(const kind of ['income','expense','internal_transfer'])test(`${kind}: real process death after financial commit recovers queue without a second movement`,()=>{
  const directory=mkdtempSync(join(tmpdir(),'wallet-confirmation-'));
  try{
    for(const [phase,expected] of [['crash-after-commit',23],['reconcile',0],['retry',0]]){
      const result=spawnSync(process.execPath,['--experimental-strip-types',worker,phase,kind],{
        env:{...process.env,WALLET_TEST_DATABASE_PATH:join(directory,'financial.db')},encoding:'utf8',timeout:20000});
      assert.equal(result.status,expected,result.stderr);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('failure before financial commit survives restart without automatic creation; explicit retry succeeds',()=>{
  const directory=mkdtempSync(join(tmpdir(),'wallet-confirmation-'));
  try{
    for(const phase of ['fail-before-commit','reconcile-empty','retry']){
      const result=spawnSync(process.execPath,['--experimental-strip-types',worker,phase,'expense'],{
        env:{...process.env,WALLET_TEST_DATABASE_PATH:join(directory,'financial.db')},encoding:'utf8',timeout:20000});
      assert.equal(result.status,0,result.stderr);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
