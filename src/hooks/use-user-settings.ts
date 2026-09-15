import { useCallback, useEffect, useState } from "react";

import {
    loadUserSettings,
    saveSettings,
} from "../services/user-settings.service";

import { UserSettings } from "../types/user-settings";

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await loadUserSettings();

      setSettings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (data: Omit<UserSettings, "id" | "createdAt" | "updatedAt">) => {
      await saveSettings(data);
      await load();
    },
    [load],
  );

  useEffect(() => {
    load();
  }, [load]);

  return {
    settings,
    loading,
    save,
    reload: load,
  };
}
