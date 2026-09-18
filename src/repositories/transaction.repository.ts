import { getDatabase } from "../database/database";

import {
  applyTransactionToAccount,
  isBalanceInvalid,
} from "../services/transaction-balance";
import { Account } from "../types/account";
import { Transaction, TransactionWithRelations } from "../types/transaction";

export async function getAllTransactions(): Promise<
  TransactionWithRelations[]
> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: number;
    goal_id: number | null;
    goal_name: string | null;
    category_name: string | null;
    account_name: string | null;
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
    external_id: string | null;
    provider: string | null;
    institution: string | null;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT
      transactions.*,
      goals.name AS goal_name,
      categories.name AS category_name,
      accounts.name AS account_name
    FROM transactions
    LEFT JOIN goals
      ON goals.id = transactions.goal_id
    LEFT JOIN categories
      ON categories.id = transactions.category_id
    LEFT JOIN accounts
      ON accounts.id = transactions.account_id
    ORDER BY transactions.date DESC, transactions.id DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    type: row.type,
    description:
      row.type === "transfer" && row.goal_name
        ? `Aporte para: ${row.goal_name}`
        : row.description,
    merchant: row.merchant,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    accountId: row.account_id,
    accountName: row.account_name,
    paymentMethod: row.payment_method,
    goalId: row.goal_id,
    goalName: row.goal_name,
    isAutomatic: row.is_automatic === 1,
    source: row.source,
    externalId: row.external_id,
    provider: row.provider,
    institution: row.institution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTransaction(
  transaction: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  let transactionId = 0;

  await database.withTransactionAsync(async () => {
    const account = await database.getFirstAsync<{
      id: number;
      balance: number;
      type: Account["type"];
    }>(
      `
        SELECT id, balance, type
        FROM accounts
        WHERE id = $accountId
      `,
      { $accountId: transaction.accountId },
    );

    if (!account) {
      throw new Error("Conta não encontrada.");
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
        VALUES (
          $amount,
          $type,
          $description,
          $merchant,
          $date,
          $categoryId,
          $accountId,
          $paymentMethod,
          $isAutomatic,
          $source,
          $createdAt,
          $updatedAt
        )
      `,
      {
        $amount: transaction.amount,
        $type: transaction.type,
        $description: transaction.description,
        $merchant: transaction.merchant,
        $date: transaction.date,
        $categoryId: transaction.categoryId,
        $accountId: transaction.accountId,
        $paymentMethod: transaction.paymentMethod,
        $isAutomatic: transaction.isAutomatic ? 1 : 0,
        $source: transaction.source,
        $createdAt: now,
        $updatedAt: now,
      },
    );

    transactionId = result.lastInsertRowId;

    /*
     * O efeito no valor guardado depende do tipo de conta:
     * conta comum tira/soma o dinheiro, cartão soma/subtrai a dívida.
     * Isso também é o que faz a compra no cartão reduzir o limite
     * disponível (utilizado sobe) em vez de mexer em saldo real.
     */
    const newBalance = applyTransactionToAccount(
      account.balance,
      account.type,
      transaction.type,
      transaction.amount,
    );

    if (isBalanceInvalid(newBalance, account.type)) {
      throw new Error("Saldo insuficiente na conta.");
    }

    await database.runAsync(
      `
        UPDATE accounts
        SET
          balance = $balance,
          updated_at = $updatedAt
        WHERE id = $accountId
      `,
      {
        $balance: newBalance,
        $updatedAt: now,
        $accountId: account.id,
      },
    );
  });

  return transactionId;
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    const transaction = await database.getFirstAsync<{
      amount: number;
      type: Transaction["type"];
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
        WHERE id = $id
      `,
      { $id: id },
    );

    if (!transaction) {
      throw new Error("Transação não encontrada.");
    }

    const now = new Date().toISOString();

    /*
     * Aporte para uma meta
     *
     * Quando excluímos o aporte:
     * - devolvemos o dinheiro para a conta;
     * - retiramos o valor da meta.
     */
    if (transaction.type === "transfer" && transaction.goal_id) {
      const account = await database.getFirstAsync<{
        balance: number;
      }>(
        `
          SELECT balance
          FROM accounts
          WHERE id = $accountId
        `,
        { $accountId: transaction.account_id },
      );

      if (!account) {
        throw new Error("Conta do aporte não encontrada.");
      }

      const goal = await database.getFirstAsync<{
        current_amount: number;
      }>(
        `
          SELECT current_amount
          FROM goals
          WHERE id = $goalId
        `,
        { $goalId: transaction.goal_id },
      );

      if (!goal) {
        throw new Error("Meta do aporte não encontrada.");
      }

      const newAccountBalance = account.balance + transaction.amount;

      const newGoalAmount = Math.max(
        goal.current_amount - transaction.amount,
        0,
      );

      await database.runAsync(
        `
          UPDATE accounts
          SET
            balance = $balance,
            updated_at = $updatedAt
          WHERE id = $accountId
        `,
        {
          $balance: newAccountBalance,
          $updatedAt: now,
          $accountId: transaction.account_id,
        },
      );

      await database.runAsync(
        `
          UPDATE goals
          SET
            current_amount = $currentAmount,
            updated_at = $updatedAt
          WHERE id = $goalId
        `,
        {
          $currentAmount: newGoalAmount,
          $updatedAt: now,
          $goalId: transaction.goal_id,
        },
      );
    } else if (transaction.account_id) {
      /*
       * Transação normal: desfaz exatamente o efeito da criação.
       * Em conta comum o dinheiro volta ou sai; em cartão a dívida
       * (utilizado) cai ou sobe, o que também devolve limite disponível.
       * Passamos o valor negativo para `applyTransactionToAccount`
       * representar “estornar”.
       */
      const account = await database.getFirstAsync<{
        balance: number;
        type: Account["type"];
      }>(
        `
          SELECT balance, type
          FROM accounts
          WHERE id = ?
        `,
        transaction.account_id,
      );

      if (account) {
        const newBalance = applyTransactionToAccount(
          account.balance,
          account.type,
          transaction.type,
          -transaction.amount,
        );

        await database.runAsync(
          `
            UPDATE accounts
            SET
              balance = $balance,
              updated_at = $updatedAt
            WHERE id = $accountId
          `,
          {
            $balance: newBalance,
            $updatedAt: now,
            $accountId: transaction.account_id,
          },
        );
      }
    }

    await database.runAsync(
      `
        DELETE FROM transactions
        WHERE id = $id
      `,
      { $id: id },
    );
  });
}

