import { getDatabase } from "../database/database";

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const database = await getDatabase();

  const result = await database.getFirstAsync<{
    totalIncome: number | null;
    totalExpenses: number | null;
    transactionCount: number;
  }>(`
    SELECT
      COALESCE(
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END),
        0
      ) AS totalIncome,

      COALESCE(
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END),
        0
      ) AS totalExpenses,

      COUNT(*) AS transactionCount

    FROM transactions
  `);

  const totalIncome = result?.totalIncome ?? 0;
  const totalExpenses = result?.totalExpenses ?? 0;

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    transactionCount: result?.transactionCount ?? 0,
  };
}
