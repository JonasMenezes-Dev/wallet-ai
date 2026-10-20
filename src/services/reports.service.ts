import { getDatabase } from "../database/database";

export interface MonthlyReport {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
  previousIncome: number;
  previousExpenses: number;
  expensesByCategory: Array<{ categoryId: number | null; categoryName: string; total: number }>;
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
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
      COUNT(*) AS transaction_count
    FROM transactions
    WHERE (CASE WHEN length(date) = 10 THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
  `, { $month: month });
  const previous = await database.getFirstAsync<{ income: number | null; expenses: number | null }>(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses
    FROM transactions
    WHERE (CASE WHEN length(date) = 10 THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
  `, { $month: previousMonth });
  const rows = await database.getAllAsync<{ category_id: number | null; category_name: string | null; total: number }>(`
    SELECT transactions.category_id, categories.name AS category_name, SUM(transactions.amount) AS total
    FROM transactions
    LEFT JOIN categories ON categories.id = transactions.category_id
    WHERE transactions.type = 'expense' AND (CASE WHEN length(transactions.date) = 10 THEN substr(transactions.date, 1, 7) ELSE strftime('%Y-%m', transactions.date, 'localtime') END) = $month
    GROUP BY transactions.category_id, categories.name
    ORDER BY total DESC
  `, { $month: month });
  const income = totals?.income ?? 0;
  const expenses = totals?.expenses ?? 0;
  return {
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
