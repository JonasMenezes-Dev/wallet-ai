import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const colors = { primary: '#51D9A0', onPrimary: '#091611', surface: '#11241C', text: '#E9F7ED', textMuted: '#9BAFA3', expense: '#F18B91' };
let tokens = {};
tokens = load('../src/theme/tokens.ts');
function load(path, overrides = {}) {
  const url = new URL(path, import.meta.url);
  assert.ok(existsSync(url), `${path} must exist`);
  const native = Object.fromEntries(['Text', 'View', 'TextInput', 'ActivityIndicator'].map(n => [n, n]));
  native.StyleSheet = { create: value => value, absoluteFill: { position: 'absolute', inset: 0 } };
  const deps = {
    react: { useState: initial => [initial, () => {}], useId: () => 'field-1' },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': native,
    '../theme': { ...tokens, useThemeColors: () => colors },
    './AnimatedPressable': { AnimatedPressable: 'Pressable' },
    './WalletSymbol': { WalletSymbol: 'Symbol' },
    './AppText': { AppText: 'Text' },
    './AppButton': { AppButton: 'Button' },
    './AppCard': { AppCard: 'Card' },
    'expo-image': { Image: 'Image' },
    ...overrides,
  };
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name.endsWith('.svg')) return name;
    assert.ok(name in deps, `Unexpected dependency ${name}`);
    return deps[name];
  }, module, module.exports);
  return module.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node?.props) return [];
  return [node, ...nodes(node.props.children)];
}

test('loading and disabled buttons cannot invoke an action even through a captured handler', () => {
  const { AppButton } = load('../src/components/AppButton.tsx');
  let calls = 0;
  for (const flags of [{ loading: true }, { disabled: true }]) {
    const button = AppButton({ label: 'Salvar', onPress: () => calls++, ...flags });
    button.props.onPress?.();
    assert.equal(calls, 0);
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityState.disabled, true);
  }
  const ready = AppButton({ label: 'Salvar', onPress: () => calls++ });
  ready.props.onPress();
  assert.equal(calls, 1);
});

test('a field preserves monetary input and callbacks and exposes its error', () => {
  const { AppField } = load('../src/components/AppField.tsx');
  let value;
  const tree = nodes(AppField({ label: 'Valor', value: '1.234,50', error: 'Valor obrigatório', keyboardType: 'decimal-pad', onChangeText: next => { value = next; } }));
  const input = tree.find(n => n.type === 'TextInput');
  assert.equal(input.props.value, '1.234,50');
  assert.equal(input.props.accessibilityLabel, 'Valor');
  assert.equal(input.props.accessibilityHint, 'Valor obrigatório');
  input.props.onChangeText('0,05');
  assert.equal(value, '0,05');
  assert.ok(tree.some(n => n.props.accessibilityRole === 'alert'));
});

test('selectors retain typed values and block disabled options', () => {
  const { AppSelector } = load('../src/components/AppSelector.tsx');
  const selected = [];
  const tree = nodes(AppSelector({ value: 1, options: [{ label: 'Conta', value: 1 }, { label: 'Cartão', value: 2, disabled: true }, { label: 'Reserva', value: 3 }], onChange: value => selected.push(value), accessibilityLabel: 'Conta de origem' }));
  const options = tree.filter(n => n.props.accessibilityRole === 'radio');
  assert.equal(options[0].props.accessibilityState.checked, true);
  options[1].props.onPress?.();
  options[2].props.onPress();
  assert.deepEqual(selected, [3]);
});

test('ambient decoration is hidden from accessibility and never intercepts touches', () => {
  const { PremiumAmbient } = load('../src/components/PremiumAmbient.tsx');
  const tree = PremiumAmbient({ variant: 'subtle' });
  assert.equal(tree.props.pointerEvents, 'none');
  assert.equal(tree.props.accessibilityElementsHidden, true);
  assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
});

test('error and success states announce status and keep retry actions available', () => {
  const { AppState } = load('../src/components/AppState.tsx');
  for (const variant of ['error', 'success']) {
    const tree = nodes(AppState({ variant, title: 'Resultado', action: { label: 'Tentar novamente', onPress() {} } }));
    assert.ok(tree.some(n => n.props.accessibilityLiveRegion === 'polite'));
    assert.ok(tree.some(n => n.type === 'Button' && n.props.label === 'Tentar novamente'));
  }
});
