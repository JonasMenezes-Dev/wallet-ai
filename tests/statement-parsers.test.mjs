import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
registerHooks({ load(url, context, next) { if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText }; return next(url, context); } });
const { decodeStatementBytes, inspectCsv, parseCsv, parseOfx } = await import('../src/services/statement-parsers.ts');
const mapping = { date: 0, description: 1, amount: 2, credit: null, debit: null, bankId: null, typeHint: null };
const ofx = (body) => `<OFX><CURDEF>BRL<BANKACCTFROM><BANKID>001<ACCTID>123</BANKACCTFROM><BANKTRANLIST>${body}</BANKTRANLIST></OFX>`;
const trn = (date = '20261021', amount = '-12.34') => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${date}<TRNAMT>${amount}<FITID>abc<NAME>Mercado<MEMO>Compra</STMTTRN>`;
test('decodes UTF8, UTF16 and Windows1252 without legacy TextDecoder', () => {
  assert.equal(decodeStatementBytes(new Uint8Array([0xef,0xbb,0xbf,65])), 'A');
  assert.equal(decodeStatementBytes(new Uint8Array([0xff,0xfe,0xe7,0])), 'ç');
  assert.equal(decodeStatementBytes(new Uint8Array([0xfe,0xff,0,0xe7])), 'ç');
  assert.equal(decodeStatementBytes(new Uint8Array([0x80,0xe7])), '€ç');
  assert.throws(() => decodeStatementBytes(new Uint8Array([0xef,0xbb,0xbf,0xff])));
  assert.throws(() => decodeStatementBytes(new Uint8Array([0xff,0xfe,1])));
});
test('CSV inspection detects delimiter, multilingual headers, ambiguity', async () => {
  const result = await inspectCsv('Data;Descrição;Valor\n21/10/2026;Café;-12,34');
  assert.equal(result.delimiter, ';'); assert.equal(result.mapping.amount, 2); assert.equal(result.mapping.description, 1);
  const ambiguous = await inspectCsv('Date,Date,Description,Amount\n2026-10-21,2026-10-21,X,10');
  assert.equal(ambiguous.mapping.date, null); assert.equal(ambiguous.ambiguous, true);
});
test('CSV quotes/newlines and exact BR/US cents; preserve invalid rows', async () => {
  const result = await parseCsv('Data;Descrição;Valor\n21/10/2026;"Café; ""bom""\nhoje";-1.234,56\n2026-10-22;X;1,234.56\n31/02/2026;Bad;12.3456\n2026-10-22;short', mapping);
  assert.equal(result.rows.length, 4); assert.equal(result.rows[0].amountCents, -123456);
  assert.equal(result.rows[0].description, 'Café; "bom"\nhoje'); assert.equal(result.rows[1].amountCents, 123456);
  assert.equal(result.rows[0].date, '2026-10-21'); assert.ok(result.rows[2].errors.length >= 2); assert.ok(result.rows[3].errors.length);
});
test('CSV credit/debit columns and sign conflicts', async () => {
  const m = { ...mapping, amount: null, credit: 2, debit: 3 };
  const result = await parseCsv('Date,Description,Credit,Debit\n2026-10-21,X,10.20,\n2026-10-21,X,,2.30\n2026-10-21,X,1,2\n2026-10-21,X,,\n2026-10-21,X,,-2', m);
  assert.deepEqual(result.rows.slice(0,2).map(r => r.amountCents), [1020,-230]);
  assert.ok(result.rows.slice(2).every(r => r.errors.length));
});
test('CSV accepts an inactive zero credit/debit column and minute precision ISO dates', async () => {
  const m = { ...mapping, amount: null, credit: 2, debit: 3 };
  const result = await parseCsv('Date;Description;Credit;Debit\n2026-10-21T12:30;X;10,20;0,00\n2026-10-21T23:59-03:00;X;0;2,30\n2026-10-21T12:30Z;X;0;0\n2026-10-21T24:00;X;1;0\n2026-10-21T12:60;X;1;0\n2026-10-21T12:30;X;1;2',m);
  assert.deepEqual(result.rows.slice(0,2).map(r => r.amountCents),[1020,-230]);
  assert.ok(result.rows.slice(0,2).every(r => !r.errors.length));
  assert.deepEqual(result.rows.slice(0,3).map(r => r.date),['2026-10-21T12:30','2026-10-21T23:59-03:00','2026-10-21T12:30Z']);
  assert.equal(result.rows[2].amountCents,0);
  assert.ok(result.rows[2].errors.length);
  assert.ok(result.rows.slice(3).every(r => r.errors.length));
});
test('CSV structural corruption, missing mappings, empty and oversized rejected', async () => {
  await assert.rejects(parseCsv('Date,Description,Amount\n2026-10-21,"broken,12', mapping));
  await assert.rejects(parseCsv('Date,Description,Amount\n2026-10-21,X,12', {...mapping,date:null}));
  await assert.rejects(inspectCsv('')); await assert.rejects(inspectCsv('x'.repeat(5*1024*1024+1)));
  await assert.rejects(parseCsv('Date,Description,Amount\n'+ '2026-10-21,X,1\n'.repeat(10001), mapping));
});
test('OFX SGML preserves FITID, account, calendar date, MEMO and exact cents', async () => {
  const result = await parseOfx(ofx(trn()));
  assert.equal(result.currency, 'BRL'); assert.equal(result.accountKind, 'bank'); assert.ok(result.accountKey.includes('123'));
  assert.equal(result.rows[0].bankId, 'abc'); assert.equal(result.rows[0].amountCents,-1234);
  assert.equal(result.rows[0].date,'2026-10-21'); assert.ok(result.rows[0].description.includes('Compra'));
});
test('OFX XML card, escaped entities and explicit time/offset; invalid dates stay errors', async () => {
  const result = await parseOfx('<?xml version="1.0"?><OFX><CURDEF>USD</CURDEF><CCACCTFROM><ACCTID>card</ACCTID></CCACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261021123045[-3:BRT]</DTPOSTED><TRNAMT>12.34</TRNAMT><NAME>A &amp; B</NAME></STMTTRN></BANKTRANLIST></OFX>');
  assert.equal(result.accountKind,'card'); assert.equal(result.rows[0].date,'2026-10-21T12:30:45-03:00'); assert.equal(result.rows[0].description,'A & B');
  for (const date of ['20260230','20261021250000','20261021120000[25:BAD]']) {
    assert.ok((await parseOfx(ofx(trn(date)))).rows[0].errors.length);
  }
});
test('OFX rejects DTD/entities, truncated records and missing containers; retains bad transaction', async () => {
  for (const value of ['', '<!DOCTYPE OFX [<!ENTITY x SYSTEM "file:///x">]><OFX></OFX>', '<OFX><STMTTRN><TRNAMT>1</OFX>', '<STMTTRN></STMTTRN>']) await assert.rejects(parseOfx(value));
  const result = await parseOfx(ofx(trn()+'<STMTTRN><TRNAMT>BAD</STMTTRN>'));
  assert.equal(result.rows.length,2); assert.ok(result.rows[1].errors.length);
});
test('OFX accepts repeated response status and empty optional SGML fields; requires list ownership', async () => {
  const value = `<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><STMTRS><CURDEF>BRL<BANKTRANLIST><STMTTRN><DTPOSTED>20261021<TRNAMT>1<NAME>Test<MEMO></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  assert.equal((await parseOfx(value)).rows[0].description, 'Test');
  await assert.rejects(parseOfx('<OFX>'+trn()+'</OFX>'));
  await assert.rejects(parseOfx('<OFX></OFX>'+ofx(trn())));
});
test('OFX accepts XML declarations and comments without interpreting their tags', async () => {
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n'+ofx('<!-- synthetic <STMTTRN>ignored</STMTTRN> -->\n'+trn());
  const result = await parseOfx(text);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].bankId,'abc');
  await assert.rejects(parseOfx(ofx('<!-- unclosed '+trn())));
  await assert.rejects(parseOfx(ofx('<!-- invalid -- comment -->'+trn())));
});
test('minified OFX has distinct logical row identities, including default/prefixed namespace XML', async () => {
  const xmlRow = id => `<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261021</DTPOSTED><TRNAMT>-12.34</TRNAMT><FITID>${id}</FITID><NAME>Test</NAME></STMTTRN>`;
  const body = xmlRow('abc')+xmlRow('def');
  for (const source of [ofx(body),ofx(body).replace('<OFX>','<OFX xmlns="http://ofx.net/types/2003/04">'),ofx(body).replace(/<(\/?)([A-Z0-9]+)/g,'<$1ofx:$2').replace('<ofx:OFX>','<ofx:OFX xmlns:ofx="http://ofx.net/types/2003/04">')]) {
    const result = await parseOfx(source);
    assert.deepEqual(result.rows.map(r => r.line),[1,2]);
    assert.deepEqual(result.rows.map(r => r.bankId),['abc','def']);
  }
  await assert.rejects(parseOfx(ofx(trn()).replace('<OFX>','<OFX arbitrary="x">')));
  await assert.rejects(parseOfx(ofx(trn()).replace('<OFX>','<OFX xmlns="file:///invalid">')));
});
test('OFX correction references remain blocked for explicit review', async () => {
  for (const correction of ['<CORRECTFITID>old','<CORRECTACTION>REPLACE','<CORRECTACTION></CORRECTACTION>']) {
    const result = await parseOfx(ofx(trn().replace('</STMTTRN>',correction+'</STMTTRN>')));
    assert.ok(result.rows[0].errors.some(error => /corre/i.test(error)));
  }
});
test('synthetic fixtures and 10000 rows work while yielding to the UI event loop', async () => {
  const fixture = name => readFileSync(new URL('./fixtures/statements/'+name, import.meta.url), 'utf8');
  assert.equal((await parseOfx(fixture('synthetic-bank.ofx'))).rows.length, 2);
  const csv = fixture('synthetic-bank.csv'), inspection = await inspectCsv(csv);
  assert.equal((await parseCsv(csv,inspection.mapping)).rows[0].amountCents,-4205);
  let yielded = false; const timer = setTimeout(() => { yielded = true; },0);
  const parsed = await parseCsv('Date,Description,Amount\n'+'2026-10-21,X,1\n'.repeat(10000),mapping);
  clearTimeout(timer); assert.equal(parsed.rows.length,10000); assert.equal(yielded,true);
});
