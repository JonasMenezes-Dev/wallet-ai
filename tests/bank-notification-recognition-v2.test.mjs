import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretBankNotification, createBankNotificationEngine } from '../src/notifications/bank-notification-engine.ts';

// Synthetic language fixtures: these do not claim a bank or wallet publishes this format.
const parse = (text, patch = {}) => interpretBankNotification({
  packageName: 'com.ficticio.banco', title: 'Movimentação', text,
  notificationId: 'synthetic-v2', postedAt: 1792537412345, ...patch,
});

for (const [text, operation, direction, amountCents, paymentMethod, paymentChannel] of [
  ['Compra autorizada no cartão de débito por aproximação de R$ 23,45', 'debit_purchase', 'outgoing', 2345, 'debit', 'contactless'],
  ['Compra no crédito aprovada via NFC de R$ 19,99', 'credit_purchase', 'outgoing', 1999, 'credit', 'contactless'],
  ['Compra online confirmada no crédito de R$ 150,10', 'credit_purchase', 'outgoing', 15010, 'credit', 'online'],
  ['Compra presencial aprovada no débito de R$ 7,50', 'debit_purchase', 'outgoing', 750, 'debit', 'in_person'],
  ['Você comprou no crédito pela internet por R$ 99,90', 'credit_purchase', 'outgoing', 9990, 'credit', 'online'],
  ['Pix creditado na sua conta de R$ 8,01', 'pix', 'incoming', 801, null, null],
  ['Pix debitado da sua conta de R$ 8,01', 'pix', 'outgoing', 801, null, null],
  ['Pix recebido de BRL 8,01', 'pix', 'incoming', 801, null, null],
  ['Você transferiu R$ 45,00 para Pessoa Fictícia', 'transfer', 'outgoing', 4500, null, null],
  ['Transferência creditada em conta de R$ 45,00', 'transfer', 'incoming', 4500, null, null],
  ['Estorno realizado da compra no crédito de R$ 50,00', 'refund', 'incoming', 5000, 'credit', null],
  ['Compra no débito estornada de R$ 12,30', 'refund', 'incoming', 1230, 'debit', null],
  ['Reembolso recebido de R$ 12,30', 'refund', 'incoming', 1230, null, null],
  ['Devolução de Pix recebida de R$ 12,30', 'refund', 'incoming', 1230, null, null],
  ['Devolução de Pix enviada de R$ 12,30', 'refund', 'outgoing', 1230, null, null],
]) test(`recognition v2 interprets explicit completed movement: ${text}`, () => {
  const result = parse(text);
  assert.equal(result.status, 'recognized');
  assert.equal(result.operation, operation);
  assert.equal(result.direction, direction);
  assert.equal(result.amountCents, amountCents);
  assert.equal(result.paymentMethod, paymentMethod);
  assert.equal(result.paymentChannel, paymentChannel);
  assert.equal(result.date, '2026-10-20T23:03:32.345Z');
  assert.equal(result.dateSource, 'notification');
});

for (const text of [
  'Seu código de verificação é 123456. Compra no crédito aprovada de R$ 20,00',
  'OTP 123456 para Pix enviado de R$ 20,00',
  'Token de segurança 123456. Pix enviado de R$ 20,00',
  'Senha temporária 123456 para pagamento efetuado de R$ 20,00',
  'Código: 123456 para compra no débito aprovada de R$ 20,00',
  'Seu código é 123456 para Pix enviado de R$ 20,00',
  'Código de uso único 123456 para Pix enviado de R$ 20,00',
  'PIN 1234 para compra no crédito aprovada de R$ 20,00',
  'Confirme a compra no crédito aprovada de R$ 20,00',
  'Autorize o Pix enviado de R$ 20,00',
  'Pedido de estorno recebido de R$ 20,00',
  'Compra no crédito aprovada de R$ 20,00 em análise',
  'Pix enviado de R$ 20,00 será estornado amanhã',
  'Compra no débito aprovada de R$ 20,00 sem sucesso',
  'Compra no crédito aprovada de R$ 20,00 não concluída',
  'Estorno de R$ 20,00 solicitado',
  'Receba um Pix de R$ 20,00 para ganhar cashback',
]) test(`recognition v2 ignores secrets or incomplete movement: ${text}`, () => {
  const result = parse(text);
  assert.equal(result.status, 'ignored');
  assert.equal(result.amountCents, null);
  assert.equal(result.operation, null);
  assert.equal(result.direction, null);
});

for (const text of [
  'Compra no crédito aprovada de R$ 20,00 e US$ 4,00',
  'Compra no crédito aprovada de R$ 20,00 (USD 4)',
  'Compra no crédito aprovada de R$ 20,00 ($ 4)',
  'Compra no crédito aprovada de € 20,00',
  'Pix enviado de BRL 20,00 e R$ 20,00',
  'Pix enviado de R$ 20,00. Total 30,00',
  'Pix enviado de R$ 20,00 e 30,00',
  'Pix enviado de R$ 20,00; tarifa 1,00',
  'Pix enviado de R$ 20,00; taxa de R$ 1,00',
  'Compra no crédito aprovada de R$ 20,00 online e presencial',
  'Pix enviado recebido de R$ 20,00',
  'Devolução de Pix concluída de R$ 20,00',
  'Compra aprovada por aproximação de R$ 20,00',
  'Compra no crédito de R$ 20,00',
]) test(`recognition v2 leaves conflicting or insufficient evidence pending: ${text}`, () => {
  assert.equal(parse(text).status, 'pending');
});

test('recognition v2 never infers card method or channel from source or merchant', () => {
  const result = parse('Compra no crédito aprovada de R$ 20,00 em Loja Fictícia');
  assert.equal(result.status, 'recognized');
  assert.equal(result.paymentChannel, null);
  assert.equal(result.paymentMethod, 'credit');
  for (const input of [{}, { title: 'Novo pagamento', text: 'Conteúdo oculto' }]) {
    const hidden = interpretBankNotification(input);
    assert.notEqual(hidden.status, 'recognized');
    assert.equal(hidden.amountCents, null);
    assert.equal(hidden.operation, null);
    assert.equal(hidden.paymentChannel, null);
    assert.equal(hidden.paymentMethod, null);
  }
});

test('recognition v2 removes security challenge descriptions from interpretation', () => {
  const result = parse('Código de verificação 123456 para Pix enviado de R$ 20,00');
  assert.equal(result.reason, 'sensitive_content');
  assert.equal(result.description, '');
});

test('recognition v2 equal amounts at separate sources are not classified as duplicates', () => {
  const engine = createBankNotificationEngine();
  const input = { text: 'Compra no crédito aprovada via NFC de R$ 20,00', notificationId: 'same', postedAt: 1000 };
  assert.equal(engine.process({ ...input, packageName: 'com.ficticio.banco' }).status, 'recognized');
  assert.equal(engine.process({ ...input, packageName: 'com.ficticio.wallet' }).status, 'recognized');
});
