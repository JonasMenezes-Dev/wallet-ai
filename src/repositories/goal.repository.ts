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