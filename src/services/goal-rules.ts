/**
 * Validações puras das regras de metas. Mantidas fora dos serviços SQLite
 * para que possam ser cobertas por testes sem abrir o banco nativo do Expo.
 */

export type GoalDraft = {
  name: string;
  targetAmount: number;
  currentAmount: number;
};

export function validateGoalDraft(goal: GoalDraft): void {
  if (!goal.name.trim()) {
    throw new Error("O nome da meta é obrigatório.");
  }

  if (!Number.isFinite(goal.targetAmount) || goal.targetAmount <= 0) {
    throw new Error("O valor da meta deve ser maior que zero.");
  }

  if (!Number.isFinite(goal.currentAmount) || goal.currentAmount < 0) {
    throw new Error("O valor atual deve ser um número válido não negativo.");
  }

  if (goal.currentAmount > goal.targetAmount) {
    throw new Error("O valor atual não pode ser maior que a meta.");
  }
}

export function validateGoalNameAndTarget(
  name: string,
  targetAmount: number,
): void {
  if (!name.trim()) {
    throw new Error("O nome da meta é obrigatório.");
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error("O valor da meta deve ser maior que zero.");
  }
}

export function validateGoalContributionInput(
  goalId: number,
  accountId: number,
  amount: number,
): void {
  validateGoalId(goalId, "Meta inválida.");
  validateGoalId(accountId, "Conta inválida.");

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("O valor do aporte deve ser maior que zero.");
  }
}

export function validateGoalId(goalId: number, message: string): void {
  if (!Number.isSafeInteger(goalId) || goalId <= 0) {
    throw new Error(message);
  }
}
