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
    transfer_id: string | null;
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
      transactions.transfer_id AS transfer_id,
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
    type: row.transfer_id ? "transfer" : row.type,
    description:
      row.transfer_id
        ? row.description
        : row.type === "transfer" && row.goal_name
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
    transferId: row.transfer_id,
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
    if (transaction.externalId && transaction.provider && transaction.institution) {
      const duplicate = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM transactions
         WHERE external_id = $externalId AND provider = $provider AND institution = $institution`,
        { $externalId: transaction.externalId, $provider: transaction.provider, $institution: transaction.institution },
      );
      if (duplicate) throw new Error("Esta notificação já foi registrada.");
    }

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
          external_id,
          provider,
          institution,
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
          $externalId,
          $provider,
          $institution,
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
        $externalId: transaction.externalId,
        $provider: transaction.provider,
        $institution: transaction.institution,
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

export async function createAccountTransfer(input: {
  amount: number;
  fromAccountId: number;
  toAccountId: number;
  description: string | null;
  date: string;
}): Promise<string> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const transferId = `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Escolha duas contas diferentes para a transferência.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("O valor da transferência deve ser maior que zero.");
  }

  await database.withTransactionAsync(async () => {
    const from = await database.getFirstAsync<{ id: number; balance: number; type: Account["type"] }>(
      "SELECT id, balance, type FROM accounts WHERE id = $id",
      { $id: input.fromAccountId },
    );
    const to = await database.getFirstAsync<{ id: number; balance: number; type: Account["type"] }>(
      "SELECT id, balance, type FROM accounts WHERE id = $id",
      { $id: input.toAccountId },
    );

    if (!from || !to) throw new Error("Uma das contas selecionadas não existe.");
    if (from.type === "credit_card" || to.type === "credit_card") {
      throw new Error("Transferências entre contas não podem envolver cartão de crédito. Registre o pagamento da fatura separadamente.");
    }
    const sourceBalance = from.balance - input.amount;
    const destinationBalance = to.balance + input.amount;
    if (!Number.isFinite(sourceBalance) || sourceBalance < 0 || !Number.isFinite(destinationBalance)) {
      throw new Error("Saldo insuficiente na conta de origem ou valor inválido.");
    }

    for (const entry of [
      { accountId: from.id, type: "expense", description: input.description?.trim() || "Transferência enviada" },
      { accountId: to.id, type: "income", description: input.description?.trim() || "Transferência recebida" },
    ] as const) {
      await database.runAsync(
        `INSERT INTO transactions (
          amount, type, description, merchant, date, category_id, account_id,
          payment_method, is_automatic, source, external_id, provider, institution,
          created_at, updated_at, transfer_id
        ) VALUES (
          $amount, $type, $description, NULL, $date, NULL, $accountId,
          NULL, 0, 'manual', NULL, NULL, NULL, $createdAt, $updatedAt, $transferId
        )`,
        {
          $amount: input.amount,
          $type: entry.type,
          $description: entry.description,
          $date: input.date,
          $accountId: entry.accountId,
          $createdAt: now,
          $updatedAt: now,
          $transferId: transferId,
        },
      );
    }

    await database.runAsync(
      "UPDATE accounts SET balance = $balance, updated_at = $now WHERE id = $id",
      { $balance: sourceBalance, $now: now, $id: from.id },
    );
    await database.runAsync(
      "UPDATE accounts SET balance = $balance, updated_at = $now WHERE id = $id",
      { $balance: destinationBalance, $now: now, $id: to.id },
    );
  });

  return transferId;
}

export async function deleteTransaction(id: number): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    const transaction = await database.getFirstAsync<{
      amount: number;
      type: Transaction["type"];
      account_id: number | null;
      goal_id: number | null;
      transfer_id: string | null;
    }>(
      `
        SELECT
          amount,
          type,
          account_id,
          goal_id,
          transfer_id
        FROM transactions
        WHERE id = $id
      `,
      { $id: id },
    );

    if (!transaction) {
      throw new Error("Transação não encontrada.");
    }

    const now = new Date().toISOString();

    if (transaction.transfer_id) {
      const entries = await database.getAllAsync<{
        amount: number;
        type: "income" | "expense";
        account_id: number;
      }>(
        "SELECT amount, type, account_id FROM transactions WHERE transfer_id = $transferId",
        { $transferId: transaction.transfer_id },
      );
      if (entries.length !== 2) {
        throw new Error("A transferência está incompleta; os saldos não foram alterados.");
      }

      for (const entry of entries) {
        const account = await database.getFirstAsync<{ balance: number; type: Account["type"] }>(
          "SELECT balance, type FROM accounts WHERE id = $id",
          { $id: entry.account_id },
        );
        if (!account) throw new Error("Uma conta da transferência não foi encontrada.");
        const restored = applyTransactionToAccount(account.balance, account.type, entry.type, -entry.amount);
        if (isBalanceInvalid(restored, account.type)) {
          throw new Error("Não foi possível estornar a transferência com segurança.");
        }
        await database.runAsync(
          "UPDATE accounts SET balance = $balance, updated_at = $now WHERE id = $id",
          { $balance: restored, $now: now, $id: entry.account_id },
        );
      }

      await database.runAsync(
        "DELETE FROM transactions WHERE transfer_id = $transferId",
        { $transferId: transaction.transfer_id },
      );
      return;
    }

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
      transfer_id: string | null;
      date: string;
    }>(
      `
        SELECT amount, type, account_id, goal_id, transfer_id, date
        FROM transactions
        WHERE id = $id
      `,
      { $id: id },
    );

    if (!current) {
      throw new Error("Transação não encontrada.");
    }

    if (current.transfer_id) {
      throw new Error("Transferências entre contas não podem ser editadas individualmente. Exclua a transferência completa e registre-a novamente.");
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
