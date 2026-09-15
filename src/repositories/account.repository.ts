import { getDatabase } from '../database/database';
import { Account } from '../types/account';

export async function getAllAccounts(): Promise<Account[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    type: Account['type'];
    balance: number;
    createdAt: string;
    updatedAt: string;
  }>(`
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
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const safeName = account.name.replace(/'/g, "''");
  const safeType = account.type.replace(/'/g, "''");

  const result = await database.execAsync(`
    INSERT INTO accounts (
      name,
      type,
      balance,
      created_at,
      updated_at
    )
    VALUES (
      '${safeName}',
      '${safeType}',
      ${account.balance},
      '${now}',
      '${now}'
    );
  `);

  const createdAccount = await database.getFirstAsync<{
    id: number;
  }>(`
    SELECT id
    FROM accounts
    WHERE name = '${safeName}'
      AND type = '${safeType}'
      AND created_at = '${now}'
    ORDER BY id DESC
    LIMIT 1
  `);

  if (!createdAccount) {
    throw new Error('Conta criada, mas não foi possível recuperar o ID.');
  }

  return createdAccount.id;
}