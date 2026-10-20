import { requireNativeModule } from "expo-modules-core";

import type { CapturedFinancialNotification } from "./financial-notification-parser";

export { parseFinancialNotification } from "./financial-notification-parser";
export type { CapturedFinancialNotification, NotificationReviewReason } from "./financial-notification-parser";

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
