import {
  createGoal,
  getAllGoals,
} from '../repositories/goal.repository';

import { Goal } from '../types/goal';

export async function listGoals(): Promise<Goal[]> {
  return getAllGoals();
}

export async function addGoal(
  goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  if (!goal.name.trim()) {
    throw new Error('O nome da meta é obrigatório.');
  }

  if (goal.targetAmount <= 0) {
    throw new Error('O valor da meta deve ser maior que zero.');
  }

  if (goal.currentAmount < 0) {
    throw new Error('O valor atual não pode ser negativo.');
  }

  return createGoal(goal);
}