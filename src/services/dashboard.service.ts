import { getDatabase } from "../database/database";

export interface DashboardAccount {
  id: number;
  name: string;
  type: string;
  balance: number;
  /**
   * Limite total do cartão. `null` quando não informado ou quando a
   * conta não é cartão de crédito.
   */
  limitAmount: number | null;
}

export interface DashboardCategoryTotal {
  categoryId: number | null;
  name: string;
  total: number;
  /** Participação no total de gastos do mês (0-1). */
  share: number;
}

export interface DashboardRecentTransaction {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  source: string;
  date: string;
}

/** Resumo enxuto da meta mais relevante para o cartão do dashboard. */
export interface DashboardGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  /** Progresso em pontos percentuais (0-100). */
  progressPercentage: number;
  deadline: string | null;
  /** Dias restantes até o prazo. `null` quando a meta não tem prazo. */
  daysRemaining: number | null;
}

/**
 * Leitura de um cartão de crédito para exibição.
 *
 * Importante: nesta versão o `balance` do cartão representa o valor
 * **utilizado/dívida**, não dinheiro disponível. Fatura, fechamento e
 * vencimento ficam para a etapa de Cartões 3.0.
 */
export interface DashboardCreditCard {
  id: number;
  name: string;
  /** Limite usado (saldo negativo do cartão em módulo). */
  usedAmount: number;
  /** Limite cadastrado, quando informado. */
  limitAmount: number | null;
  /**
   * Limite ainda disponível (`limite - utilizado`).
   * `null` quando não há limite informado. Nunca é negativo: quando o
   * utilizado passa do limite, o valor é `0` e `isOverLimit` fica `true`.
   */
  availableAmount: number | null;
  /** Utilizado dividido pelo limite (0-1+). `null` sem limite informado. */
  usageRatio: number | null;
  /** `true` quando o valor utilizado superou o limite cadastrado. */
  isOverLimit: boolean;
}

export type DashboardInsightTone = "positive" | "warning" | "neutral";

export interface DashboardInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  tone: DashboardInsightTone;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  accounts: DashboardAccount[];
  monthIncome: number;
  monthExpenses: number;
  monthBalance: number;
  monthTransactionCount: number;
  /** Gastos do mês fechado anterior. Usado para comparação. */
  previousMonthExpenses: number;
  /** Entradas do mês fechado anterior. */
  previousMonthIncome: number;
  /**
   * Variação percentual dos gastos vs. mês anterior.
   * `null` quando não há base de comparação (mês anterior zerado).
   */
  expensesChangeRatio: number | null;
  /** Gastos do mês agrupados por categoria, do maior para o menor. */
  expensesByCategory: DashboardCategoryTotal[];
  /**
   * Total gasto no mês, incluindo despesas sem categoria.
   * `expensesByCategory` traz só as principais; este é o total real.
   */
  categorizedExpenseTotal: number;
  /** Movimentações mais recentes para o resumo rápido. */
  recentTransactions: DashboardRecentTransaction[];
  /** Saldo e limite usado dos cartões de crédito cadastrados. */
  creditCards: DashboardCreditCard[];
  /** Limite de cartão já utilizado, somando todos os cartões. */
  creditCardUsedTotal: number;
  /** Meta mais próxima de ser concluída, para o cartão de meta do dashboard. */
  featuredGoal: DashboardGoal | null;
  /** Quantidade de metas cadastradas. */
  goalCount: number;
  /** Leituras prontas sobre o mês, já com tom (positivo/alerta/neutro). */
  insights: DashboardInsight[];
  /** Nome do mês corrente em pt-BR (ex.: "Setembro"). */
  currentMonthName: string;
}

