import assert from 'node:assert/strict';
import test from 'node:test';

// Load dynamically so missing engine behavior is reported as a test failure.
const engine = () => import('../src/notifications/bank-notification-engine.ts');
const input = (text, patch = {}) => ({ packageName: 'com.ficticio.banco',
  title: 'Movimentação', text, notificationId: 'ficticia-1', ...patch });

for (const [text, operation, direction, amountCents] of [
  ['Pix enviado de R$ 25,90', 'pix', 'outgoing', 2590],
  ['Você recebeu um Pix de R$ 1.234,56', 'pix', 'incoming', 123456],
  ['Compra no débito aprovada de R$ 0,01 em Loja Fictícia', 'debit_purchase', 'outgoing', 1],
  ['Compra aprovada no crédito de R$ 50,00 em Loja Fictícia', 'credit_purchase', 'outgoing', 5000],
  ['Transferência enviada de R$ 100,00', 'transfer', 'outgoing', 10000],
  ['Transferência recebida de R$ 100,00', 'transfer', 'incoming', 10000],
  ['Transferência entre suas contas concluída de R$ 100,00', 'own_account_transfer', 'internal', 10000],
  ['Pix enviado para sua outra conta de R$ 100,00', 'own_account_transfer', 'internal', 10000],
  ['Pagamento efetuado de R$ 20,00', 'payment', 'outgoing', 2000],
  ['Pagamento da fatura realizado de R$ 20,00', 'payment', 'outgoing', 2000],
  ['Pagamento recebido de R$ 20,00', 'receipt', 'incoming', 2000],
  ['Recebimento realizado de R$ 20,00', 'receipt', 'incoming', 2000],
  ['Pagamento via Pix realizado de R$ 25,90', 'pix', 'outgoing', 2590],
]) test(`recognizes fictional movement: ${text}`, async () => {
  const { interpretBankNotification } = await engine();
  const result = interpretBankNotification(input(text));
  assert.equal(result.status, 'recognized');
  assert.equal(result.operation, operation);
  assert.equal(result.direction, direction);
  assert.equal(result.amountCents, amountCents);
  assert.equal('accountId' in result, false);
  assert.equal('destinationAccountId' in result, false);
  assert.ok(result.description.length > 0);
});

for (const text of [
  'Oferta: ganhe R$ 100,00 ao enviar um Pix',
  'Limite disponível de R$ 1.000,00',
  'Sua fatura de R$ 120,00 vence amanhã. Pague agora',
  'Cobrança recebida: pague R$ 20,00',
  'Pix agendado de R$ 20,00',
  'Pagamento de R$ 20,00 em processamento',
  'Compra no crédito recusada de R$ 20,00',
  'Pix não realizado de R$ 20,00',
  'Aguardando confirmação do pagamento de R$ 20,00',
  'Saldo disponível R$ 100,00',
  'Seu Pix será enviado amanhã no valor de R$ 20,00',
  'Solicitação de Pix recebido de R$ 20,00',
  'Pix enviado: não foi possível concluir a movimentação de R$ 20,00',
]) test(`ignores a non-movement: ${text}`, async () => {
  const { interpretBankNotification } = await engine();
  assert.equal(interpretBankNotification(input(text)).status, 'ignored');
});

for (const text of [
  'Compra aprovada de R$ 20,00',
  'Pix de R$ 20,00',
  'Transferência concluída de R$ 20,00',
  'Pix enviado de R$ 20,00. Saldo R$ 80,00',
  'Pix enviado de R$ 20,00. Saldo disponível 80,00',
  'Pix enviado e Pix recebido de R$ 20,00',
  'Pix enviado de R$ 1,234.56',
  'Pix enviado de R$ 20.50',
  'Pix enviado de R$ 0,001',
  'Pix enviado de R$ 0,00',
  'Pix enviado de R$ -20,00',
  'Pix enviado sem valor informado',
  'Você recebeu um Pix de R$ 20,00?',
  'Pix enviado e compra no crédito aprovada de R$ 20,00',
  'Recebimento de R$ 20,00',
]) test(`requests confirmation for ambiguous content: ${text}`, async () => {
  const { interpretBankNotification } = await engine();
  assert.equal(interpretBankNotification(input(text)).status, 'pending');
});

