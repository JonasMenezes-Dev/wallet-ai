import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  getAllGoals,
  getGoalById,
  updateGoal,
} from "../repositories/goal.repository";

import { Goal } from "../types/goal";

export interface GoalPlan {
  monthlyAmount: number;
  estimatedDate: string | null;
}

export type GoalDeadlineStatus =
  | "no-deadline"
  | "overdue"
  | "on-track"
  | "completed";

export interface GoalProgress {
  remainingAmount: number;
  progressPercentage: number;
  deadlineStatus: GoalDeadlineStatus;
  daysRemaining: number | null;
  plans: {
    aggressive: GoalPlan;
    balanced: GoalPlan;
    comfortable: GoalPlan;
  };
}

export async function listGoals(): Promise<Goal[]> {
  return getAllGoals();
}

export async function addGoal(
  goal: Omit<Goal, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  if (!goal.name.trim()) {
    throw new Error("O nome da meta é obrigatório.");
  }

  if (goal.targetAmount <= 0) {
    throw new Error("O valor da meta deve ser maior que zero.");
  }

  if (goal.currentAmount < 0) {
    throw new Error("O valor atual não pode ser negativo.");
  }

  if (goal.currentAmount > goal.targetAmount) {
    throw new Error("O valor atual não pode ser maior que a meta.");
  }

  validateDeadline(goal.deadline);

  return createGoal(goal);
}

export async function contributeToGoal(
  goalId: number,
  accountId: number,
  amount: number,
): Promise<void> {
  if (goalId <= 0) {
    throw new Error("Meta inválida.");
  }

  if (accountId <= 0) {
    throw new Error("Conta inválida.");
  }

  if (amount <= 0) {
    throw new Error("O valor do aporte deve ser maior que zero.");
  }

  await addGoalContribution(goalId, accountId, amount);
}

export async function removeGoal(goalId: number): Promise<void> {
  if (goalId <= 0) {
    throw new Error("ID de meta inválido.");
  }

  await deleteGoal(goalId);
}

export function calculateGoalProgress(goal: Goal): GoalProgress {
  const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0);

  const progressPercentage =
    goal.targetAmount > 0
      ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
      : 0;

  const emptyPlan: GoalPlan = {
    monthlyAmount: 0,
    estimatedDate: null,
  };

  if (remainingAmount <= 0) {
    return {
      remainingAmount,
      progressPercentage,
      deadlineStatus: "completed",
      daysRemaining: goal.deadline ? 0 : null,
      plans: {
        aggressive: emptyPlan,
        balanced: emptyPlan,
        comfortable: emptyPlan,
      },
    };
  }

  if (!goal.deadline) {
    return {
      remainingAmount,
      progressPercentage,
      deadlineStatus: "no-deadline",
      daysRemaining: null,
      plans: {
        aggressive: emptyPlan,
        balanced: emptyPlan,
        comfortable: emptyPlan,
      },
    };
  }

  const today = startOfDay(new Date());
  const deadline = parseLocalDate(goal.deadline);
  const daysRemaining = Math.ceil(
    (deadline.getTime() - today.getTime()) / DAY_IN_MILLISECONDS,
  );

  if (daysRemaining < 0) {
    return {
      remainingAmount,
      progressPercentage,
      deadlineStatus: "overdue",
      daysRemaining,
      plans: {
        aggressive: emptyPlan,
        balanced: emptyPlan,
        comfortable: emptyPlan,
      },
    };
  }

  const monthsRemaining = Math.max(
    daysRemaining / AVERAGE_DAYS_PER_MONTH,
    1 / AVERAGE_DAYS_PER_MONTH,
  );

  const balancedMonthlyAmount = Math.max(
    roundMoney(remainingAmount / monthsRemaining),
    0.01,
  );
  const aggressiveMonthlyAmount = Math.max(
    roundMoney(balancedMonthlyAmount * 1.25),
    0.01,
  );
  const comfortableMonthlyAmount = Math.max(
    roundMoney(balancedMonthlyAmount * 0.75),
    0.01,
  );

  const aggressiveDays = Math.max(
    Math.ceil(
      daysRemaining * (balancedMonthlyAmount / aggressiveMonthlyAmount),
    ),
    0,
  );
  const comfortableDays = Math.max(
    Math.ceil(
      daysRemaining * (balancedMonthlyAmount / comfortableMonthlyAmount),
    ),
    0,
  );

  return {
    remainingAmount,
    progressPercentage,
    deadlineStatus: "on-track",
    daysRemaining,

    plans: {
      aggressive: {
        monthlyAmount: aggressiveMonthlyAmount,
        estimatedDate: formatEstimatedDate(addDays(today, aggressiveDays)),
      },

      balanced: {
        monthlyAmount: balancedMonthlyAmount,
        estimatedDate: formatEstimatedDate(deadline),
      },

      comfortable: {
        monthlyAmount: comfortableMonthlyAmount,
        estimatedDate: formatEstimatedDate(addDays(today, comfortableDays)),
      },
    },
  };
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const AVERAGE_DAYS_PER_MONTH = 30.4375;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function validateDeadline(value: string | null): void {
  if (!value) {
    return;
  }

  const date = parseLocalDate(value);
  const [year, month, day] = value.split("-").map(Number);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date < startOfDay(new Date())
  ) {
    throw new Error("O prazo deve ser uma data válida a partir de hoje.");
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

function formatEstimatedDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function loadGoal(goalId: number): Promise<Goal | null> {
  if (goalId <= 0) {
    throw new Error("ID de meta inválido.");
  }

  return getGoalById(goalId);
}

export async function editGoal(
  goalId: number,
  data: {
    name: string;
    targetAmount: number;
    deadline: string | null;
  },
): Promise<void> {
  if (goalId <= 0) {
    throw new Error("ID de meta inválido.");
  }

  if (!data.name.trim()) {
    throw new Error("O nome da meta é obrigatório.");
  }

  if (data.targetAmount <= 0) {
    throw new Error("O valor da meta deve ser maior que zero.");
  }

  const currentGoal = await getGoalById(goalId);

  if (!currentGoal) {
    throw new Error("Meta não encontrada.");
  }

  if (data.targetAmount < currentGoal.currentAmount) {
    throw new Error(
      "O valor da meta não pode ser menor que o valor já guardado.",
    );
  }

  validateDeadline(data.deadline);

  await updateGoal(goalId, {
    name: data.name.trim(),
    targetAmount: data.targetAmount,
    deadline: data.deadline,
  });
}