const RECENT_TRANSACTIONS_LIMIT = 5;
const TOP_CATEGORIES_LIMIT = 5;

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const database = await getDatabase();

  const transactions = await database.getFirstAsync<{
    totalIncome: number | null;
    totalExpenses: number | null;
    transactionCount: number;

    monthIncome: number | null;
    monthExpenses: number | null;
    monthTransactionCount: number;

    previousMonthIncome: number | null;
    previousMonthExpenses: number | null;
  }>(`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN type = 'income'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS totalIncome,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'expense'
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS totalExpenses,

        COUNT(*) AS transactionCount,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'income'
              AND strftime('%Y-%m', date)
                = strftime('%Y-%m', 'now')
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS monthIncome,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'expense'
              AND strftime('%Y-%m', date)
                = strftime('%Y-%m', 'now')
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS monthExpenses,

        COUNT(
          CASE
            WHEN strftime('%Y-%m', date)
              = strftime('%Y-%m', 'now')
            THEN 1
          END
        ) AS monthTransactionCount,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'income'
              AND strftime('%Y-%m', date)
                = strftime('%Y-%m', 'now', '-1 month')
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS previousMonthIncome,

        COALESCE(
          SUM(
            CASE
              WHEN type = 'expense'
              AND strftime('%Y-%m', date)
                = strftime('%Y-%m', 'now', '-1 month')
              THEN amount
              ELSE 0
            END
          ),
          0
        ) AS previousMonthExpenses

      FROM transactions
    `);

  const accounts = await database.getAllAsync<DashboardAccount>(`
      SELECT
        id,
        name,
        type,
        balance,
        limit_amount AS limitAmount
      FROM accounts
      ORDER BY name ASC
    `);

  const categoryTotals = await database.getAllAsync<{
    category_id: number | null;
    name: string | null;
    total: number;
  }>(
    `
      SELECT
        transactions.category_id AS category_id,
        categories.name AS name,
        SUM(transactions.amount) AS total
      FROM transactions
      LEFT JOIN categories
        ON categories.id = transactions.category_id
      WHERE transactions.type = 'expense'
        AND strftime('%Y-%m', transactions.date)
          = strftime('%Y-%m', 'now')
      GROUP BY transactions.category_id
      ORDER BY total DESC
    `,
  );

  const recentRows = await database.getAllAsync<{
    id: number;
    description: string | null;
    goal_name: string | null;
    amount: number;
    type: DashboardRecentTransaction["type"];
    source: string;
    date: string;
  }>(
    `
      SELECT
        transactions.id AS id,
        transactions.description AS description,
        goals.name AS goal_name,
        transactions.amount AS amount,
        transactions.type AS type,
        transactions.source AS source,
        transactions.date AS date
      FROM transactions
      LEFT JOIN goals
        ON goals.id = transactions.goal_id
      ORDER BY transactions.date DESC, transactions.id DESC
      LIMIT $limit
    `,
    { $limit: RECENT_TRANSACTIONS_LIMIT },
  );

  const goalRows = await database.getAllAsync<{
    id: number;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string | null;
  }>(`
    SELECT
      id,
      name,
      target_amount,
      current_amount,
      deadline
    FROM goals
    ORDER BY name ASC
  `);

  const totalIncome = transactions?.totalIncome ?? 0;

  const totalExpenses = transactions?.totalExpenses ?? 0;

  const monthIncome = transactions?.monthIncome ?? 0;

  const monthExpenses = transactions?.monthExpenses ?? 0;

  const previousMonthIncome = transactions?.previousMonthIncome ?? 0;

  const previousMonthExpenses = transactions?.previousMonthExpenses ?? 0;

  const categorizedExpensesTotal = categoryTotals.reduce(
    (total, item) => total + item.total,
    0,
  );

  const expensesByCategory: DashboardCategoryTotal[] = categoryTotals
    .slice(0, TOP_CATEGORIES_LIMIT)
    .map((item) => ({
      categoryId: item.category_id,
      name: item.name ?? "Sem categoria",
      total: item.total,
      share:
        categorizedExpensesTotal > 0
          ? item.total / categorizedExpensesTotal
          : 0,
    }));

  /*
   * Só dinheiro real entra no patrimônio. O `balance` do cartão é a
   * dívida (valor utilizado), não dinheiro disponível — somar isso
   * inflaria o saldo total. A dívida aparece à parte, em
   * `creditCardUsedTotal`.
   */
  const balance = accounts
    .filter((account) => account.type !== "credit_card")
    .reduce((total, account) => total + account.balance, 0);

  /*
   * Cartões de crédito guardam o valor utilizado em `balance`.
   * Lemos em módulo para aceitar tanto os lançamentos antigos (dívida
   * como saldo negativo) quanto os novos (dívida como saldo positivo).
   */
  const creditCards: DashboardCreditCard[] = accounts
    .filter((account) => account.type === "credit_card")
    .map((account) => {
      const usedAmount = Math.abs(account.balance);
      const limit = normalizeLimit(account.limitAmount);

      const availableAmount =
        limit === null ? null : Math.max(limit - usedAmount, 0);

      return {
        id: account.id,
        name: account.name,
        usedAmount,
        limitAmount: limit,
        availableAmount,
        usageRatio: limit === null ? null : usedAmount / limit,
        isOverLimit: limit !== null && usedAmount > limit,
      };
    });

  const creditCardUsedTotal = creditCards.reduce(
    (total, card) => total + card.usedAmount,
    0,
  );

  const goals: DashboardGoal[] = goalRows.map((row) => ({
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    remainingAmount: Math.max(row.target_amount - row.current_amount, 0),
    progressPercentage:
      row.target_amount > 0
        ? Math.min((row.current_amount / row.target_amount) * 100, 100)
        : 0,
    deadline: row.deadline,
    daysRemaining: getDaysRemaining(row.deadline),
  }));

  /*
   * Cartão de meta: prioriza quem está mais perto de terminar e ainda
   * não terminou. Sem isso, a meta mais antiga ocuparia o espaço para
   * sempre.
   */
  const featuredGoal =
    goals
      .filter((goal) => goal.remainingAmount > 0)
      .sort((a, b) => b.progressPercentage - a.progressPercentage)[0] ??
    goals[0] ??
    null;

  const categorizedExpenseTotal = categoryTotals.reduce(
    (total, item) => total + item.total,
    0,
  );

  const expensesChangeRatio =
    previousMonthExpenses > 0
      ? (monthExpenses - previousMonthExpenses) / previousMonthExpenses
      : null;

  return {
    totalIncome,
    totalExpenses,
    balance,
    transactionCount: transactions?.transactionCount ?? 0,

    accounts,

    monthIncome,
    monthExpenses,
    monthBalance: monthIncome - monthExpenses,

    monthTransactionCount: transactions?.monthTransactionCount ?? 0,

    previousMonthIncome,
    previousMonthExpenses,

    expensesChangeRatio,

    expensesByCategory,
    categorizedExpenseTotal,

    recentTransactions: recentRows.map((row) => ({
      id: row.id,
      description:
        row.type === "transfer" && row.goal_name
          ? `Aporte para: ${row.goal_name}`
          : (row.description ?? "Sem descrição"),
      amount: row.amount,
      type: row.type,
      source: row.source,
      date: row.date,
    })),

    creditCards,
    creditCardUsedTotal,

    featuredGoal,
    goalCount: goals.length,

    insights: buildInsights({
      monthExpenses,
      expensesChangeRatio,
      categorizedExpenseTotal,
      expensesByCategory,
      featuredGoal,
      creditCardUsedTotal,
      creditCards,
      transactionCount: transactions?.transactionCount ?? 0,
    }),

    currentMonthName: getCurrentMonthName(),
  };
}

