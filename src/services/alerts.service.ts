import { listMonthlyBudgets, type MonthlyBudget } from "./budget.service";
import { listRecurringItems, type RecurringItem } from "./recurring.service";

export interface FinancialAlert {
  id: string;
  kind: "budget" | "due";
  severity: "warning" | "danger" | "info";
  title: string;
  description: string;
  date?: string;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function dayStart(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}
function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}
function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(value: string) {
  return parseDate(value).toLocaleDateString("pt-BR");
}

export async function getFinancialAlerts(): Promise<FinancialAlert[]> {
  const today = dayStart(new Date());
  const [budgets, recurring] = await Promise.all([
    listMonthlyBudgets(monthKey(today)),
    listRecurringItems(),
  ]);
  const alerts: FinancialAlert[] = [];

  budgets.forEach((budget: MonthlyBudget) => {
    const ratio = budget.amount > 0 ? budget.spent / budget.amount : 0;
    if (ratio >= 1) alerts.push({
      id: `budget-${budget.id}`, kind: "budget", severity: "danger",
      title: `Limite de ${budget.categoryName} ultrapassado`,
      description: `Você usou ${formatCurrency(budget.spent)} de ${formatCurrency(budget.amount)}.`,
    });
    else if (ratio >= 0.8) alerts.push({
      id: `budget-${budget.id}`, kind: "budget", severity: "warning",
      title: `Atenção ao orçamento de ${budget.categoryName}`,
      description: `Você já usou ${Math.round(ratio * 100)}% do limite; restam ${formatCurrency(budget.amount - budget.spent)}.`,
    });
  });

  recurring.forEach((item: RecurringItem) => {
    const due = parseDate(item.nextDueDate);
    const days = Math.round((dayStart(due).getTime() - today.getTime()) / 86400000);
    if (days < 0) alerts.push({
      id: `due-${item.id}`, kind: "due", severity: "danger",
      title: `${item.title} está vencida`,
      description: `${item.type === "expense" ? "Conta a pagar" : "Entrada prevista"} de ${formatCurrency(item.amount)} · vencimento ${formatDate(item.nextDueDate)}.`,
      date: item.nextDueDate,
    });
    else if (days <= 3) alerts.push({
      id: `due-${item.id}`, kind: "due", severity: days === 0 ? "warning" : "info",
      title: days === 0 ? `${item.title} vence hoje` : `${item.title} vence em ${days} dia(s)`,
      description: `${item.type === "expense" ? "Conta a pagar" : "Entrada prevista"} de ${formatCurrency(item.amount)} · ${formatDate(item.nextDueDate)}.`,
      date: item.nextDueDate,
    });
  });

  const rank = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
