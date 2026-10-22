import type { Category } from '../types/category';
import type { ImportCategoryRule, ImportIdentification, StatementAccountKind, StatementRow } from '../types/statement-import';

export const IMPORT_CATEGORY_NAMES = ['Supermercado', 'Alimentação fora de casa', 'Transporte', 'Compras', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Assinaturas', 'Serviços', 'Transferências', 'Outros'] as const;

export function normalizeStatementDescription(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Strip only known leading operation labels. Keep every number and beneficiary token.
function merchantKeyFor(description: string): string | null {
  let key = normalizeStatementDescription(description);
  if (/^(?:pagamento|pgto|tarifa|taxa bancaria|anuidade|iof|rendimento|rendimentos|juros recebidos|estorno|reembolso|devolucao)\b/.test(key)) return null;
  key = key.replace(/^(?:compra(?: no)?(?: cartao)?(?: de)?(?: credito| debito)?|pix(?: enviado| enviada| recebido| recebida)?|transferencia(?: enviada| enviado| recebida| recebido)?|ted(?: enviada| recebido| recebida| enviado)?|doc(?: enviada| enviado| recebido| recebida)?)\b[\s:*\-]*/, '').trim();
  key = key.replace(/^(?:para|de)\b\s*/, '').trim();
  if (!/[a-z]{2}/.test(key)) return null;
  const generic = /^(?:pagamento(?: de)?(?: fatura| boleto| conta)?|tarifa(?: bancaria)?|compra|debito|credito|transferencia|pix|ted|doc|estorno|rendimento|saque|deposito|recebimento|enviado|recebido|cartao|fatura|boleto|outros|supermercado|restaurante|transporte|assinatura|servicos?)$/;
  return generic.test(key) ? null : key;
}

export function identifyStatementRow(row: StatementRow, accountKind: StatementAccountKind): ImportIdentification {
  const text = normalizeStatementDescription(row.description);
  const hint = normalizeStatementDescription(row.typeHint ?? '');
  const merchant = merchantKeyFor(row.description);
  const result = (operation: ImportIdentification['operation'], suggestedResolution: ImportIdentification['suggestedResolution'], reason: string): ImportIdentification => ({ operation, merchant, suggestedResolution, reason });
  const unknown = () => result('unknown', 'unresolved', 'Descrição ou direção insuficiente; revise o lançamento.');
  if (!text || !Number.isSafeInteger(row.amountCents) || row.amountCents === 0 || row.errors.length) return unknown();
  const outgoing = row.amountCents < 0;
  if (/\b(?:pagamento|pgto|pag)\b.*\b(?:fatura|cartao)\b|\bfatura\b.*\b(?:paga|pagamento|pgto)\b/.test(text)) {
    return result('card_payment', 'unresolved', 'Pagamento de fatura: confirme a conta e evite duplicar despesas.');
  }
  if (/\b(?:estorno|reembolso|devolucao)\b|\bpix\s+devol\b/.test(text)) return outgoing ? unknown() : result('refund', 'refund', 'Estorno ou devolução com valor recebido.');
  if (/\bpix\b/.test(text)) {
    if ((outgoing && /\b(?:recebid[oa]|entrada)\b/.test(text)) || (!outgoing && /\b(?:enviad[oa]|saida)\b/.test(text))) return unknown();
    return result(outgoing ? 'pix_sent' : 'pix_received', 'unresolved', 'Pix: confirme se é despesa, receita ou transferência própria.');
  }
  if (/\b(?:transferencia|ted|doc)\b/.test(text) || hint === 'xfer') return result('transfer', 'unresolved', 'Confirme se a transferência é entre contas próprias.');
  if (/\b(?:rendimento|rendimentos|juros recebidos)\b|\brend\s+pago\b/.test(text) || hint === 'int') return outgoing ? unknown() : result('yield', 'income', 'Rendimento com valor recebido.');
  if (/\b(?:aplicacao|aplicacoes|resgate|investimento|investimentos|cdb|rdb|lci|lca|saque|saldo inicial|ajuste|emprestimo|financiamento)\b/.test(text)) return unknown();
  if (/\b(?:tarifa|taxa bancaria|anuidade|iof)\b/.test(text) || hint === 'fee') return outgoing ? result('fee', 'expense', 'Tarifa explicitamente identificada.') : unknown();
  if (/\b(?:boleto|pagamento de conta|pagamento conta)\b/.test(text)) return outgoing ? result('bill_payment', 'expense', 'Pagamento de boleto ou conta.') : unknown();
  // Generic incoming entries never become salary/income automatically.
  if (!outgoing || !merchant || /^(?:debito|credito|compra|pagamento|lancamento)(?: recebido| recebida| enviado| enviada)?$/.test(text)) return unknown();
  const explicitDebit = /\b(?:compra|cartao)\b.*\bdebito\b|\bdebito\b.*\bcartao\b/.test(text);
  const explicitCredit = /\b(?:compra|cartao)\b.*\bcredito\b/.test(text);
  if ((explicitDebit && explicitCredit) || (accountKind === 'card' && explicitDebit) || (accountKind === 'bank' && explicitCredit)) return unknown();
  const commercialMerchant = CATEGORY_PATTERNS.some(([name, pattern]) => name !== 'Transferências' && name !== 'Moradia' && pattern.test(text));
  const purchaseEvidence = /\bcompra\b/.test(text) || explicitDebit || explicitCredit || commercialMerchant;
  if (!purchaseEvidence) return unknown();
  if (accountKind === 'card') return result('credit_purchase', 'expense', 'Compra identificada em conta de cartão.');
  if (accountKind === 'bank' || explicitDebit) return result('debit_purchase', 'expense', 'Compra identificada com débito ou estabelecimento reconhecido em conta bancária.');
  return unknown();
}

const CATEGORY_PATTERNS: [typeof IMPORT_CATEGORY_NAMES[number], RegExp][] = [
  ['Transferências', /\b(?:pix|transferencia|ted|doc)\b/],
  ['Assinaturas', /\b(?:amazon prime|netflix|spotify|disney plus|youtube premium|assinatura)\b/],
  ['Supermercado', /\b(?:supermercado|supermercados|hipermercado|hortifruti|acougue)\b/],
  ['Alimentação fora de casa', /\b(?:restaurante|restaurantes|lanchonete|pizzaria|ifood|padaria|cafeteria|bar)\b/],
  ['Transporte', /\b(?:uber|99app|taxi|onibus|metro|estacionamento|combustivel|posto de gasolina)\b/],
  ['Saúde', /\b(?:farmacia|drogaria|clinica|hospital|dentista|laboratorio)\b/],
  ['Educação', /\b(?:escola|faculdade|universidade|curso|livraria)\b/],
  ['Moradia', /\b(?:aluguel|condominio|energia eletrica|conta de agua)\b/],
  ['Lazer', /\b(?:cinema|teatro|parque|ingresso)\b/],
  ['Serviços', /\b(?:lavanderia|cabeleireiro|barbearia|encanador|eletricista)\b/],
  ['Compras', /\b(?:amazon|mercado livre|shopee|magalu|renner|casa bahia|casas bahia)\b/],
];

export function suggestImportCategory(description: string, categories: Category[], rules: ImportCategoryRule[]): { categoryId: number | null; merchantKey: string | null } {
  const text = normalizeStatementDescription(description);
  const merchantKey = merchantKeyFor(description);
  const rule = merchantKey ? rules.find((item) => normalizeStatementDescription(item.merchantKey) === merchantKey && categories.some((category) => category.id === item.categoryId)) : undefined;
  if (rule) return { categoryId: rule.categoryId, merchantKey };
  const name = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'Outros';
  const category = categories.find((item) => normalizeStatementDescription(item.name) === normalizeStatementDescription(name));
  return { categoryId: category?.id ?? null, merchantKey };
}