/**
 * Nome do mês corrente em pt-BR, com a primeira letra maiúscula.
 * Usado como título do resumo mensal do dashboard.
 */
function getCurrentMonthName(): string {
  const month = new Date().toLocaleDateString("pt-BR", {
    month: "long",
  });

  return month.charAt(0).toUpperCase() + month.slice(1);
}

/**
 * Normaliza o limite lido do banco.
 * Qualquer coisa que não seja um número finito e positivo vira `null`
 * ("não informado") — evita `NaN`/`undefined` chegando na UI.
 */
function normalizeLimit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

/**
 * Dias entre hoje e o prazo da meta.
 * Negativo quando o prazo já passou; `null` quando não há prazo.
 */
function getDaysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;

  const [year, month, day] = deadline.split("-").map(Number);

  if (!year || !month || !day) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(year, month - 1, day);

  return Math.round(
    (target.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );
}

interface InsightInput {
  monthExpenses: number;
  expensesChangeRatio: number | null;
  categorizedExpenseTotal: number;
  expensesByCategory: DashboardCategoryTotal[];
  featuredGoal: DashboardGoal | null;
  creditCardUsedTotal: number;
  creditCards: DashboardCreditCard[];
  transactionCount: number;
}

/**
 * Transforma os números do mês em frases curtas.
 * São leituras determinísticas do próprio resumo: nada de heurística
 * escondida em outra tela, e nada de SQL extra.
 */
