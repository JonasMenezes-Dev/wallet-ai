import { getDatabase } from "../database/database";

function isValidMonth(value: string): boolean {
  const parts = value.split("-");
  if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 2) return false;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return Number.isInteger(year) && String(year) === parts[0] && month >= 1 && month <= 12 && String(month).padStart(2, "0") === parts[1];
  const [year, month] = value.split("-").map(Number);
  return Number.isInteger(year) && year >= 1 && month >= 1 && month <= 12;
}

export interface MonthlyBudget {
  id: number;
  categoryId: number;
  categoryName: string;
  month: string;
  amount: number;
  spent: number;
  createdAt: string;
  updatedAt: string;
}

export async function listMonthlyBudgets(month: string): Promise<MonthlyBudget[]> {
  if (!isValidMonth(month)) throw new Error("O mês selecionado é inválido.");

  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    category_id: number;
    category_name: string;
    month_key: string;
    amount: number;
    spent: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT
        budgets.id,
        budgets.category_id,
        categories.name AS category_name,
        budgets.month_key,
        budgets.amount,
        COALESCE(spending.total, 0) AS spent,
        budgets.created_at,
        budgets.updated_at
      FROM monthly_budgets AS budgets
      INNER JOIN categories
        ON categories.id = budgets.category_id
      LEFT JOIN (
        SELECT category_id, SUM(amount) AS total
        FROM transactions
        WHERE type = 'expense'
          AND (CASE WHEN length(date) = 10 THEN substr(date, 1, 7) ELSE strftime('%Y-%m', date, 'localtime') END) = $month
        GROUP BY category_id
      ) AS spending
        ON spending.category_id = budgets.category_id
      WHERE budgets.month_key = $month
      ORDER BY categories.name COLLATE NOCASE ASC
    `,
    { $month: month },
  );

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    month: row.month_key,
    amount: row.amount,
    spent: row.spent ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveMonthlyBudget(
  categoryId: number,
  month: string,
  amount: number,
): Promise<void> {
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Selecione uma categoria válida.");
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("O mês selecionado é inválido.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Informe um limite maior que zero.");
  }

  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    `
      INSERT INTO monthly_budgets (
        category_id, month_key, amount, created_at, updated_at
      )
      VALUES ($categoryId, $month, $amount, $now, $now)
      ON CONFLICT(category_id, month_key)
      DO UPDATE SET
        amount = excluded.amount,
        updated_at = excluded.updated_at
    `,
    {
      $categoryId: categoryId,
      $month: month,
      $amount: amount,
      $now: now,
    },
  );
}

export async function deleteMonthlyBudget(id: number): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    "DELETE FROM monthly_budgets WHERE id = $id",
    { $id: id },
  );

  if (result.changes === 0) {
    throw new Error("Esse orçamento não foi encontrado.");
  }
}
