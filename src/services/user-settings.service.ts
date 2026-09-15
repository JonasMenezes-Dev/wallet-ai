import {
    getUserSettings,
    saveUserSettings,
} from "../repositories/user-settings.repository";

import { UserSettings } from "../types/user-settings";

export async function loadUserSettings(): Promise<UserSettings | null> {
  return getUserSettings();
}

export async function saveSettings(
  settings: Omit<UserSettings, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  if (settings.salary < 0) {
    throw new Error("O salário não pode ser negativo.");
  }

  if (settings.benefitAmount < 0) {
    throw new Error("O valor do benefício não pode ser negativo.");
  }

  await saveUserSettings(settings);
}
