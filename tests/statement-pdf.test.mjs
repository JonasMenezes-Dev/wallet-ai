import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {closeDatabase} from './helpers/sqlite.mjs';
import {page,item,header,heading,movement,syntheticItauPdf} from './fixtures/statements/synthetic-itau-pdf.mjs';
const {parseItauPdf}=await import('../src/services/statement-pdf-parser.ts');
after(closeDatabase);
test('four-column layout separates movement values from balances and retains original descriptions',async()=>{
 const parsed=await parseItauPdf(syntheticItauPdf);
 assert.equal(parsed.format,'pdf');assert.equal(parsed.rows.length,6);
 assert.deepEqual(parsed.rows.map(r=>r.amountCents),[-2000,-1250,500,-3000,10,15000]);
 assert.equal(parsed.rows[1].date,'2026-03-04');assert.equal(parsed.rows[1].description,'RSHOP-LOJA FICTICIA 03/03');
 assert.equal(parsed.pdfSummary.ignoredBalanceLines,2);assert.equal(parsed.pdfSummary.periodStart,'2026-03-01');
 assert.equal(parsed.pdfSummary.periodEnd,'2026-03-31');assert.equal(parsed.pdfSummary.emittedDate,'2026-04-02');
 assert.equal(parsed.currency,'BRL');
});
test('multiple pages and a page break inside a record do not lose or duplicate movements',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),...movement('10/03/2026','PAG BOLETO',null,780)]),
  page([...heading(20),item('EMPRESA FICTICIA',100,40,200),item('-15,00',420,40),
   ...movement('11/03/2026','PIX TRANSF OUTRA PESSOA11/03','40,00',60)],2)]});
 assert.equal(parsed.rows.length,2);assert.deepEqual(parsed.rows.map(r=>r.line),[1,2]);
 assert.equal(parsed.rows[0].description,'PAG BOLETO EMPRESA FICTICIA');assert.equal(parsed.rows[0].amountCents,-1500);
 assert.equal(parsed.pdfSummary.pageCount,2);
});
test('value and balance on the same row use only the value column',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),...movement('12/03/2026','PAG BOLETO TESTE','-10,00',120,'999,99')])]});
 assert.equal(parsed.rows[0].amountCents,-1000);
});
test('repeated purchases stay as separate records with distinct logical identities',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),...movement('12/03/2026','LOJA FICTICIA 11/03','-10,00',120),
  ...movement('12/03/2026','LOJA FICTICIA 11/03','-10,00',140)])]});
 assert.equal(parsed.rows.length,2);assert.notEqual(parsed.rows[0].line,parsed.rows[1].line);
});
test('invalid dates, ambiguous monetary cells and orphan amounts are visible as extraction issues',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),...movement('31/02/2026','DESCRICAO FICTICIA','-10,00',120),
  ...movement('12/03/2026','OUTRA DESCRICAO','-10,00 -20,00',140),item('12,00',420,160)])]});
 assert.ok(parsed.pdfSummary.suspiciousLines>0);assert.ok(parsed.rows.some(r=>r.errors.length));
 assert.ok(parsed.warnings.length);
});
test('documents without text, unsupported columns and non-Itaú layouts fail closed',async()=>{
 await assert.rejects(parseItauPdf({pages:[page([])]}));
 await assert.rejects(parseItauPdf({pages:[page([item('Banco diferente',30,20)])]}));
 await assert.rejects(parseItauPdf({pages:[page([item('Itaú',30,20),...movement('12/03/2026','TESTE','100,00',80)])]}));
});


test('distant aligned footer cannot contaminate a completed movement or turn it into income',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),
  ...movement('12/03/2026','CREDITO DIVERSO','100,00',120),
  item('Consulte rendimentos no aplicativo',100,810,275)])]});
 assert.equal(parsed.rows[0].description,'CREDITO DIVERSO');
 assert.ok(parsed.pdfSummary.suspiciousLines>0);
 const {identifyStatementRow}=await import('../src/services/statement-rules.ts');
 assert.equal(identifyStatementRow(parsed.rows[0],'bank').suggestedResolution,'unresolved');
});

test('adjacent wrapped descriptions and split signs retain exact cents without invented times',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),
  ...movement('12/03/2026','PAG BOLETO EMPRESA',null,120),
  item('FICTICIA 11/03',100,134,200),item('-',405,134,5),item('1.234,56',420,134,45),
  ...movement('13/03/2026','CREDITO DIVERSO','+1.234,56',160)])]});
 assert.equal(parsed.rows[0].description,'PAG BOLETO EMPRESA FICTICIA 11/03');
 assert.deepEqual(parsed.rows.map(r=>r.amountCents),[-123456,123456]);
 assert.deepEqual(parsed.rows.map(r=>r.date),['2026-03-12','2026-03-13']);
});


test('next-page pre-table header cannot change a completed movement into yield',async()=>{
 const parsed=await parseItauPdf({pages:[page([...header(),
  ...movement('12/03/2026','CREDITO DIVERSO','100,00',780)]),
  page([item('Consulte rendimentos no aplicativo',100,30,275),...heading(),
   ...movement('13/03/2026','PAG BOLETO TESTE','-10,00',120)],2)]});
 assert.equal(parsed.rows[0].description,'CREDITO DIVERSO');
 const {identifyStatementRow}=await import('../src/services/statement-rules.ts');
 assert.equal(identifyStatementRow(parsed.rows[0],'bank').suggestedResolution,'unresolved');
 assert.ok(parsed.pdfSummary.suspiciousLines>0);
});
