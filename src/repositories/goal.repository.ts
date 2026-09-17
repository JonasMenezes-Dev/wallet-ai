import { getDatabase } from '../database/database';
import { Goal } from '../types/goal';

export async function getAllGoals(): Promise<Goal[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<Goal>(`
    SELECT
      id,
      name,
      target_amount AS targetAmount,
      current_amount AS currentAmount,
      deadline,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM goals
    ORDER BY deadline ASC
  `);

  return rows;
}

export async function createGoal(
  goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      INSERT INTO goals (
        name,
        target_amount,
        current_amount,
        deadline,
        created_at,
        updated_at
      )
      VALUES ($name, $targetAmount, $currentAmount, $deadline, $createdAt, $updatedAt)
    `,
    {
      $name: goal.name,
      $targetAmount: goal.targetAmount,
      $currentAmount: goal.currentAmount,
      $deadline: goal.deadline,
      $createdAt: now,
      $updatedAt: now,
    },
  );

  return result.lastInsertRowId;
}

export async function addGoalContribution(
  goalId: number,
  accountId: number,
  amount: number
): Promise<void> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    const goal = await database.getFirstAsync<{
      id: number;
      name: string;
      current_amount: number;
      target_amount: number;
    }>(
      `
        SELECT
          id,
          current_amount,
          target_amount
        FROM goals
        WHERE id = $goalId
      `,
      { $goalId: goalId },
    );

    if (!goal) {
      throw new Error('Meta não encontrada.');
    }

    const account = await database.getFirstAsync<{
      id: number;
      balance: number;
      name: string;
    }>(
      `
        SELECT
          id,
          balance,
          name
        FROM accounts
        WHERE id = $accountId
      `,
      { $accountId: accountId },
    );

    if (!account) {
      throw new Error('Conta não encontrada.');
    }

    if (amount <= 0) {
      throw new Error(
        'O valor do aporte deve ser maior que zero.'
      );
    }

    if (account.balance < amount) {
      throw new Error(
        'Saldo insuficiente na conta.'
      );
    }

    if (
      goal.current_amount + amount >
      goal.target_amount
    ) {
      throw new Error(
        'O aporte ultrapassa o valor da meta.'
      );
    }

    const newGoalAmount =
      goal.current_amount + amount;

    const newAccountBalance =
      account.balance - amount;

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
        $goalId: goalId,
      },
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
        $accountId: accountId,
      },
    );

    await database.runAsync(
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
        updated_at,
        goal_id
      )
      VALUES ($amount, $type, $description, $merchant, $date, $categoryId, $accountId, $paymentMethod, $isAutomatic, $source, $createdAt, $updatedAt, $goalId)
    `,
    {
      $amount: amount,
      $type: 'transfer',
      $description: `Aporte para a meta: ${goal.name}`,
      $merchant: null,
      $date: now,
      $categoryId: null,
      $accountId: accountId,
      $paymentMethod: null,
      $isAutomatic: 0,
      $source: 'manual',
      $createdAt: now,
      $updatedAt: now,
      $goalId: goalId,
    },
  );
  });
}

export async function deleteGoal(
  goalId: number
): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(
    async () => {
      const goal = await database.getFirstAsync<{
        id: number;
        current_amount: number;
      }>(
        `
          SELECT
            id,
            current_amount
          FROM goals
          WHERE id = $goalId
        `,
        { $goalId: goalId },
      );

      if (!goal) {
        throw new Error(
          'Meta não encontrada.'
        );
      }

      if (goal.current_amount > 0) {
        throw new Error(
          'Não é possível excluir uma meta que possui dinheiro guardado. Retire o valor primeiro.'
        );
      }

      await database.runAsync(
        `
          DELETE FROM goals
          WHERE id = $goalId
        `,
        { $goalId: goalId },
      );
    }
  );
}

export async function getGoalById(
  goalId: number
): Promise<Goal | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<{
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT
        id,
        name,
        target_amount,
        current_amount,
        deadline,
        created_at,
        updated_at
      FROM goals
      WHERE id = $goalId
    `,
    { $goalId: goalId },
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateGoal(
  goalId: number,
  goal: {
    name: string;
    targetAmount: number;
    deadline: string | null;
  }
): Promise<void> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  const result = await database.runAsync(
    `
      UPDATE goals
      SET
        name = $name,
        target_amount = $targetAmount,
        deadline = $deadline,
        updated_at = $updatedAt
      WHERE id = $id
    `,
    {
      $name: goal.name,
      $targetAmount: goal.targetAmount,
      $deadline: goal.deadline,
      $updatedAt: now,
      $id: goalId,
    },
  );

  if (result.changes === 0) {
    throw new Error('Meta não encontrada.');
  }
}