test('normalizes Brazilian monetary formats using integer cents', async () => {
  const { interpretBankNotification } = await engine();
  for (const [raw, want] of [['1.234', 123400], ['1.234,5', 123450], ['25', 2500], ['0,10', 10]]) {
    assert.equal(interpretBankNotification(input(`Pix enviado de R$ ${raw}`)).amountCents, want);
  }
  assert.equal(interpretBankNotification(input('Pix enviado de R$ 999.999.999.999.999,99')).status, 'pending');
});

test('extracts explicit dates, preserves timestamp provenance and never invents today', async () => {
  const { interpretBankNotification } = await engine();
  const result = interpretBankNotification(input('Pix enviado de R$ 25,90 em 29/02/2028 às 14:35'));
  assert.equal(result.date, '2028-02-29');
  assert.equal(result.time, '14:35');
  assert.equal(result.dateSource, 'message');
  const fallback = interpretBankNotification(input('Pix enviado de R$ 25,90', { postedAt: 0 }));
  assert.equal(fallback.date, '1970-01-01T00:00:00.000Z');
  assert.equal(fallback.dateSource, 'notification');
  assert.equal(interpretBankNotification(input('Pix enviado de R$ 25,90')).date, null);
  for (const date of ['29/02/2027', '31/04/2028', '01/01/2028 e 02/01/2028']) {
    assert.equal(interpretBankNotification(input(`Pix enviado de R$ 25,90 em ${date}`)).status, 'pending');
  }
});

test('does not infer an own-account transfer from a named beneficiary', async () => {
  const { interpretBankNotification } = await engine();
  const result = interpretBankNotification(input('Pix enviado para Pessoa Fictícia de R$ 20,00'));
  assert.equal(result.operation, 'pix');
  assert.equal(result.direction, 'outgoing');
});

test('handles missing metadata without guessing a source, operation or date', async () => {
  const { interpretBankNotification } = await engine();
  const result = interpretBankNotification({ text: 'Pix recebido de R$ 20,00' });
  assert.equal(result.packageName, null);
  assert.equal(result.notificationId, null);
  assert.equal(result.date, null);
  assert.equal(result.status, 'pending');
  assert.equal(interpretBankNotification({}).status, 'ignored');
});

test('deduplicates normalized source/id/content and accepts changed or distinct notifications', async () => {
  const { createBankNotificationEngine } = await engine();
  const parser = createBankNotificationEngine();
  const original = input('Pix enviado de R$ 20,00');
  assert.equal(parser.process(original).status, 'recognized');
  assert.equal(parser.process({ ...original, text: '  PIX enviado de R$ 20,00  ' }).status, 'duplicate');
  assert.equal(parser.process({ ...original, packageName: 'com.outro.ficticio' }).status, 'recognized');
  assert.equal(parser.process({ ...original, text: 'Pix enviado de R$ 30,00' }).status, 'recognized');
  assert.equal(parser.process({ ...original, notificationId: 'ficticia-2' }).status, 'recognized');
});

test('deduplicates content without an id, distinguishing explicit notification timestamps', async () => {
  const { createBankNotificationEngine } = await engine();
  const parser = createBankNotificationEngine();
  const original = input('Pix recebido de R$ 20,00', { notificationId: null });
  assert.equal(parser.process(original).status, 'recognized');
  assert.equal(parser.process(original).status, 'duplicate');
  assert.equal(parser.process({ ...original, postedAt: 1000 }).status, 'recognized');
  assert.equal(parser.process({ ...original, postedAt: 2000 }).status, 'recognized');
});

test('deduplication memory is bounded and scoped to its engine instance', async () => {
  const { createBankNotificationEngine } = await engine();
  const parser = createBankNotificationEngine(1);
  const first = input('Pix recebido de R$ 20,00');
  parser.process(first);
  parser.process(input('Pix recebido de R$ 30,00'));
  assert.equal(parser.process(first).status, 'recognized');
  assert.equal(createBankNotificationEngine().process(first).status, 'recognized');
  assert.throws(() => createBankNotificationEngine(0));
});

test('reused notification ids do not hide a later identical movement with a different original timestamp', async () => {
  const { createBankNotificationEngine } = await engine();
  const parser = createBankNotificationEngine();
  const first = input('Pix recebido de R$ 20,00', { postedAt: 1000 });
  assert.equal(parser.process(first).status, 'recognized');
  assert.equal(parser.process(first).status, 'duplicate');
  assert.equal(parser.process({ ...first, postedAt: 2000 }).status, 'recognized');
});
