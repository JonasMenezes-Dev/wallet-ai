import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { emptyTransactionFilters, filterTransactions } from '../src/types/transaction-filters.ts';

const require = createRequire(import.meta.url);
function panel(initial = {}) {
  const file = new URL('../src/components/TransactionFilterPanel.tsx', import.meta.url);
  assert.ok(existsSync(file), 'The transaction filter panel must exist');
  const slots = [];
  let cursor = 0;
  const effects = [];
  const deps = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
      useEffect(fn, values) { const i = cursor++; if (!slots[i] || values.some((v,j) => v !== slots[i][j])) { slots[i] = values; effects.push(fn); } },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'View', StyleSheet: { create: s => s } },
    '../theme': { spacing: { sm: 8, lg: 16 }, typography: { family: { bold: 'Inter-Bold' } } },
    '../types/transaction-filters': { emptyTransactionFilters },
    './PremiumSheet': { PremiumSheet: 'Sheet' },
    './AppSelector': { AppSelector: 'Selector' },
    './AppText': { AppText: 'Text' },
    './AppField': { AppField: 'Field' },
    './AppButton': { AppButton: 'Button' },
  };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require','module','exports',compiled)(n => { assert.ok(n in deps, `Unexpected import: ${n}`); return deps[n]; }, module, module.exports);
  const applied = [], closes = [];
  let props = { visible: true, filters: { ...emptyTransactionFilters, search: 'Pix', ...initial }, accounts: [{ id: 1, name: 'Banco', type: 'bank' }, { id: 2, name: 'Cartão', type: 'credit_card' }], categories: [{ id: 3, name: 'Outros' }], onApply: f => applied.push(f), onClose: () => closes.push(true) };
  function visit(node) {
    if (Array.isArray(node)) return node.flatMap(visit);
    if (!node?.props) return [];
    return [node, ...visit(node.props.children), ...visit(node.props.footer)];
  }
  function nodes() { cursor = 0; const result = module.exports.TransactionFilterPanel(props); effects.splice(0).forEach(fn => fn()); return visit(result); }
  return { applied, closes, nodes, setProps(patch) { props = { ...props, ...patch }; },
    choose(label, value) { const node = nodes().find(n => n.type === 'Selector' && n.props.accessibilityLabel === label); assert.ok(node, label); node.props.onChange(value); },
    press(label) { const node = nodes().find(n => n.type === 'Button' && n.props.label === label); assert.ok(node,label); node.props.onPress(); },
  };
}

test('filter choices remain drafts until Apply and retain search and combined constraints', () => {
  const p = panel();
  p.choose('Tipo de transação', 'transfer');
  p.choose('Período', 'month');
  p.choose('Origem', 'automatic');
  p.choose('Conta', 1);
  p.choose('Categoria', 3);
  assert.equal(p.applied.length, 0);
  p.press('Aplicar filtros');
  assert.deepEqual(p.applied[0], { ...emptyTransactionFilters, search: 'Pix', type: 'transfer', period: 'month', origin: 'automatic', accountId: 1, categoryId: 3 });
});

test('closing discards draft and reopening restores the applied filters', () => {
  const p = panel({ type: 'income' });
  p.choose('Tipo de transação', 'expense');
  p.nodes().find(n => n.type === 'Sheet').props.onClose();
  assert.equal(p.applied.length, 0);
  p.setProps({ visible: false }); p.nodes();
  p.setProps({ visible: true }); p.nodes();
  assert.equal(p.nodes().find(n => n.props.accessibilityLabel === 'Tipo de transação').props.value, 'income');
});

test('clear resets all filters and only commits on Apply', () => {
  const p = panel({ type: 'transfer', cardId: 2, categoryId: 3 });
  p.press('Limpar filtros');
  assert.equal(p.applied.length, 0);
  p.press('Aplicar filtros');
  assert.deepEqual(p.applied[0], emptyTransactionFilters);
});

test('invalid custom dates do not apply and valid dates preserve an inclusive range', () => {
  const p = panel({ search: '' });
  p.choose('Período', 'custom');
  const fill = (label, value) => p.nodes().find(n => n.type === 'Field' && n.props.label === label).props.onChangeText(value);
  fill('Data inicial', '2026-02-30');
  p.press('Aplicar filtros');
  assert.equal(p.applied.length, 0);
  fill('Data inicial', '2026-10-20'); fill('Data final', '2026-10-21');
  p.press('Aplicar filtros');
  assert.equal(p.applied[0].from, '2026-10-20');
  assert.equal(p.applied[0].to, '2026-10-21');
  const rows = [{ id: 1, type: 'transfer', amount: 3, accountId: 2, counterpartyAccountId: 1, categoryId: 3, date: '2026-10-21T23:59:59' }, { id: 2, type: 'expense', amount: 8, accountId: 1, categoryId: 3, date: '2026-10-22' }];
  assert.deepEqual(filterTransactions(rows, p.applied[0]).map(t => t.id), [1]);
});
