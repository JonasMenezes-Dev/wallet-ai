import assert from 'node:assert/strict';
import { database, closeDatabase } from './sqlite.mjs';
const {getDatabase}=await import('../../src/database/database.ts');
const service=await import('../../src/services/statement-import.service.ts');
const {addGoalContribution}=await import('../../src/repositories/goal.repository.ts');
const {deleteTransaction}=await import('../../src/repositories/transaction.repository.ts');
const phase=process.argv[2];
const row=(line=1)=>({line,bankId:`id-${line}`,date:'2026-10-22',amountCents:-500,
 description:'Compra débito supermercado Central',typeHint:'DEBIT',errors:[]});
async function draft(hash='a',rows=[row()]){
 return service.prepareStatementImport({format:'ofx',rows,currency:'BRL',accountKey:'synthetic',accountKind:'bank',warnings:[]},1,hash.repeat(64),'synthetic');
}
try{
 await getDatabase();
 if(phase==='seed'){
  database.native.exec(`INSERT INTO accounts(id,name,type,balance,created_at,updated_at)VALUES(1,'Banco','bank',100,'old','old');
   INSERT INTO goals(id,name,target_amount,current_amount,created_at,updated_at)VALUES(1,'Meta',100,0,'old','old');`);
  await addGoalContribution(1,1,20);
  const review=await draft();review.rows[0].learnCategory=true;
  await service.confirmStatementImport(review);
 }else if(phase==='read'){
  assert.equal((await draft('b')).rows[0].duplicate,'exact');
  assert.equal(database.native.prepare('SELECT balance FROM accounts').get().balance,75);
  assert.equal(database.native.prepare('SELECT current_amount FROM goals').get().current_amount,20);
  assert.equal(database.native.prepare('SELECT COUNT(*) n FROM statement_category_rules').get().n,1);
 }else if(phase==='interrupt'){
  const review=await draft('c',[row(2),row(3)]);
  database.native.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON statement_import_receipts WHEN NEW.row_number=3 BEGIN SELECT RAISE(ABORT,'interrupted'); END;`);
  await assert.rejects(service.confirmStatementImport(review),/interrupted/);
  database.native.exec('DROP TRIGGER fail_import');
 }else if(phase==='retry'){
  assert.equal(database.native.prepare('SELECT COUNT(*) n FROM statement_import_receipts').get().n,1);
  assert.equal(database.native.prepare('SELECT balance FROM accounts').get().balance,75);
  await service.confirmStatementImport(await draft('c',[row(2),row(3)]));
  assert.equal(database.native.prepare('SELECT balance FROM accounts').get().balance,65);
 }else if(phase==='delete-and-reopen'){
  const movement=database.native.prepare("SELECT reference FROM statement_import_receipts WHERE bank_id='id-1'").get();
  await deleteTransaction(Number(movement.reference));
  assert.equal((await draft()).rows[0].duplicate,'exact');
 }else if(phase==='read-deleted'){
  assert.equal((await draft('d')).rows[0].duplicate,'exact');
  assert.equal(database.native.prepare('SELECT balance FROM accounts').get().balance,70);
  assert.equal(database.native.prepare('SELECT COUNT(*) n FROM statement_import_receipts').get().n,3);
 }else throw Error(`Unknown synthetic phase ${phase}`);
 assert.equal(database.native.prepare('PRAGMA user_version').get().user_version,12);
 assert.deepEqual(database.native.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.equal(database.native.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
}finally{closeDatabase();}
