import { getDatabase } from '../database/database';

import { Transaction } from '../types/transaction';

export async function getAllTransactions(): Promise<Transaction[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    goal_id: number | null;
    goal_name: string | null;
    amount: number;
    type: Transaction['type'];
    description: string | null;
    merchant: string | null;
    date: string;
    category_id: number | null;
    account_id: number | null;
    payment_method: string | null;
    is_automatic: number;
    source: Transaction['source'];
    created_at: string;
    updated_at: string;
  }>(`
    SELECT
      transactions.*,
      goals.name AS goal_name
    FROM transactions
    LEFT JOIN goals
      ON goals.id = transactions.goal_id
    ORDER BY transactions.date DESC
  `);

  return rows.map((row) => ({
  id: row.id,
  amount: row.amount,
  type: row.type,
  description:
    row.type === 'transfer' &&
    row.goal_name
      ? `Aporte para: ${row.goal_name}`
      : row.description,
  merchant: row.merchant,
  date: row.date,
  categoryId: row.category_id,
  accountId: row.account_id,
  paymentMethod: row.payment_method,
  goalId: row.goal_id,
  goalName: row.goal_name,
  isAutomatic: row.is_automatic === 1,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}));
}

export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  let transactionId = 0;

  await database.withTransactionAsync(async () => {
    const account = await database.getFirstAsync<{
      id: number;
      balance: number;
    }>(
      `
        SELECT id, balance
        FROM accounts
        WHERE id = ?
      `,
      transaction.accountId
    );

    if (!account) {
      throw new Error('Conta não encontrada.');
    }

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
      now
    );

    transactionId = result.lastInsertRowId;

    let newBalance = account.balance;

    if (transaction.type === 'expense') {
      newBalance -= transaction.amount;
    }

    if (transaction.type === 'income') {
      newBalance += transaction.amount;
    }

    await database.runAsync(
      `
        UPDATE accounts
        SET balance = ?, updated_at = ?
        WHERE id = ?
      `,
      newBalance,
      now,
      account.id
    );
  });

  return transactionId;
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    const transaction = await database.getFirstAsync<{
      amount: number;
      type: Transaction['type'];
      account_id: number | null;
      goal_id: number | null;
    }>(
      `
        SELECT
          amount,
          type,
          account_id,
          goal_id
        FROM transactions
        WHERE id = ?
      `,
      id
    );

    if (!transaction) {
      throw new Error('Transação não encontrada.');
    }

    const now = new Date().toISOString();

    /*
     * Aporte para uma meta
     *
     * Quando excluímos o aporte:
     * - devolvemos o dinheiro para a conta;
     * - retiramos o valor da meta.
     */
    if (
      transaction.type === 'transfer' &&
      transaction.goal_id
    ) {
      const account = await database.getFirstAsync<{
        balance: number;
      }>(
        `
          SELECT balance
          FROM accounts
          WHERE id = ?
        `,
        transaction.account_id
      );

      if (!account) {
        throw new Error(
          'Conta do aporte não encontrada.'
        );
      }

      const goal = await database.getFirstAsync<{
        current_amount: number;
      }>(
        `
          SELECT current_amount
          FROM goals
          WHERE id = ?
        `,
        transaction.goal_id
      );

      if (!goal) {
        throw new Error(
          'Meta do aporte não encontrada.'
        );
      }

      const newAccountBalance =
        account.balance + transaction.amount;

      const newGoalAmount =
        Math.max(
          goal.current_amount -
            transaction.amount,
          0
        );

      await database.runAsync(
        `
          UPDATE accounts
          SET
            balance = ?,
            updated_at = ?
          WHERE id = ?
        `,
        newAccountBalance,
        now,
        transaction.account_id
      );

      await database.runAsync(
        `
          UPDATE goals
          SET
            current_amount = ?,
            updated_at = ?
          WHERE id = ?
        `,
        newGoalAmount,
        now,
        transaction.goal_id
      );
    } else if (transaction.account_id) {
      /*
       * Transação normal:
       * - despesa: devolve o valor;
       * - entrada: retira o valor novamente.
       */
      const account = await database.getFirstAsync<{
        balance: number;
      }>(
        `
          SELECT balance
          FROM accounts
          WHERE id = ?
        `,
        transaction.account_id
      );

      if (account) {
        let newBalance = account.balance;

        if (transaction.type === 'expense') {
          newBalance += transaction.amount;
        }

        if (transaction.type === 'income') {
          newBalance -= transaction.amount;
        }

        await database.runAsync(
          `
            UPDATE accounts
            SET
              balance = ?,
              updated_at = ?
            WHERE id = ?
          `,
          newBalance,
          now,
          transaction.account_id
        );
      }
    }

    await database.runAsync(
      `
        DELETE FROM transactions
        WHERE id = ?
      `,
      id
    );
  });
}