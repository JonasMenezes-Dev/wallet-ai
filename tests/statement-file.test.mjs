import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { registerHooks } from 'node:module';
import { closeDatabase } from './helpers/sqlite.mjs';
registerHooks({
  resolve(name, context, next) {
    if (['expo-document-picker','expo-file-system','expo-crypto'].includes(name)) return { url:`test:${name}`,shortCircuit:true };
    return next(name,context);
  },
  load(url,context,next) {
    const modules={
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
 globalThis.pickerResult.assets[0].name='wrong.pdf';
 await assert.rejects(pickStatementFile()); assert.deepEqual(globalThis.deletedFiles,[]);
});
test('invalid extensions, oversized files and decoding failures still clean up cache',async()=>{
 globalThis.pickerResult.assets[0].name='wrong.pdf'; await assert.rejects(pickStatementFile());
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
