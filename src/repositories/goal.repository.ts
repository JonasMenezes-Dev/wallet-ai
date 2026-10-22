import { getDatabase, withTransferTransaction } from '../database/database';
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

/** Money lives either in a free account or in a goal, never in both. */
export async function addGoalContribution(goalId: number, accountId: number, amount: number): Promise<void> {
  await moveGoalMoney(goalId, accountId, amount, "contribution");
}

export async function addGoalWithdrawal(goalId: number, accountId: number, amount: number): Promise<void> {
  await moveGoalMoney(goalId, accountId, amount, "withdrawal");
}

export async function updateGoalMovement(id: number, accountId: number, amount: number): Promise<void> {
  await moveGoalMoney(null, accountId, amount, null, id);
}

async function moveGoalMoney(
  goalId: number | null, accountId: number, amount: number,
  direction: "contribution" | "withdrawal" | null, id?: number,
): Promise<void> {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents <= 0 || Math.abs(amount * 100 - cents) > 1e-7 ||
      !Number.isSafeInteger(accountId) || accountId <= 0 ||
      (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) ||
      (id === undefined && (!Number.isSafeInteger(goalId) || (goalId ?? 0) <= 0))) {
    throw new Error("Informe conta, meta e valor válidos, com no máximo duas casas decimais.");
  }
  await withTransferTransaction(async (database) => {
    const old = id === undefined ? null : await database.getFirstAsync<{
      goal_id: number; account_id: number; amount: number; goal_movement: string | null; type: string; transfer_id: string | null;
    }>("SELECT goal_id, account_id, amount, goal_movement, type, transfer_id FROM transactions WHERE id = ?", id);
    if (id !== undefined && (!old?.goal_id || old.type !== "transfer" || old.transfer_id)) {
      throw new Error("Movimentação de meta não encontrada.");
    }
    const targetGoalId = old?.goal_id ?? goalId!;
    const movement = old ? (old.goal_movement ?? "contribution") : direction!;
    const goal = await database.getFirstAsync<{ current_amount: number; target_amount: number; name: string }>(
      "SELECT current_amount, target_amount, name FROM goals WHERE id = ?", targetGoalId);
    if (!goal) throw new Error("Meta não encontrada.");
    const accountIds = new Set([accountId, ...(old ? [old.account_id] : [])]);
    const balances = new Map<number, number>();
    for (const accountKey of accountIds) {
      const account = await database.getFirstAsync<{ balance: number; type: string }>(
        "SELECT balance, type FROM accounts WHERE id = ?", accountKey);
      if (!account || account.type === "credit_card") throw new Error("Selecione uma conta comum para movimentar a meta.");
      balances.set(accountKey, Math.round(account.balance * 100));
    }
    // Reverse and apply in memory; validate the final state before any writes.
    let reserved = Math.round(goal.current_amount * 100);
    if (old) {
      const oldDelta = (old.goal_movement === "withdrawal" ? -1 : 1) * Math.round(old.amount * 100);
      reserved -= oldDelta;
      balances.set(old.account_id, balances.get(old.account_id)! + oldDelta);
    }
    const delta = (movement === "withdrawal" ? -1 : 1) * cents;
    reserved += delta;
    balances.set(accountId, balances.get(accountId)! - delta);
    if (reserved < 0 || (movement === "contribution" && reserved > Math.round(goal.target_amount * 100)) ||
        !Number.isSafeInteger(reserved) || [...balances.values()].some(value => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error("Saldo insuficiente ou valor acima da meta. Os saldos não foram alterados.");
    }
    const now = new Date().toISOString();
    for (const [accountKey, balance] of balances) {
      await database.runAsync("UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?", balance / 100, now, accountKey);
    }
    await database.runAsync("UPDATE goals SET current_amount = ?, updated_at = ? WHERE id = ?", reserved / 100, now, targetGoalId);
    if (id !== undefined) {
      await database.runAsync("UPDATE transactions SET amount = ?, account_id = ?, updated_at = ? WHERE id = ?", cents / 100, accountId, now, id);
    } else {
      await database.runAsync(`INSERT INTO transactions
        (amount, type, description, date, account_id, goal_id, goal_movement, is_automatic, source, created_at, updated_at)
        VALUES (?, 'transfer', ?, ?, ?, ?, ?, 0, 'manual', ?, ?)`,
        cents / 100, `${movement === "withdrawal" ? "Resgate da" : "Aporte para a"} meta: ${goal.name}`,
        now, accountId, targetGoalId, movement, now, now);
    }
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