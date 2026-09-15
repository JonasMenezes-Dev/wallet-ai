import { getDatabase } from "../database/database";
import { Account } from "../types/account";

export async function getAllAccounts(): Promise<Account[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<Account>(`
    SELECT
      id,
      name,
      type,
      balance,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM accounts
    ORDER BY name ASC
  `);

  return rows;
}

export async function createAccount(
  account: Omit<Account, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      INSERT INTO accounts (
        name,
        type,
        balance,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    account.name,
    account.type,
    account.balance,
    now,
    now,
  );

  return result.lastInsertRowId;
}
