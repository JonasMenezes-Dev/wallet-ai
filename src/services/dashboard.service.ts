import { getDatabase } from "../database/database";

export interface DashboardAccount {
  id: number;
  name: string;
  type: string;
  balance: number;
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
  /** Nome do mês corrente em pt-BR (ex.: "Setembro"). */
  currentMonthName: string;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const database = await getDatabase();

  const transactions = await database.getFirstAsync<{
    totalIncome: number | null;
    totalExpenses: number | null;
    transactionCount: number;

    monthIncome: number | null;
    monthExpenses: number | null;
    monthTransactionCount: number;
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
        ) AS monthTransactionCount

      FROM transactions
    `);

  const accounts = await database.getAllAsync<DashboardAccount>(`
      SELECT
        id,
        name,
        type,
        balance
      FROM accounts
      ORDER BY name ASC
    `);

  const totalIncome = transactions?.totalIncome ?? 0;

  const totalExpenses = transactions?.totalExpenses ?? 0;

  const monthIncome = transactions?.monthIncome ?? 0;

  const monthExpenses = transactions?.monthExpenses ?? 0;

  const balance = accounts.reduce(
    (total, account) => total + account.balance,
    0,
  );

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
