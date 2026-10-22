import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase } from './helpers/sqlite.mjs';
const { normalizeStatementDescription, identifyStatementRow, suggestImportCategory } = await import('../src/services/statement-rules.ts');
after(closeDatabase);
const row = (description, amountCents = -1000, typeHint = null) => ({ line: 1, bankId: null, date: '2026-10-01', amountCents, description, typeHint, errors: [] });
const names = ['Supermercado', 'Alimentação fora de casa', 'Transporte', 'Compras', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Assinaturas', 'Serviços', 'Transferências', 'Outros'];
const categories = names.map((name, i) => ({ id: i + 1, name, createdAt: '' }));

test('normalization folds accents/case and whitespace while preserving beneficiary numbers', () => {
  assert.equal(normalizeStatementDescription('  JOÃO\tSilva 123  '), 'joao silva 123');
  assert.notEqual(normalizeStatementDescription('João 123'), normalizeStatementDescription('João 456'));
});

test('Pix direction requires sign and stays unresolved for explicit review', () => {
  for (const [description, sign, operation] of [['Pix enviado João', -100, 'pix_sent'], ['Pix recebido Maria', 100, 'pix_received'], ['PIX Maria', 100, 'pix_received']]) {
    const actual = identifyStatementRow(row(description, sign), 'bank');
    assert.equal(actual.operation, operation);
    assert.equal(actual.suggestedResolution, 'unresolved');
  }
  assert.equal(identifyStatementRow(row('Pix recebido Maria', -100), 'bank').operation, 'unknown');
});

test('card bill and transfers never suggest a second expense or ordinary income', () => {
  for (const [description, operation] of [['Pagamento de fatura cartão', 'card_payment'], ['Transferência recebida João', 'transfer'], ['TED enviada Maria', 'transfer']]) {
    const actual = identifyStatementRow(row(description), 'bank');
    assert.equal(actual.operation, operation);
    assert.equal(actual.suggestedResolution, 'unresolved');
  }
});

test('purchases depend on account evidence and positive uncertain entries stay unresolved', () => {
  assert.equal(identifyStatementRow(row('Supermercado Central'), 'card').operation, 'credit_purchase');
  assert.equal(identifyStatementRow(row('Supermercado Central'), 'bank').operation, 'debit_purchase');
  assert.equal(identifyStatementRow(row('Mercado Central'), 'unknown').operation, 'unknown');
  assert.equal(identifyStatementRow(row('Compra débito Mercado Central'), 'unknown').operation, 'debit_purchase');
  for (const description of ['', 'Crédito recebido', 'João Silva']) {
    assert.equal(identifyStatementRow(row(description, 100), 'bank').suggestedResolution, 'unresolved');
  }
});

test('investments, withdrawals, balances, adjustments and loans never become consumption', () => {
  for (const accountKind of ['bank', 'card', 'unknown']) {
    for (const description of ['Aplicação CDB', 'Resgate investimento', 'Saque caixa 24h', 'Saldo inicial', 'Ajuste desconhecido', 'Pagamento empréstimo', 'Aplicação supermercado', 'Pagamento boleto financiamento']) {
      const actual = identifyStatementRow(row(description, -1000, 'DEBIT'), accountKind);
      assert.equal(actual.operation, 'unknown', `${accountKind}: ${description}`);
      assert.equal(actual.suggestedResolution, 'unresolved', `${accountKind}: ${description}`);
    }
  }
});

test('generic merchant text and generic debit hint do not establish a purchase', () => {
  for (const accountKind of ['bank', 'card', 'unknown']) {
    for (const description of ['João Silva', 'Mercado Central', 'ABC 123']) {
      assert.equal(identifyStatementRow(row(description, -1000, 'DEBIT'), accountKind).suggestedResolution, 'unresolved');
    }
  }
  assert.equal(identifyStatementRow(row('Compra Loja ABC'), 'bank').operation, 'debit_purchase');
  assert.equal(identifyStatementRow(row('Compra Loja ABC'), 'card').operation, 'credit_purchase');
  assert.equal(identifyStatementRow(row('Compra crédito Loja ABC'), 'bank').suggestedResolution, 'unresolved');
  assert.equal(identifyStatementRow(row('Compra débito Loja ABC'), 'card').suggestedResolution, 'unresolved');
  assert.equal(identifyStatementRow(row('Uber'), 'bank').operation, 'debit_purchase');
});

test('explicit operations respect signs and word boundaries', () => {
  for (const [description, amount, operation, resolution] of [['Tarifa manutenção', -100, 'fee', 'expense'], ['Estorno compra', 100, 'refund', 'refund'], ['Rendimento aplicação', 100, 'yield', 'income'], ['Pagamento boleto água', -100, 'bill_payment', 'expense']]) {
    const actual = identifyStatementRow(row(description, amount), 'bank');
    assert.equal(actual.operation, operation);
    assert.equal(actual.suggestedResolution, resolution);
  }
  assert.equal(identifyStatementRow(row('Estorno compra', -100), 'bank').operation, 'unknown');
  assert.equal(identifyStatementRow(row('Estorno compra', -100), 'bank').suggestedResolution, 'unresolved');
  assert.equal(identifyStatementRow(row('Estorno compra', 100), 'card').suggestedResolution, 'refund');
});

test('categories use conservative whole words and subscriptions precede shopping', () => {
  for (const [description, id] of [['Supermercado Central', 1], ['Restaurante Lago', 2], ['Uber', 3], ['Amazon Prime', 9], ['Amazon marketplace', 4], ['Barbosa Silva', 12], ['Clínica Vida', 6], ['Pix enviado João', 11]]) {
    assert.equal(suggestImportCategory(description, categories, []).categoryId, id, description);
  }
});

test('learned exact merchant correction wins without leaking across recipients or generic operations', () => {
  const key = suggestImportCategory('Compra débito Mercado São João 123', categories, []).merchantKey;
  assert.equal(key, 'mercado sao joao 123');
  const rules = [{ merchantKey: key, categoryId: 7 }];
  assert.equal(suggestImportCategory('COMPRA DÉBITO Mercado Sao Joao 123', categories, rules).categoryId, 7);
  assert.equal(suggestImportCategory('Compra débito Mercado São João 456', categories, rules).categoryId, 12);
  for (const description of ['', 'Pix', 'Compra débito', 'Pagamento', 'Transferência recebida', 'Tarifa']) {
    assert.equal(suggestImportCategory(description, categories, []).merchantKey, null, description);
  }
  assert.equal(suggestImportCategory('Amazon Prime', categories, [{ merchantKey: 'amazon prime', categoryId: 999 }]).categoryId, 9);
});

test('missing categories are never fabricated and input rules remain unchanged', () => {
  const rules = [{ merchantKey: 'loja abc', categoryId: 4 }];
  assert.equal(suggestImportCategory('Loja ABC', [], rules).categoryId, null);
  assert.deepEqual(rules, [{ merchantKey: 'loja abc', categoryId: 4 }]);
});

test('generic outgoing labels and non-merchant banking descriptions stay conservative', () => {
  for (const description of ['Débito', 'Crédito recebido', 'Pagamento', 'Transferência', 'Compra']) {
    const actual = identifyStatementRow(row(description), 'bank');
    if (description !== 'Transferência') assert.equal(actual.operation, 'unknown', description);
    assert.equal(actual.suggestedResolution, 'unresolved', description);
  }
  for (const description of ['Pagamento de fatura cartão', 'Tarifa manutenção', 'Rendimento aplicação', 'Pix enviado para', 'Transferência recebida de']) {
    assert.equal(suggestImportCategory(description, categories, []).merchantKey, null, description);
  }
});
