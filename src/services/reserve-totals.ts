import { getDatabase } from "../database/database";

export async function getReservePeriodTotals(month: string): Promise<{ contributions: number; withdrawals: number }> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ contributions: number; withdrawals: number }>(`
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(goal_movement, 'contribution') = 'contribution' THEN ROUND(amount * 100) ELSE 0 END), 0) / 100.0 AS contributions,
      COALESCE(SUM(CASE WHEN goal_movement = 'withdrawal' THEN ROUND(amount * 100) ELSE 0 END), 0) / 100.0 AS withdrawals
    FROM transactions WHERE type = 'transfer' AND goal_id IS NOT NULL AND transfer_id IS NULL
      AND (CASE WHEN length(date) = 10 THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
  `, { $month: month });
  return row ?? { contributions: 0, withdrawals: 0 };
}
