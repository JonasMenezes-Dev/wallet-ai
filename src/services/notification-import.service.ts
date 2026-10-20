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
  const matches = text.match(/R\$\s*[0-9.,]+/gi) ?? [];
  const raw = matches.length ? matches[matches.length - 1].replace(/R\$\s*/i, "") : "";
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  const type = /recebeu|recebido|pix recebido|transfer[eê]ncia recebida|cr[eé]dito em conta/i.test(text) ? "income" : "expense";
  return {
    amount,
    type: type as "income" | "expense",
    description: (item.text.replace(/R\$\s*[0-9.,]+/gi, "").trim() || item.title || "Movimentação bancária").slice(0, 120),
    confidence: amount === null ? "low" as const : "high" as const,
  };
}
