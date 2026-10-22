import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { registerHooks } from 'node:module';
import { closeDatabase } from './helpers/sqlite.mjs';
registerHooks({
  resolve(name, context, next) {
    if (['expo-document-picker','expo-file-system','expo-crypto','react-native','../../modules/statement-pdf'].includes(name)) return { url:`test:${name}`,shortCircuit:true };
    return next(name,context);
  },
  load(url,context,next) {
    const modules={
      'test:react-native':`export const Platform={get OS(){return globalThis.pdfPlatform??'android'}};`,
      'test:../../modules/statement-pdf':`export function getStatementPdfModule(){return globalThis.pdfNativeModule;}`, 
      'test:expo-document-picker':`export async function getDocumentAsync(options){globalThis.pickerOptions=options; return globalThis.pickerResult;}`,
      'test:expo-file-system':`export const Paths={cache:{uri:'file:///cache/'}};
        export class File { constructor(uri){this.uri=uri;this.size=globalThis.statementBytes.length;}
        async bytes(){return globalThis.statementBytes;} delete(){globalThis.deletedFiles.push(this.uri);} }`,
      'test:expo-crypto':`import {createHash} from 'node:crypto'; export const CryptoDigestAlgorithm={SHA256:'sha256'};
        export async function digest(algorithm,data){return Uint8Array.from(createHash(algorithm).update(data).digest()).buffer;}
        export async function digestStringAsync(algorithm,data){return createHash(algorithm).update(data).digest('hex');}`,
    };
    return url in modules ? {format:'module',source:modules[url],shortCircuit:true}:next(url,context);
  },
});
const {pickStatementFile,statementBankScope}=await import('../src/services/statement-file.ts');
beforeEach(()=>{
 globalThis.statementBytes=new TextEncoder().encode('data;descricao;valor\n22/10/2026;Compra;12,50');
 globalThis.deletedFiles=[];
 globalThis.pdfPlatform='android';
 globalThis.pdfNativeModule={extractTextAsync:async uri=>{globalThis.extractedPdfUri=uri;return {pages:[{page:1,width:595,height:842,items:[]}]};}};
 globalThis.pickerResult={canceled:false,assets:[{name:'extrato.CSV',uri:'file:///cache/picker/file.csv'}]};
});
after(closeDatabase);
test('picker reads only locally, hashes exact bytes and removes its temporary cache copy',async()=>{
 const file=await pickStatementFile(); assert.equal(file.format,'csv'); assert.equal(file.hash.length,64);
 assert.ok(file.text.includes('12,50')); assert.deepEqual(globalThis.deletedFiles,['file:///cache/picker/file.csv']);
 assert.equal(globalThis.pickerOptions.copyToCacheDirectory,true);
});
test('cancellation has no read or cleanup side effect',async()=>{
 globalThis.pickerResult={canceled:true}; assert.equal(await pickStatementFile(),null); assert.deepEqual(globalThis.deletedFiles,[]);
});
test('original user document is never deleted, including on failure',async()=>{
 globalThis.pickerResult.assets[0].uri='file:///documents/original.csv';
 await pickStatementFile(); assert.deepEqual(globalThis.deletedFiles,[]);
 globalThis.pickerResult.assets[0].name='wrong.txt';
 await assert.rejects(pickStatementFile()); assert.deepEqual(globalThis.deletedFiles,[]);
});
test('invalid extensions, oversized files and decoding failures still clean up cache',async()=>{
 globalThis.pickerResult.assets[0].name='wrong.txt'; await assert.rejects(pickStatementFile());
 assert.equal(globalThis.deletedFiles.length,1);
 globalThis.pickerResult.assets[0].name='file.csv'; globalThis.pickerResult.assets[0].size=6*1024*1024;
 await assert.rejects(pickStatementFile()); assert.equal(globalThis.deletedFiles.length,2);
 delete globalThis.pickerResult.assets[0].size; globalThis.statementBytes=new Uint8Array([0xef,0xbb,0xbf,0xff]);
 await assert.rejects(pickStatementFile()); assert.equal(globalThis.deletedFiles.length,3);
});
test('bank identity is hashed rather than persisting raw account numbers',async()=>{
 assert.match(await statementBankScope('bank:1234:987654','ofx'),/^[a-f0-9]{64}$/);
 assert.equal(await statementBankScope(null,'csv'),'csv:unspecified');
});


test('PDF is extracted locally without text decoding, hashed and cleaned up',async()=>{
 globalThis.pickerResult.assets[0].name='extrato.PDF';
 globalThis.statementBytes=new Uint8Array([0x25,0x50,0x44,0x46,0xff]);
 const result=await pickStatementFile();
 assert.equal(result.format,'pdf');assert.equal(result.text,'');assert.equal(result.pdf.pages.length,1);
 assert.equal(result.hash.length,64);assert.equal(globalThis.extractedPdfUri,'file:///cache/picker/file.csv');
 assert.deepEqual(globalThis.deletedFiles,['file:///cache/picker/file.csv']);
});

test('older development builds keep OFX/CSV usable and explain missing PDF support',async()=>{
 globalThis.pdfNativeModule=null;
 assert.equal((await pickStatementFile()).format,'csv');
 globalThis.pickerResult.assets[0].name='extrato.pdf';
 await assert.rejects(pickStatementFile(),/development build Android/);
 assert.equal(globalThis.deletedFiles.length,2);
});

test('password, image-only and corrupt PDFs never expose native content or leave cache copies',async()=>{
 globalThis.pickerResult.assets[0].name='extrato.pdf';
 for(const code of ['ERR_STATEMENT_PDF_PROTECTED','ERR_STATEMENT_PDF_NO_TEXT','ERR_STATEMENT_PDF_INVALID']){
  globalThis.pdfNativeModule={extractTextAsync:async()=>{throw Object.assign(new Error('PRIVATE CONTENT AND PATH'),{code});}};
  await assert.rejects(pickStatementFile(),error=>!error.message.includes('PRIVATE')&&!error.cause);
 }
 assert.equal(globalThis.deletedFiles.length,3);
 globalThis.pdfPlatform='ios';await assert.rejects(pickStatementFile(),/development build Android/);
});
