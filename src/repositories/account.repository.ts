import { getDatabase } from "../database/database";
import { Account } from "../types/account";

export async function getAllAccounts(): Promise<Account[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    name: string;
    type: Account["type"];
    balance: number;
    limitAmount: number | null;
    createdAt: string;
    updatedAt: string;
  }>(`
    SELECT
      id,
      name,
      type,
      balance,
      limit_amount AS limitAmount,
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
        limit_amount,
        created_at,
        updated_at
      )
      VALUES ($name, $type, $balance, $limitAmount, $createdAt, $updatedAt)
    `,
    {
      $name: account.name,
      $type: account.type,
      $balance: account.balance,
      $limitAmount: toStoredLimit(account.type, account.limitAmount),
      $createdAt: now,
      $updatedAt: now,
    },
  );

  return result.lastInsertRowId;
}

export async function updateAccount(
  accountId: number,
  account: {
    name: string;
    type: Account["type"];
    balance: number;
    limitAmount: number | null;
  },
): Promise<void> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      UPDATE accounts
      SET
        name = $name,
        type = $type,
        balance = $balance,
        limit_amount = $limitAmount,
        updated_at = $updatedAt
      WHERE id = $id
    `,
    {
      $name: account.name,
      $type: account.type,
      $balance: account.balance,
      $limitAmount: toStoredLimit(account.type, account.limitAmount),
      $updatedAt: now,
      $id: accountId,
    },
  );

  if (result.changes === 0) {
    throw new Error("Conta não encontrada.");
  }
}

/**
 * Garante a regra "limite só existe em cartão" antes de ir para o banco.
 * O service já valida; isto aqui é a última barreira, para que nenhum
 * chamador futuro consiga gravar limite em conta bancária.
 */
function toStoredLimit(
  type: Account["type"],
  limitAmount: number | null,
): number | null {
  if (type !== "credit_card") {
    return null;
  }

  if (limitAmount === null || !Number.isFinite(limitAmount)) {
    return null;
  }

  return limitAmount;
}

export async function deleteAccount(accountId: number): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    const account = await database.getFirstAsync<{
      id: number;
      name: string;
    }>(
      `
        SELECT id, name
        FROM accounts
        WHERE id = $accountId
      `,
      { $accountId: accountId },
    );

    if (!account) {
      throw new Error("Conta não encontrada.");
    }

    const transactions = await database.getFirstAsync<{
      total: number;
    }>(
      `
        SELECT COUNT(*) AS total
        FROM transactions
        WHERE account_id = $accountId
      `,
      { $accountId: accountId },
    );

    if ((transactions?.total ?? 0) > 0) {
      throw new Error(
        "Essa conta possui transações. Exclua ou mova as transações antes de remover a conta.",
      );
    }

    await database.runAsync(
      `
        DELETE FROM accounts
        WHERE id = $accountId
      `,
      { $accountId: accountId },
    );
  });
}
