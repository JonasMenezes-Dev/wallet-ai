import assert from 'node:assert/strict';
import { test, before, beforeEach, after } from 'node:test';
import { database, closeDatabase } from './helpers/sqlite.mjs';
import { createAccountsScreen } from './helpers/accounts-screen.mjs';

const { getDatabase } = await import('../src/database/database.ts');
const { getAllAccounts } = await import('../src/repositories/account.repository.ts');
const { payCreditCard } = await import('../src/services/transaction.service.ts');
before(async () => { await getDatabase(); });
after(closeDatabase);
beforeEach(() => {
  database.native.exec(`DELETE FROM transactions; DELETE FROM monthly_budgets; DELETE FROM goals; DELETE FROM accounts;
    INSERT INTO accounts (id, name, type, balance, created_at, updated_at) VALUES
    (1, 'Banco', 'bank', 100, 'old', 'old'), (2, 'Dinheiro', 'cash', 50, 'old', 'old'),
    (3, 'Cartão A', 'credit_card', 60, 'old', 'old'), (4, 'Cartão B', 'credit_card', 20, 'old', 'old');`);
});

async function screen(options = {}) {
  const calls = [];
  let reloads = 0;
  const ui = createAccountsScreen({ accounts: await getAllAccounts(),
    reload: async () => { reloads++; return getAllAccounts(); },
    payCreditCard: async input => { calls.push(input); await options.wait; return payCreditCard(input); },
  });
  return { ui, calls, reloads: () => reloads };
}
function open(ui, index = 0) {
  const button = ui.buttons('Pagar cartão')[index];
  assert.ok(button, 'A card needs its payment action');
  button.props.onPress();
}
function amount(ui, value) {
  const input = ui.input('Valor do pagamento');
  assert.ok(input, 'Payment amount must be editable');
  input.props.onChangeText(value);
}
const balances = () => database.native.prepare('SELECT balance FROM accounts ORDER BY id').all().map(row => row.balance);

test('card payment uses the selected source and card, refreshes balances and reports success', async () => {
  const { ui, calls, reloads } = await screen();
  open(ui, 1);
  assert.equal(ui.buttons('Cartão A').length, 0);
  assert.equal(ui.buttons('Cartão B').length, 0);
  ui.buttons('Dinheiro')[0].props.onPress();
  amount(ui, '12,50');
  await ui.buttons('Confirmar pagamento')[0].props.onPress();
  assert.deepEqual(calls.map(c => [c.fromAccountId, c.toAccountId, c.amount]), [[2, 4, 12.5]]);
  assert.deepEqual(balances(), [100, 37.5, 60, 7.5]);
  assert.equal(reloads(), 1);
  const list = ui.nodes().find(node => node.type === 'FlatList');
  assert.equal(list.props.data.find(a => a.id === 4).balance, 7.5);
  assert.equal(ui.buttons('Confirmar pagamento').length, 0);
  assert.match(ui.alerts.at(-1)[0], /sucesso|realizado/i);
});

test('an immediate double press makes one service call and disables pending actions', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const { ui, calls } = await screen({ wait });
  open(ui);
  amount(ui, '25,00');
  const submit = ui.buttons('Confirmar pagamento')[0].props.onPress;
  const first = submit();
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(ui.buttons('Processando...')[0].props.disabled, true);
  assert.equal(ui.buttons('Cancelar pagamento')[0].props.disabled, true);
  release();
  await first;
  assert.deepEqual(balances(), [75, 50, 35, 20]);
});

test('overpayment and insufficient funds show service errors and keep balances unchanged', async () => {
  const { ui, reloads } = await screen();
  open(ui);
  amount(ui, '61,00');
  await ui.buttons('Confirmar pagamento')[0].props.onPress();
  assert.match(ui.alerts.at(-1)[0], /não foi possível/i);
  assert.deepEqual(balances(), [100, 50, 60, 20]);
  ui.buttons('Dinheiro')[0].props.onPress();
  amount(ui, '55,00');
  await ui.buttons('Confirmar pagamento')[0].props.onPress();
  assert.deepEqual(balances(), [100, 50, 60, 20]);
  assert.equal(reloads(), 0);
  assert.equal(ui.buttons('Confirmar pagamento')[0].props.disabled, false);
});

test('invalid amounts and cancelling do not submit a payment', async () => {
  const { ui, calls } = await screen();
  open(ui);
  for (const value of ['', '0', '-1', 'abc', 'Infinity']) {
    amount(ui, value);
    await ui.buttons('Confirmar pagamento')[0].props.onPress();
  }
  assert.equal(calls.length, 0);
  ui.buttons('Cancelar pagamento')[0].props.onPress();
  assert.equal(ui.buttons('Confirmar pagamento').length, 0);
  assert.deepEqual(balances(), [100, 50, 60, 20]);
});

test('a card without an eligible payer cannot submit a payment', async () => {
  database.native.exec('DELETE FROM accounts WHERE id IN (1, 2)');
  const { ui, calls } = await screen();
  open(ui);
  assert.equal(ui.buttons('Confirmar pagamento')[0].props.disabled, true);
  await ui.buttons('Confirmar pagamento')[0].props.onPress();
  assert.equal(calls.length, 0);
});

test('the card creation form scrolls with the list above the tab bar and keyboard', async () => {
  const { ui } = await screen();
  ui.buttons('+ Conta')[0].props.onPress();
  ui.buttons('Cartão')[0].props.onPress();
  const nodes = ui.nodes();
  const keyboard = nodes.find(node => node.type === 'KeyboardAvoidingView');
  assert.equal(keyboard.props.behavior, 'padding');
  const list = nodes.find(node => node.type === 'FlatList');
  assert.equal(list.props.keyboardShouldPersistTaps, 'handled');
  assert.equal(list.props.contentContainerStyle.at(-1).paddingBottom, 118);
  const form = list.props.ListHeaderComponent.props.children.find(node => node?.type === 'FadeInView');
  assert.ok(form, 'The creation form must be inside the scrolling content');
  assert.ok(form.props.children.some(node => node?.type === 'AnimatedPressable' && node.props.children?.props.children === 'Criar conta'));
});
