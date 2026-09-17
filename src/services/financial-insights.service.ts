import { getDatabase } from "../database/database";

export interface FinancialInsight {
  title: string;
  description: string;
  tone: "positive" | "warning" | "neutral";
}

/**
 * Leituras complementares ao dashboard: aqui o critério é a renda cadastrada,
 * que não faz parte do resumo de transações. As leituras que dependem só do
 * mês (categoria líder, comparação com o mês anterior, ritmo da meta) já
 * nascem em `dashboard.service`, para não existir SQL concorrente.
 */
export async function getFinancialInsights(): Promise<FinancialInsight[]> {
  const database = await getDatabase();

  const settings = await database.getFirstAsync<{ salary: number }>(
    "SELECT salary FROM user_settings ORDER BY id LIMIT 1",
  );

  const monthly = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE type = 'expense'
       AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`,
  );

  const salary = settings?.salary ?? 0;
  const expenses = monthly?.total ?? 0;

  const insights: FinancialInsight[] = [];

  if (salary > 0 && expenses < salary * 0.7) {
    insights.push({
      title: "Espaço para investir",
      description: `Seu gasto mensal está abaixo de 70% da renda cadastrada. Considere direcionar até ${formatCurrency((salary - expenses) * 0.2)} para uma reserva ou objetivo.`,
      tone: "positive",
    });
  } else if (salary > 0 && expenses >= salary * 0.9) {
    insights.push({
      title: "Proteja seu orçamento",
      description:
        "Os gastos estão próximos da renda cadastrada. Priorize despesas essenciais antes de investir.",
      tone: "warning",
    });
  } else if (salary === 0) {
    insights.push({
      title: "Cadastre sua renda",
      description:
        "Com a renda cadastrada, o Wallet.ai compara seus gastos com o que você ganha e mostra quanto sobra por mês.",
      tone: "neutral",
    });
  }

  return insights;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
