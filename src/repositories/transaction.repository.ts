import { getDatabase } from "../database/database";
import { Transaction } from "../types/transaction";

export async function getAllTransactions(): Promise<Transaction[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    amount: number;
    type: Transaction["type"];
    description: string | null;
    merchant: string | null;
    date: string;
    category_id: number | null;
    account_id: number | null;
    payment_method: string | null;
    is_automatic: number;
    source: Transaction["source"];
    created_at: string;
    updated_at: string;
  }>(`
    SELECT *
    FROM transactions
    ORDER BY date DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    type: row.type,
    description: row.description,
    merchant: row.merchant,
    date: row.date,
    categoryId: row.category_id,
    accountId: row.account_id,
    paymentMethod: row.payment_method,
    isAutomatic: row.is_automatic === 1,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      INSERT INTO transactions (
        amount,
        type,
        description,
        merchant,
        date,
        category_id,
        account_id,
        payment_method,
        is_automatic,
        source,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    transaction.amount,
    transaction.type,
    transaction.description,
    transaction.merchant,
    transaction.date,
    transaction.categoryId,
    transaction.accountId,
    transaction.paymentMethod,
    transaction.isAutomatic ? 1 : 0,
    transaction.source,
    now,
    now,
  );

  return result.lastInsertRowId;
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDatabase();

  await database.runAsync(`DELETE FROM transactions WHERE id = ?`, id);
}
