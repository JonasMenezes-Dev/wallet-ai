import { requireNativeModule } from "expo-modules-core";

export interface CapturedFinancialNotification {
  key: string;
  title: string;
  text: string;
  packageName: string;
  postedAt: number;
}

interface NotificationListenerBridge {
  hasPermission(): boolean;
  openSettings(): void;
  getCapturedNotifications(): CapturedFinancialNotification[];
  removeCapturedNotification(key: string): boolean;
  notifyExpenseRecorded(amount: number, category: string): boolean;
}

let bridge: NotificationListenerBridge | null = null;
try {
  bridge = requireNativeModule<NotificationListenerBridge>("WalletNotificationListener");
} catch {
  // Native module is available only in a compiled Android build, not Expo Go/web.
}

export const isNotificationListenerAvailable = () => bridge !== null;
export const hasNotificationAccess = () => bridge?.hasPermission() ?? false;
export function openNotificationAccessSettings() {
  if (!bridge) throw new Error("Recurso disponível somente no APK Android do Wallet.");
  bridge.openSettings();
}
export const listCapturedNotifications = () => bridge?.getCapturedNotifications() ?? [];
export const dismissCapturedNotification = (key: string) => bridge?.removeCapturedNotification(key) ?? false;
export const notifyRecordedExpense = (amount: number, category: string) => bridge?.notifyExpenseRecorded(amount, category) ?? false;

export type NotificationReviewReason =
  | "rejected"
  | "ambiguous"
  | "missing_amount"
  | "invalid_amount"
  | null;

export function parseFinancialNotification(item: CapturedFinancialNotification) {
  const text = `${item.title} ${item.text}`;
  const moneyMatches = [...text.matchAll(/R\\$\\s*([0-9]+(?:[.,][0-9]{1,3})*)/gi)];
  const isRejected =
    /não autorizad[oa]|nao autorizad[oa]|compra recusada|transa[cç][aã]o recusada|compra não realizada|compra nao realizada|transa[cç][aã]o não realizada|transa[cç][aã]o nao realizada|pagamento recusado|pagamento não concluído|pagamento nao concluido|compra não aprovada|compra nao aprovada|pagamento não aprovado|pagamento nao aprovado/i.test(text);

  // Alguns bancos mostram o valor da compra com R$, mas exibem saldo/limite
  // sem símbolo monetário. Se houver outro valor junto desses rótulos, não
  // escolhemos automaticamente qual deles representa a movimentação.
  const contextualMoneyMatches = [
    ...text.matchAll(/\\b(?:saldo(?: atual| disponível| disponivel)?|limite(?: disponível| disponivel)?|valor total|total da fatura)\\s*:?\\s*(?:R\\$\\s*)?([0-9][0-9.,]*)/gi),
  ];
  const distinctContextValues = new Set(
    contextualMoneyMatches.map((match) => normalizeBrazilianAmount(match[1] ?? "")).filter((value): value is string => value !== null),
  );
  const hasConflictingContextValue =
    distinctContextValues.size > 0 &&
    (moneyMatches.length !== 1 ||
      [...distinctContextValues][0] !== normalizeBrazilianAmount(moneyMatches[0]?.[1] ?? ""));

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

  const type = /\\b(recebeu|recebido|pix recebido|transfer[eê]ncia recebida|cr[eé]dito em conta)\\b/i.test(text)
    ? "income"
    : "expense";

  return {
    amount,
    isRejected,
    reason,
    amountCandidates: moneyMatches.length + (hasConflictingContextValue ? 1 : 0),
    type: type as "income" | "expense",
    description: (item.text.replace(/R\\$\\s*[0-9]+(?:[.,][0-9]{1,3})*/gi, "").trim() || item.title || "Movimentação bancária").slice(0, 120),
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
    if (!/^\\d{1,3}(\\.\\d{3})*,\\d{2}$/.test(raw)) return null;
    return raw.replace(/\\./g, "").replace(",", ".");
  }

  if (raw.includes(",")) {
    if (!/^\\d+,\\d{1,2}$/.test(raw)) return null;
    return raw.replace(",", ".");
  }

  if (raw.includes(".")) {
    if (/^\\d+\\.\\d{1,2}$/.test(raw)) return raw;
    if (/^\\d{1,3}(\\.\\d{3})+$/.test(raw)) return raw.replace(/\\./g, "");
    return null;
  }

  return raw;
}