function buildInsights({
  monthExpenses,
  expensesChangeRatio,
  categorizedExpenseTotal,
  expensesByCategory,
  featuredGoal,
  creditCardUsedTotal,
  creditCards,
  transactionCount,
}: InsightInput): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  const topCategory = expensesByCategory[0];

  if (topCategory && topCategory.total > 0) {
    insights.push({
      id: "top-category",
      icon: "📊",
      title: `${topCategory.name} lidera seus gastos`,
      description: `Foram ${formatCurrency(topCategory.total)} no mês (${(topCategory.share * 100).toFixed(0)}% do total). Reduzir 10% libera ${formatCurrency(topCategory.total * 0.1)}.`,
      tone: "warning",
    });
  }

  if (expensesChangeRatio !== null) {
    const variation = Math.abs(expensesChangeRatio * 100).toFixed(0);

    insights.push({
      id: "month-comparison",
      icon: expensesChangeRatio <= 0 ? "📉" : "📈",
      title:
        expensesChangeRatio <= 0
          ? `Você gastou ${variation}% menos`
          : `Você gastou ${variation}% mais`,
      description:
        expensesChangeRatio <= 0
          ? `Comparado ao mês anterior, sobraram ${formatCurrency(monthExpenses * Math.abs(expensesChangeRatio))} no seu orçamento.`
          : `São ${formatCurrency(monthExpenses - monthExpenses / (1 + expensesChangeRatio))} a mais que no mês anterior.`,
      tone: expensesChangeRatio <= 0 ? "positive" : "warning",
    });
  }

  if (featuredGoal && featuredGoal.daysRemaining !== null) {
    if (featuredGoal.daysRemaining < 0) {
      insights.push({
        id: "goal-overdue",
        icon: "🎯",
        title: `${featuredGoal.name} passou do prazo`,
        description: `Faltam ${formatCurrency(featuredGoal.remainingAmount)} e a data já venceu. Ajuste o prazo para recalcular os planos.`,
        tone: "warning",
      });
    } else if (
      featuredGoal.daysRemaining > 0 &&
      featuredGoal.remainingAmount > 0
    ) {
      const monthsLeft = Math.max(featuredGoal.daysRemaining / 30.4375, 1);

      insights.push({
        id: "goal-pace",
        icon: "🎯",
        title: `${featuredGoal.name} está em ${featuredGoal.progressPercentage.toFixed(0)}%`,
        description: `Guardando ${formatCurrency(featuredGoal.remainingAmount / monthsLeft)} por mês você chega no prazo.`,
        tone: "neutral",
      });
    }
  }

  if (creditCardUsedTotal > 0 && monthExpenses > 0) {
    const share = creditCardUsedTotal / monthExpenses;

    if (share >= 0.5) {
      insights.push({
        id: "credit-card-usage",
        icon: "💳",
        title: "Cartão concentra suas compras",
        description: `Você tem ${formatCurrency(creditCardUsedTotal)} em limite usado. Isso é ${(share * 100).toFixed(0)}% do gasto do mês.`,
        tone: "warning",
      });
    }
  }

  const cardsOverLimit = creditCards.filter((card) => card.isOverLimit);

  if (cardsOverLimit.length > 0) {
    insights.push({
      id: "credit-card-over-limit",
      icon: "🚨",
      title:
        cardsOverLimit.length === 1
          ? `${cardsOverLimit[0].name} estourou o limite`
          : `${cardsOverLimit.length} cartões estouraram o limite`,
      description:
        "O valor utilizado passou do limite cadastrado. Vale revisar os gastos do cartão antes que a fatura feche.",
      tone: "warning",
    });
  }

  if (
    insights.length === 0 &&
    transactionCount > 0 &&
    categorizedExpenseTotal === 0
  ) {
    insights.push({
      id: "no-categories",
      icon: "🏷️",
      title: "Suas despesas estão sem categoria",
      description:
        "Categorizar os lançamentos é o que permite comparar meses e achar onde cortar.",
      tone: "neutral",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "keep-going",
      icon: "✨",
      title: "Continue registrando",
      description:
        "Com mais lançamentos o Wallet.ai padrões melhores para suas decisões.",
      tone: "neutral",
    });
  }

  return insights;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
