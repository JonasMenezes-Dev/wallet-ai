export interface CapturedFinancialNotification {
  key: string;
  title: string;
  text: string;
  packageName: string;
  postedAt: number;
}

export type NotificationReviewReason =
  | "rejected"
  | "ambiguous"
  | "missing_amount"
  | "invalid_amount"
  | null;

export function parseFinancialNotification(item: CapturedFinancialNotification) {
  const text = `${item.title} ${item.text}`;
  const moneyMatches = [...text.matchAll(/R\$\s*([0-9]+(?:[.,][0-9]{1,3})*)/gi)];
  const isRejected =
    /não autorizad[oa]|nao autorizad[oa]|compra recusada|transa[cç][aã]o recusada|compra não realizada|compra nao realizada|transa[cç][aã]o não realizada|transa[cç][aã]o nao realizada|pagamento recusado|pagamento não concluído|pagamento nao concluido|compra não aprovada|compra nao aprovada|pagamento não aprovado|pagamento nao aprovado/i.test(text);

  // Alguns bancos mostram o valor da compra com R$, mas exibem saldo/limite
  // sem símbolo monetário. Se houver outro valor junto desses rótulos, não
  // escolhemos automaticamente qual deles representa a movimentação.
  const contextualMoneyMatches = [
    ...text.matchAll(/\b(saldo(?: atual| disponível| disponivel)?|limite(?: disponível| disponivel)?|valor total|total da fatura)\s*:?\s*(?:R\$\s*)?([0-9][0-9.,]*)/gi),
  ];
  const hasConflictingContextValue = contextualMoneyMatches.some((contextMatch) => {
    const label = contextMatch[1] ?? "";
    const rawContextValue = contextMatch[2] ?? "";
    if (normalizeBrazilianAmount(rawContextValue) === null) return false;
    const valueOffset = (contextMatch.index ?? 0) + contextMatch[0].lastIndexOf(rawContextValue);
    // Saldo, limite e fatura não são o valor da compra, mesmo quando esse é o único valor com R$.
    const isBalanceOrLimit = /\b(?:saldo|limite|total da fatura)\b/i.test(label);
    if (isBalanceOrLimit) return true;
    // Não contar duas vezes o mesmo número quando o rótulo descreve o total da compra.
    const isSameMoneyMatch = moneyMatches.some((moneyMatch) => {
      const start = moneyMatch.index ?? 0;
      return valueOffset >= start && valueOffset < start + moneyMatch[0].length;
    });
    return !isSameMoneyMatch;
  });

  const raw = moneyMatches.length === 1 ? (moneyMatches[0]?.[1] ?? "") : "";
  const normalized = normalizeBrazilianAmount(raw);
  const parsed = normalized === null ? NaN : Number(normalized);
  const amount = !isRejected && moneyMatches.length === 1 && !hasConflictingContextValue &&
    Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  let reason: NotificationReviewReason = null;
  if (isRejected) reason = "rejected";
  else if (moneyMatches.length > 1 || hasConflictingContextValue) reason = "ambiguous";
  else if (moneyMatches.length === 0) reason = "missing_amount";
  else if (amount === null) reason = "invalid_amount";

  const type = /\b(recebeu|recebido|pix recebido|transfer[eê]ncia recebida|cr[eé]dito em conta)\b/i.test(text)
    ? "income"
    : "expense";

  return {
    amount,
    isRejected,
    reason,
    amountCandidates: moneyMatches.length + (hasConflictingContextValue ? 1 : 0),
    type: type as "income" | "expense",
    description: (item.text.replace(/R\$\s*[0-9]+(?:[.,][0-9]{1,3})*/gi, "").trim() || item.title || "Movimentação bancária").slice(0, 120),
    confidence: amount === null ? "low" as const : "high" as const,
  };
}

/**
 * Converte um único valor monetário sem assumir que o último número
 * da notificação é o valor da transação.
 */
function normalizeBrazilianAmount(raw: string): string | null {
  if (!raw || !/^[0-9][0-9.,]*$/.test(raw)) return null;

  if (raw.includes(",") && raw.includes(".")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(raw)) return null;
    return raw.replace(/\./g, "").replace(",", ".");
  }

  if (raw.includes(",")) {
    if (!/^\d+,\d{1,2}$/.test(raw)) return null;
    return raw.replace(",", ".");
  }

  if (raw.includes(".")) {
    if (/^\d+\.\d{1,2}$/.test(raw)) return raw;
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return raw.replace(/\./g, "");
    return null;
  }

  return raw;
}