export async function updateTransaction(
  id: number,
  transaction: {
    amount: number;
    type: Transaction["type"];
    description: string | null;
    categoryId: number | null;
    accountId: number;
    /** Data de competência (`YYYY-MM-DD` ou ISO). Ausente mantém a atual. */
    date?: string;
  },
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const current = await database.getFirstAsync<{
      amount: number;
      type: Transaction["type"];
      account_id: number | null;
      goal_id: number | null;
      date: string;
    }>(
      `
        SELECT amount, type, account_id, goal_id, date
        FROM transactions
        WHERE id = $id
      `,
      { $id: id },
    );

    if (!current) {
      throw new Error("Transação não encontrada.");
    }

    if (current.goal_id || current.type === "transfer") {
      throw new Error("Aportes de metas não podem ser editados.");
    }

    const oldAccount = await database.getFirstAsync<{
      balance: number;
      type: Account["type"];
    }>("SELECT balance, type FROM accounts WHERE id = $accountId", {
      $accountId: current.account_id,
    });

    const newAccount = await database.getFirstAsync<{
      balance: number;
      type: Account["type"];
    }>("SELECT balance, type FROM accounts WHERE id = $accountId", {
      $accountId: transaction.accountId,
    });

    if (!oldAccount || !newAccount) {
      throw new Error("Conta da transação não encontrada.");
    }

    /*
     * Cartão é tratado como cartão mesmo quando a transação troca de
     * conta: o efeito é recalculado nos dois lados com o tipo de conta
     * de cada um. Isso é o que faz mover um gasto de banco para cartão
     * devolver o dinheiro à conta e jogar a dívida no cartão.
     */

    /*
     * Desfaz o efeito antigo (na conta antiga) e aplica o novo
     * (na conta nova). Quando a conta é a mesma, os dois passos
     * acontecem no mesmo saldo, calculado a partir do valor restaurado.
     */
    const isSameAccount = current.account_id === transaction.accountId;

    // Desfaz o lançamento antigo na conta antiga (valor negativo).
    const restoredOldBalance = applyTransactionToAccount(
      oldAccount.balance,
      oldAccount.type,
      current.type,
      -current.amount,
    );

    // Aplica o novo lançamento na conta nova.
    const updatedBalance = applyTransactionToAccount(
      isSameAccount ? restoredOldBalance : newAccount.balance,
      newAccount.type,
      transaction.type,
      transaction.amount,
    );

    /*
     * Só conta comum pode ficar negativa. No cartão o valor "negativo"
     * representa dívida e é aceito normalmente. As duas checagens ficam
     * antes de qualquer gravação, dentro da mesma transação do banco:
     * ou tudo passa, ou nada é alterado.
     */
    if (
      isBalanceInvalid(restoredOldBalance, oldAccount.type) ||
      isBalanceInvalid(updatedBalance, newAccount.type)
    ) {
      throw new Error("Saldo insuficiente na conta.");
    }

    if (!isSameAccount) {
      await database.runAsync(
        `
          UPDATE accounts
          SET
            balance = $balance,
            updated_at = $updatedAt
          WHERE id = $accountId
        `,
        {
          $balance: restoredOldBalance,
          $updatedAt: now,
          $accountId: current.account_id,
        },
      );
    }

    await database.runAsync(
      `
        UPDATE accounts
        SET
          balance = $balance,
          updated_at = $updatedAt
        WHERE id = $accountId
      `,
      {
        $balance: updatedBalance,
        $updatedAt: now,
        $accountId: transaction.accountId,
      },
    );

    await database.runAsync(
      `
        UPDATE transactions
        SET
          amount = $amount,
          type = $type,
          description = $description,
          category_id = $categoryId,
          account_id = $accountId,
          date = $date,
          updated_at = $updatedAt
        WHERE id = $id
      `,
      {
        $amount: transaction.amount,
        $type: transaction.type,
        $description: transaction.description,
        $categoryId: transaction.categoryId,
        $accountId: transaction.accountId,
        $date: transaction.date ?? current.date,
        $updatedAt: now,
        $id: id,
      },
    );
  });
}
