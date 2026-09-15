import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  DashboardSummary,
  getDashboardSummary,
} from "../services/dashboard.service";

const initialSummary: DashboardSummary = {
  totalIncome: 0,
  totalExpenses: 0,
  balance: 0,
  transactionCount: 0,
  accounts: [],
  monthIncome: 0,
  monthExpenses: 0,
  monthBalance: 0,
  monthTransactionCount: 0,
  currentMonthName: "",
};

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getDashboardSummary();

      setSummary(data);
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);

      setError("Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  return {
    summary,
    loading,
    error,
    reload: loadDashboard,
  };
}
