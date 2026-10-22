import assert from 'node:assert/strict';
import { test,before,beforeEach,after } from 'node:test';
import { database,closeDatabase } from './helpers/sqlite.mjs';
import { createStatementScreen } from './helpers/statement-screen.mjs';
const {getDatabase}=await import('../src/database/database.ts');
const {getAllAccounts}=await import('../src/repositories/account.repository.ts');
const {getAllCategories}=await import('../src/repositories/category.repository.ts');
const parsers=await import('../src/services/statement-parsers.ts');
const service=await import('../src/services/statement-import.service.ts');
before(getDatabase);after(closeDatabase);
beforeEach(()=>database.native.exec(`DELETE FROM statement_import_receipts;DELETE FROM statement_category_rules;DELETE FROM transactions;DELETE FROM goals;DELETE FROM accounts;
 INSERT INTO accounts(id,name,type,balance,created_at,updated_at)VALUES(1,'Banco','bank',100,'old','old');`));
async function screen(text='Data;Descrição;Valor\n22/10/2026;Compra débito supermercado Central;-12,50'){
 const ui=createStatementScreen({accounts:await getAllAccounts(),categories:await getAllCategories(),file:{format:'csv',text,hash:'a'.repeat(64),name:'sintetico.csv'},parsers,service});
 ui.nodes();await ui.settle();return ui;
}
async function preview(ui){ui.selector('Conta do extrato').props.onChange(1);await ui.press('Selecionar arquivo OFX/CSV/PDF');await ui.press('Confirmar conta/mapeamento e preparar prévia');}
test('CSV account/mapping/review requires currency and final confirmation before any write',async()=>{
 const ui=await screen();await preview(ui);
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
 assert.equal(ui.button('Revisar e confirmar 1 selecionadas').props.disabled,true);
 await ui.press('Confirmo que os valores estão em BRL');await ui.press('Revisar e confirmar 1 selecionadas');
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
 ui.alerts.at(-1)[2].find(button=>button.text==='Confirmar e salvar').onPress();await ui.settle();
 assert.equal(database.native.prepare('SELECT balance FROM accounts').get().balance,87.5);
 assert.ok(ui.nodes().some(node=>node.props.children==='Importação concluída'));
});
test('ambiguous Pix requires individual resolution; edit and multi-selection are applied only to preview',async()=>{
 const ui=await screen('Data;Descrição;Valor\n22/10/2026;Pix recebido Maria;10,00');await preview(ui);
 assert.ok(ui.button('Revisar e confirmar 0 selecionadas').props.disabled);
 await ui.press('Revisar e editar');ui.selector('Natureza financeira').props.onChange('income');
 ui.field('Descrição').props.onChangeText('Reembolso pessoal confirmado');await ui.press('Aplicar à prévia');
 assert.ok(ui.button('Revisar e confirmar 1 selecionadas'));
 await ui.press('Desmarcar todas');assert.ok(ui.button('Revisar e confirmar 0 selecionadas'));
 await ui.press('Selecionar todas as resolvidas sem duplicidade');assert.ok(ui.button('Revisar e confirmar 1 selecionadas'));
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
});
test('duplicate appearing after preview returns to an editable review instead of an unresolvable failure',async()=>{
 const ui=await screen();await preview(ui);await ui.press('Confirmo que os valores estão em BRL');
 database.native.exec(`INSERT INTO transactions(amount,type,description,date,account_id,created_at,updated_at)VALUES(12.5,'expense','Compra débito supermercado Central','2026-10-22',1,'old','old')`);
 await ui.press('Revisar e confirmar 1 selecionadas');ui.alerts.at(-1)[2].find(button=>button.text==='Confirmar e salvar').onPress();await ui.settle();
 await ui.press('Revisar e editar');
 assert.ok(ui.button('Confirmar que esta operação semelhante é distinta'));
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,1);
});

test('PDF review shows extraction summary and requires acknowledgement before final save',async()=>{
 const {syntheticItauPdf}=await import('./fixtures/statements/synthetic-itau-pdf.mjs');
 const ui=createStatementScreen({accounts:await getAllAccounts(),categories:await getAllCategories(),
  file:{format:'pdf',pdf:syntheticItauPdf,hash:'b'.repeat(64),name:'sintetico.pdf'},parsers,service});
 ui.nodes();await ui.settle();await preview(ui);
 const text=ui.nodes().filter(node=>node.type==='AppText').map(node=>
  Array.isArray(node.props.children)?node.props.children.join(''):String(node.props.children)).join('\n');
 assert.match(text,/6 movimentações em 1 páginas/);
 assert.match(text,/2026-03-01 a 2026-03-31/);
 assert.match(text,/2 linhas de saldo ignoradas/);
 const confirm=ui.nodes().find(node=>node.type==='AppButton'&&node.props.label.startsWith('Revisar e confirmar'));
 assert.ok(confirm);assert.equal(confirm.props.disabled,true);
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
 await ui.press('Conferi a extração e as linhas ignoradas do PDF');
 assert.equal(ui.button(confirm.props.label).props.disabled,false);
 await ui.press(confirm.props.label);
 assert.equal(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n,0);
 ui.alerts.at(-1)[2].find(button=>button.text==='Confirmar e salvar').onPress();await ui.settle();
 assert.ok(database.native.prepare('SELECT COUNT(*) n FROM transactions').get().n>0);
 assert.ok(ui.nodes().some(node=>node.props.children==='Importação concluída'));
});
