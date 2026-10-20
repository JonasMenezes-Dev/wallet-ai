import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Exercise the actual screen and handlers without installing a native renderer.
// Only native views, React hook scheduling and navigation-bound data loading are replaced.
export function createAccountsScreen({ accounts, reload, payCreditCard }) {
  const hooks = [];
  const alerts = [];
  let cursor = 0;
  const state = { accounts, loading: false, error: null, reload: async () => { state.accounts = await reload(); } };
  const React = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in hooks)) hooks[slot] = initial;
      return [hooks[slot], value => { hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in hooks)) hooks[slot] = { current: initial };
      return hooks[slot];
    },
  };
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'KeyboardAvoidingView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  native.Platform = { OS: 'ios' };
  native.Alert = { alert: (...args) => alerts.push(args) };
  native.StyleSheet = { create: styles => styles };
  const dependencies = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': native,
    'expo-router/js-tabs': { useBottomTabBarHeight: () => 100 },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    '../../src/hooks/use-accounts': { useAccounts: () => state },
    '../../src/services/transaction.service': { payCreditCard },
    '../../src/services/account.service': {},
    '../../src/components/AnimatedListItem': { AnimatedListItem: 'AnimatedListItem', FadeInView: 'FadeInView' },
    '../../src/components/AnimatedPressable': { AnimatedPressable: 'AnimatedPressable' },
    '../../src/components/CreditCardSummary': { CreditCardSummary: 'CreditCardSummary', formatCurrency: value => `R$ ${value.toFixed(2)}` },
    '../../src/components/ScreenHeader': { ScreenHeader: 'ScreenHeader' },
    '../../src/theme': { useThemedStyles: create => create({}), useThemeColors: () => ({}) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../../app/(tabs)/accounts.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected screen dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  const nodes = () => {
    cursor = 0;
    const result = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object' || !node.props) return;
      result.push(node);
      visit(node.props.children);
      visit(node.props.accessory);
      visit(node.props.ListHeaderComponent);
      if (node.type === 'FlatList') node.props.data.forEach((item, index) => visit(node.props.renderItem({ item, index })));
    }
    visit(module.exports.default());
    return result;
  };
  const text = node => {
    if (typeof node === 'boolean' || node == null) return '';
    if (Array.isArray(node)) return node.map(text).join('');
    return node?.props ? text(node.props.children) : String(node ?? '');
  };
  return { alerts, nodes,
    buttons(label) { return nodes().filter(node => node.type === 'AnimatedPressable' && text(node) === label); },
    input(label) { return nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label); },
  };
}
