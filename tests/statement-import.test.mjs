import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase } from './helpers/sqlite.mjs';
const { getDatabase } = await import('../src/database/database.ts');
const service = await import('../src/services/statement-import.service.ts');
const { addGoalContribution } = await import('../src/repositories/goal.repository.ts');
const { getDashboardSummary } = await import('../src/services/dashboard.service.ts');
const date=new Date().toLocaleDateString('sv-SE');
const row=(patch={})=>({line:1,bankId:'bank-1',date,amountCents:-1250,description:'Compra débito supermercado Central',typeHint:'DEBIT',errors:[],...patch});
const statement=(rows=[row()],patch={})=>({format:'ofx',rows,currency:'BRL',accountKey:'synthetic-account',accountKind:'bank',warnings:[],...patch});
const preview=(rows,hash='a',accountId=1,patch={})=>service.prepareStatementImport(statement(rows,patch),accountId,hash.repeat(64),'synthetic-scope');
const balances=()=>database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(r=>r.balance);
const count=()=>database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n;
before(getDatabase); after(closeDatabase);
beforeEach(()=>database.native.exec(`DROP TRIGGER IF EXISTS fail_import;
 DELETE FROM statement_import_receipts; DELETE FROM statement_category_rules; DELETE FROM transactions; DELETE FROM monthly_budgets; DELETE FROM goals; DELETE FROM accounts;
 INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES
 (1,'Banco','bank',100,'old','old'),(2,'Carteira','cash',10,'old','old'),(3,'Cartão','credit_card',20,'old','old');
 INSERT INTO goals(id,name,target_amount,current_amount,created_at,updated_at) VALUES (1,'Reserva',100,0,'old','old');`));

