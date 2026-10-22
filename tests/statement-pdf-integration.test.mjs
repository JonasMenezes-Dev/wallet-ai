import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase } from './helpers/sqlite.mjs';
import { syntheticItauPdf, header, page, movement } from './fixtures/statements/synthetic-itau-pdf.mjs';

const { getDatabase } = await import('../src/database/database.ts');
const { parseItauPdf } = await import('../src/services/statement-pdf-parser.ts');
const service = await import('../src/services/statement-import.service.ts');
const { addGoalContribution } = await import('../src/repositories/goal.repository.ts');
const { getMonthlyReport } = await import('../src/services/reports.service.ts');
const count = () => database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n;
const receipts = () => database.native.prepare('SELECT COUNT(*) n FROM statement_import_receipts').get().n;
const balances = () => database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(row => row.balance);
const preview = async (document = syntheticItauPdf, hash = 'a') => service.prepareStatementImport(
  await parseItauPdf(document), 1, hash.repeat(64), 'synthetic-itau');

before(getDatabase);
after(closeDatabase);
beforeEach(() => database.native.exec(`
 DELETE FROM statement_import_receipts; DELETE FROM statement_category_rules; DELETE FROM transactions;
 DELETE FROM monthly_budgets; DELETE FROM goals; DELETE FROM accounts;
 INSERT INTO accounts(id,name,type,balance,created_at,updated_at) VALUES
 (1,'Banco fictício','bank',100,'old','old'),(2,'Carteira','cash',10,'old','old'),(3,'Cartão','credit_card',20,'old','old');
 INSERT INTO goals(id,name,target_amount,current_amount,created_at,updated_at) VALUES(1,'Reserva',100,0,'old','old');
`));

test('PDF extraction acknowledgement is mandatory and preview cannot persist movements', async () => {
 const draft = await preview();
 assert.equal(draft.statement.rows.length, 6);
 assert.equal(draft.statement.pdfSummary.ignoredBalanceLines, 2);
 assert.equal(draft.extractionConfirmed, false);
 assert.equal(draft.currencyConfirmed, true);
 assert.equal(count(), 0); assert.equal(receipts(), 0);
 await assert.rejects(service.confirmStatementImport(draft), /extração|PDF/i);
 assert.equal(count(), 0); assert.deepEqual(balances(), [100, 10, 20]);
 draft.extractionConfirmed = true;
 draft.rows.forEach(row => { row.selected = row.identification.operation === 'yield'; });
 assert.equal(count(), 0);
 assert.deepEqual(await service.confirmStatementImport(draft), { imported: 1, ignored: 5 });
 assert.equal(count(), 1); assert.equal(receipts(), 1);
 assert.deepEqual(balances(), [100.1, 10, 20]);
 assert.equal(database.native.prepare('SELECT date FROM transactions').get().date, '2026-03-05');
});

test('PDF refunds and yield retain their financial meaning while Pix and TED need explicit resolution', async () => {
 await addGoalContribution(1, 1, 20);
 const baseline = count();
 const draft = await preview();
 const pix = draft.rows.find(row => row.description.startsWith('PIX TRANSF'));
 const ted = draft.rows.find(row => row.description.startsWith('TED'));
 const refund = draft.rows.find(row => row.description.startsWith('PIX DEVOL'));
 const yieldRow = draft.rows.find(row => row.description.startsWith('REND PAGO'));
 assert.equal(pix.resolution, 'unresolved'); assert.equal(pix.selected, false);
 assert.equal(ted.resolution, 'unresolved'); assert.equal(ted.selected, false);
 assert.equal(refund.resolution, 'refund'); assert.equal(refund.selected, true);
 assert.equal(yieldRow.resolution, 'income'); assert.equal(yieldRow.selected, true);
 draft.rows.forEach(row => { row.selected = row === refund || row === yieldRow; });
 draft.extractionConfirmed = true;
 await service.confirmStatementImport(draft);
 assert.equal(count(), baseline + 2);
 assert.deepEqual(balances(), [85.1, 10, 20]);
 assert.equal(database.native.prepare('SELECT current_amount FROM goals WHERE id=1').get().current_amount, 20);
 const report = await getMonthlyReport('2026-03');
 assert.equal(report.income, 0.1); assert.equal(report.expenses, -5);
 assert.equal(database.native.prepare('SELECT is_refund FROM transactions WHERE source=\'import\' AND amount=5').get().is_refund, 1);
});

test('two legitimate equal PDF purchases remain reviewable and import only after distinct-operation approval', async () => {
 const document = { pages: [page([...header(),
  ...movement('04/03/2026', 'Compra débito supermercado FICTICIO', '-12,50', 120),
  ...movement('04/03/2026', 'Compra débito supermercado FICTICIO', '-12,50', 140),
 ])] };
 let draft = await preview(document);
 assert.equal(draft.rows[0].duplicate, 'none');
 assert.equal(draft.rows[1].duplicate, 'possible');
 assert.equal(draft.rows[1].selected, false);
 draft.extractionConfirmed = true;
 draft.rows[1].selected = true;
 await assert.rejects(service.confirmStatementImport(draft), /duplic/i);
 assert.equal(count(), 0); assert.equal(receipts(), 0);
 draft.rows[1].allowPossibleDuplicate = true;
 draft = await service.refreshStatementImport(draft);
 assert.equal(draft.rows[1].selected, true);
 assert.deepEqual(await service.confirmStatementImport(draft), { imported: 2, ignored: 0 });
 assert.equal(count(), 2); assert.equal(receipts(), 2);
 assert.deepEqual(balances(), [75, 10, 20]);
});

test('reimporting confirmed PDF lines is blocked persistently without changing balances or goals', async () => {
 await addGoalContribution(1, 1, 20);
 const draft = await preview();
 draft.extractionConfirmed = true;
 draft.rows.forEach(row => { row.selected = row.identification.operation === 'yield'; });
 await service.confirmStatementImport(draft);
 const previousBalances = balances(); const previousCount = count();
 const again = await preview();
 const imported = again.rows.find(row => row.identification.operation === 'yield');
 assert.equal(imported.duplicate, 'exact'); assert.equal(imported.selected, false);
 again.extractionConfirmed = true;
 again.rows.forEach(row => { row.selected = row === imported; });
 await assert.rejects(service.confirmStatementImport(again), /duplic/i);
 assert.equal(count(), previousCount); assert.equal(receipts(), 1);
 assert.deepEqual(balances(), previousBalances);
 assert.equal(database.native.prepare('SELECT current_amount FROM goals WHERE id=1').get().current_amount, 20);
});
