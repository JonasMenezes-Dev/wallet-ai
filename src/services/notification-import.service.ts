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

export function parseFinancialNotification(item: CapturedFinancialNotification) {
  const text = `${item.title} ${item.text}`;
  const matches = text.match(/R\\$\\s*[0-9][0-9.,]*/gi) ?? [];

  // A notificação pode exibir o valor da compra e também o saldo restante.
  // Sem contexto bancário específico, escolher o último valor é perigoso:
  // importe apenas quando existe um único valor monetário reconhecível.
  const raw = matches.length === 1 ? matches[0].replace(/R\\$\\s*/i, "").trim() : "";
  const normalized = normalizeBrazilianAmount(raw);
  const parsed = normalized === null ? NaN : Number(normalized);
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const type = /recebeu|recebido|pix recebido|transfer[eê]ncia recebida|cr[eé]dito em conta/i.test(text)
    ? "income"
    : "expense";

  return {
    amount,
    type: type as "income" | "expense",
    description: (item.text.replace(/R\\$\\s*[0-9][0-9.,]*/gi, "").trim() || item.title || "Movimentação bancária").slice(0, 120),
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
    // No formato brasileiro, ponto separa milhares e vírgula os centavos.
    if (!/^\\d{1,3}(\\.\\d{3})*,\\d{2}$/.test(raw)) return null;
    return raw.replace(/\\./g, "").replace(",", ".");
  }

  if (raw.includes(",")) {
    if (!/^\\d+,\\d{1,2}$/.test(raw)) return null;
    return raw.replace(",", ".");
  }

  if (raw.includes(".")) {
    // Aceita ponto decimal com dois dígitos; caso contrário trata os pontos
    // em grupos de três como separadores de milhares.
    if (/^\\d+\\d?\.\\d{1,2}$/.test(raw)) return raw;
    if (/^\\d{1,3}(\.\\d{3})+$/.test(raw)) return raw.replace(/\\./g, "");
    return null;
  }

  return raw;
}
