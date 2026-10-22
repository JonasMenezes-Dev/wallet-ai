import { getDatabase } from "../database/database";

import { getReservePeriodTotals } from "./reserve-totals";

export interface MonthlyReport {
  contributions: number;
  withdrawals: number;
  effectiveSavings: number;
  month: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
  previousIncome: number;
  previousExpenses: number;
  expensesByCategory: { categoryId: number | null; categoryName: string; total: number }[];
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mês inválido.");
  const database = await getDatabase();
  const previousMonth = shiftMonth(month, -1);
  const totals = await database.getFirstAsync<{
    income: number | null; expenses: number | null; transaction_count: number | null;
  }>(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' AND is_refund = 0 AND transfer_id IS NULL THEN CASE WHEN is_refund = 1 THEN -amount ELSE amount END ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN (type = 'expense' OR is_refund = 1) AND transfer_id IS NULL THEN CASE WHEN is_refund = 1 THEN -amount ELSE amount END ELSE 0 END), 0) AS expenses,
      COUNT(DISTINCT COALESCE(transfer_id, 'transaction-' || id)) AS transaction_count
    FROM transactions
    WHERE (CASE WHEN length(date) = 10 OR (date NOT LIKE '%Z' AND substr(date, -6, 1) NOT IN ('+', '-')) THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
  `, { $month: month });
  const previous = await database.getFirstAsync<{ income: number | null; expenses: number | null }>(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' AND is_refund = 0 AND transfer_id IS NULL THEN CASE WHEN is_refund = 1 THEN -amount ELSE amount END ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN (type = 'expense' OR is_refund = 1) AND transfer_id IS NULL THEN CASE WHEN is_refund = 1 THEN -amount ELSE amount END ELSE 0 END), 0) AS expenses
    FROM transactions
    WHERE (CASE WHEN length(date) = 10 OR (date NOT LIKE '%Z' AND substr(date, -6, 1) NOT IN ('+', '-')) THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
  `, { $month: previousMonth });
  const rows = await database.getAllAsync<{ category_id: number | null; category_name: string | null; total: number }>(`
    SELECT transactions.category_id, categories.name AS category_name, SUM(CASE WHEN transactions.is_refund = 1 THEN -transactions.amount ELSE transactions.amount END) AS total
    FROM transactions
    LEFT JOIN categories ON categories.id = transactions.category_id
    WHERE (transactions.type = 'expense' OR transactions.is_refund = 1) AND transactions.transfer_id IS NULL AND (CASE WHEN length(transactions.date) = 10 OR (transactions.date NOT LIKE '%Z' AND substr(transactions.date, -6, 1) NOT IN ('+', '-')) THEN substr(transactions.date, 1, 7) ELSE strftime('%Y-%m', transactions.date, 'localtime') END) = $month
    GROUP BY transactions.category_id, categories.name
    ORDER BY total DESC
  `, { $month: month });
  const income = totals?.income ?? 0;
  const expenses = totals?.expenses ?? 0;
  const reserves = await getReservePeriodTotals(month);
  return {
    ...reserves, effectiveSavings: Math.round((income - expenses) * 100) / 100,
    month, income, expenses, balance: income - expenses,
    transactionCount: totals?.transaction_count ?? 0,
    previousIncome: previous?.income ?? 0,
    previousExpenses: previous?.expenses ?? 0,
    expensesByCategory: rows.map((row) => ({
      categoryId: row.category_id, categoryName: row.category_name ?? "Sem categoria", total: row.total,
    })),
  };
}

export { shiftMonth };
