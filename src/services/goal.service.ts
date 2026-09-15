import {
  addGoalContribution,
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
    throw new Error(
      'O nome da meta é obrigatório.'
    );
  }

  if (goal.targetAmount <= 0) {
    throw new Error(
      'O valor da meta deve ser maior que zero.'
    );
  }

  if (goal.currentAmount < 0) {
    throw new Error(
      'O valor atual não pode ser negativo.'
    );
  }

  if (
    goal.currentAmount >
    goal.targetAmount
  ) {
    throw new Error(
      'O valor atual não pode ser maior que a meta.'
    );
  }

  return createGoal(goal);
}

export async function contributeToGoal(
  goalId: number,
  accountId: number,
  amount: number
): Promise<void> {
  if (goalId <= 0) {
    throw new Error('Meta inválida.');
  }

  if (accountId <= 0) {
    throw new Error('Conta inválida.');
  }

  if (amount <= 0) {
    throw new Error(
      'O valor do aporte deve ser maior que zero.'
    );
  }

  await addGoalContribution(
    goalId,
    accountId,
    amount
  );
}