test('preview writes nothing; explicit confirmation saves selected rows once',async()=>{
 const draft=await preview(); assert.equal(count(),0);
 const result=await service.confirmStatementImport(draft);
 assert.equal(result.imported,1); assert.deepEqual(balances(),[87.5,10,20]);
 const same=await preview(); assert.equal(same.rows[0].duplicate,'exact');
 same.rows[0].selected=true; await assert.rejects(service.confirmStatementImport(same));
 assert.equal(count(),1);
});
test('stable bank IDs prevent overlapping imports while distinct IDs preserve legitimate similar purchases',async()=>{
 await service.confirmStatementImport(await preview());
 const overlap=await preview([row()], 'b'); assert.equal(overlap.rows[0].duplicate,'exact');
 const similar=await preview([row({bankId:'bank-2'})],'c');
 assert.equal(similar.rows[0].duplicate,'none');
 await service.confirmStatementImport(similar); assert.equal(count(),2);
});
test('no-ID similarities remain reviewable rather than being silently discarded',async()=>{
 const draft=await preview([row({bankId:null}),row({line:2,bankId:null})]);
 assert.equal(draft.rows[1].duplicate,'possible'); assert.equal(draft.rows[1].selected,false);
 draft.rows[1].selected=true; draft.rows[1].allowPossibleDuplicate=true;
 await service.confirmStatementImport(draft); assert.equal(count(),2);
});
test('matches manual entries conservatively and rechecks a stale preview at commit',async()=>{
 const draft=await preview();
 database.native.prepare(`INSERT INTO transactions(amount,type,description,date,account_id,created_at,updated_at) VALUES(12.5,'expense',?,?,1,'old','old')`).run(row().description,date);
 await assert.rejects(service.confirmStatementImport(draft),/duplic/i);
 const review=await preview(); assert.equal(review.rows[0].duplicate,'possible');
 review.rows[0].selected=true; review.rows[0].allowPossibleDuplicate=true;
 await service.confirmStatementImport(review); assert.equal(count(),2);
});
test('own transfer requires counterpart and never inflates cashflow',async()=>{
 const draft=await preview([row({description:'Pix enviado conta própria',amountCents:-2000})]);
 assert.equal(draft.rows[0].resolution,'unresolved');
 draft.rows[0].selected=true;
 await assert.rejects(service.confirmStatementImport(draft));
 draft.rows[0].resolution='internal_transfer'; draft.rows[0].counterpartAccountId=2;
 await service.confirmStatementImport(draft); assert.deepEqual(balances(),[80,30,20]);
 const summary=await getDashboardSummary(); assert.equal(summary.totalIncome,0); assert.equal(summary.totalExpenses,0);
 const other=await preview([row({description:'Transferência recebida',amountCents:2000})],'b',2);
 assert.equal(other.rows[0].duplicate,'possible');
});
test('linked card payment reduces bank and card debt without duplicating spending',async()=>{
 const draft=await preview([row({description:'Pagamento fatura cartão',amountCents:-1500})]);
 Object.assign(draft.rows[0],{selected:true,resolution:'card_payment',counterpartAccountId:3});
 await service.confirmStatementImport(draft); assert.deepEqual(balances(),[85,10,5]);
 assert.equal((await getDashboardSummary()).totalExpenses,0);
});
test('failure midway rolls back entries, balances, rules and all receipts',async()=>{
 const draft=await preview([row(),row({line:2,bankId:'bank-2'})]);
 database.native.exec(`CREATE TRIGGER fail_import BEFORE INSERT ON statement_import_receipts WHEN NEW.row_number=2 BEGIN SELECT RAISE(ABORT,'injected'); END;`);
 await assert.rejects(service.confirmStatementImport(draft),/injected/);
 assert.deepEqual(balances(),[100,10,20]); assert.equal(count(),0);
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM statement_import_receipts').get().n,0);
});
test('concurrent confirmations cannot apply a file twice',async()=>{
 const a=await preview(); const b=await preview();
 const results=await Promise.allSettled([service.confirmStatementImport(a),service.confirmStatementImport(b)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(count(),1);
});
test('unknown currency, malformed rows and invalid account kind fail closed',async()=>{
 const draft=await preview(undefined,'a',1,{currency:null});
 await assert.rejects(service.confirmStatementImport(draft));
 draft.currencyConfirmed=true; await service.confirmStatementImport(draft);
 await assert.rejects(preview(undefined,'b',1,{currency:'USD'}));
 await assert.rejects(preview(undefined,'c',3));
 const invalid=await preview([row({date:'2026-02-30',errors:['Data inválida']})],'d');
 invalid.rows[0].selected=true; await assert.rejects(service.confirmStatementImport(invalid));
});
test('imports preserve reserves and learned corrections survive new previews',async()=>{
 await addGoalContribution(1,1,20);
 const draft=await preview();
 const category=database.native.prepare("SELECT id FROM categories WHERE name='Serviços'").get().id;
 Object.assign(draft.rows[0],{categoryId:category,learnCategory:true});
 await service.confirmStatementImport(draft);
 const next=await preview([row({bankId:'bank-2'})],'b');
 assert.equal(next.rows[0].categoryId,category);
 assert.equal(database.native.prepare('SELECT current_amount FROM goals').get().current_amount,20);
 assert.deepEqual(balances(),[67.5,10,20]);
});
test('refund restores cash and reduces consumption without manufacturing revenue',async()=>{
 const purchase=await preview([row({amountCents:-2000})]); await service.confirmStatementImport(purchase);
 const refund=await preview([row({description:'Estorno compra supermercado Central',amountCents:500,bankId:'refund-1'})],'b');
 assert.equal(refund.rows[0].resolution,'refund');
 await service.confirmStatementImport(refund);
 const summary=await getDashboardSummary();
 assert.equal(summary.totalIncome,0); assert.equal(summary.totalExpenses,15);
 assert.deepEqual(balances(),[85,10,20]);
});
test('equivalent UTC and offset timestamps find the same manual operation',async()=>{
 database.native.prepare(`INSERT INTO transactions(amount,type,description,date,account_id,created_at,updated_at) VALUES(12.5,'expense',?,'2026-10-22T01:00:00Z',1,'old','old')`).run(row().description);
 const draft=await preview([row({date:'2026-10-21T22:00:00-03:00'})]);
 assert.equal(draft.rows[0].duplicate,'possible'); assert.equal(draft.rows[0].selected,false);
});
test('reused bank ID with diverging data is reviewable before confirmation',async()=>{
 const draft=await preview([row(),row({line:2,amountCents:-500})]);
 assert.equal(draft.rows[1].duplicate,'possible');
 draft.rows[1].allowPossibleDuplicate=true; draft.rows[1].selected=true;
 await service.confirmStatementImport(draft); assert.equal(count(),2);
});
test('edited fields can be rechecked and late duplicates returned to review',async()=>{
 const draft=await preview();
 database.native.prepare(`INSERT INTO transactions(amount,type,description,date,account_id,created_at,updated_at) VALUES(10,'expense','Compra débito loja B',?,1,'old','old')`).run(date);
 Object.assign(draft.rows[0],{amountCents:-1000,description:'Compra débito loja B'});
 const revised=await service.refreshStatementImport(draft);
 assert.equal(revised.rows[0].duplicate,'possible'); assert.equal(revised.rows[0].selected,false);
 revised.rows[0].allowPossibleDuplicate=true; revised.rows[0].selected=true;
 await service.confirmStatementImport(revised); assert.equal(count(),2);
});
test('reverse-ordered reused identifiers remain resolvable in chronological commit order',async()=>{
 const draft=await preview([row({date:'2026-10-22',amountCents:-1000}),row({line:2,date:'2026-10-21',amountCents:-2000})]);
 for(const item of draft.rows)if(item.duplicate==='possible'){item.allowPossibleDuplicate=true;item.selected=true;}
 await service.confirmStatementImport(draft);assert.equal(count(),2);assert.deepEqual(balances(),[70,10,20]);
});
test('refund edits, reports, budgets and deletion all use net consumption consistently',async()=>{
 const {getMonthlyReport}=await import('../src/services/reports.service.ts');
 const {saveMonthlyBudget,listMonthlyBudgets}=await import('../src/services/budget.service.ts');
 const {updateTransaction,deleteTransaction,getAllTransactions}=await import('../src/repositories/transaction.repository.ts');
 const category=database.native.prepare("SELECT id FROM categories WHERE name='Supermercado'").get().id;
 await service.confirmStatementImport(await preview([row({amountCents:-2000})]));
 const refund=await preview([row({description:'Estorno supermercado Central',amountCents:500,bankId:'refund-1'})],'b');
 await service.confirmStatementImport(refund);
 const movement=(await getAllTransactions()).find(item=>item.isRefund);
 assert.ok(movement);await updateTransaction(movement.id,{type:'income',amount:7,accountId:1,categoryId:category,description:'Estorno editado'});
 const report=await getMonthlyReport(date.slice(0,7));assert.equal(report.income,0);assert.equal(report.expenses,13);
 assert.equal(report.expensesByCategory.find(c=>c.categoryId===category).total,13);
 await saveMonthlyBudget(category,date.slice(0,7),100);
 assert.equal((await listMonthlyBudgets(date.slice(0,7))).find(b=>b.categoryId===category).spent,13);
 await deleteTransaction(movement.id);assert.equal((await getDashboardSummary()).totalExpenses,20);
 assert.equal((await preview([row({description:'Estorno supermercado Central',amountCents:500,bankId:'refund-1'})],'c')).rows[0].duplicate,'exact');
});
test('card purchases and refunds alter debt exactly once without creating revenue',async()=>{
 await service.confirmStatementImport(await preview([row({description:'Compra crédito supermercado Central',amountCents:-500})],'a',3,{accountKind:'card'}));
 const refund=await preview([row({description:'Estorno compra supermercado Central',amountCents:1000,bankId:'refund-card'})],'b',3,{accountKind:'card'});
 await service.confirmStatementImport(refund);assert.deepEqual(balances(),[100,10,15]);
 const summary=await getDashboardSummary();assert.equal(summary.totalIncome,0);assert.equal(summary.totalExpenses,-5);
});
test('overflow and duplicate logical row identities are rejected without partial writes',async()=>{
 const draft=await preview([row({description:'Rendimento CDB',amountCents:Number.MAX_SAFE_INTEGER})]);
 await assert.rejects(service.confirmStatementImport(draft));assert.deepEqual(balances(),[100,10,20]);assert.equal(count(),0);
 await assert.rejects(preview([row(),row({bankId:'another'})]));
});
test('v12 migration failure rolls back schema and preserves v11 financial records',async()=>{
 const {runMigrations}=await import('../src/database/migrations.ts');
 await addGoalContribution(1,1,20);
 database.native.exec('DROP TABLE statement_import_receipts;DROP TABLE statement_category_rules;ALTER TABLE transactions DROP COLUMN is_refund;PRAGMA user_version=11;');
 const financial=database.native.prepare('SELECT * FROM transactions').all();
 const execute=database.execAsync;
 database.execAsync=async sql=>{if(sql.includes('CREATE TABLE IF NOT EXISTS statement_import_receipts'))throw Error('injected migration');return execute(sql);};
 try{
  await assert.rejects(runMigrations(database),/injected migration/);
  assert.equal(database.native.prepare('PRAGMA user_version').get().user_version,11);
  assert.deepEqual(database.native.prepare('SELECT * FROM transactions').all(),financial);assert.deepEqual(balances(),[80,10,20]);
 }finally{database.execAsync=execute;await runMigrations(database);await runMigrations(database);}
 assert.equal(database.native.prepare('SELECT current_amount FROM goals').get().current_amount,20);
 assert.equal(database.native.prepare('SELECT is_refund FROM transactions').get().is_refund,0);
});
test('timestamps without an offset retain the bank calendar month and original precision',async()=>{
 const {getMonthlyReport}=await import('../src/services/reports.service.ts');
 const draft=await preview([row({description:'Rendimento',amountCents:500,date:'2026-10-01T00:30'})]);
 await service.confirmStatementImport(draft);
 assert.equal(database.native.prepare("SELECT date FROM transactions WHERE source='import'").get().date,'2026-10-01T00:30');
 assert.equal((await getMonthlyReport('2026-10')).income,5);
 assert.equal((await getMonthlyReport('2026-09')).income,0);
});
test('date-only statements on the first day stay in that calendar month',async()=>{
 const {getMonthlyReport}=await import('../src/services/reports.service.ts');
 await service.confirmStatementImport(await preview([row({description:'Rendimento',amountCents:500,date:'2026-10-01'})]));
 assert.equal((await getMonthlyReport('2026-10')).income,5);assert.equal((await getMonthlyReport('2026-09')).income,0);
});
