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
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    goal.name,
    goal.targetAmount,
    goal.currentAmount,
    goal.deadline,
    now,
    now
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
      current_amount: number;
      target_amount: number;
    }>(
      `
        SELECT
          id,
          current_amount,
          target_amount
        FROM goals
        WHERE id = ?
      `,
      goalId
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
        WHERE id = ?
      `,
      accountId
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
          current_amount = ?,
          updated_at = ?
        WHERE id = ?
      `,
      newGoalAmount,
      now,
      goalId
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
      accountId
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    amount,
    'transfer',
    `Aporte para a meta: ${goal.id}`,
    null,
    now,
    null,
    accountId,
    null,
    0,
    'manual',
    now,
    now,
    goalId
  );
  });
}