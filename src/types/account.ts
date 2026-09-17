export type AccountType = "bank" | "credit_card" | "benefit" | "cash" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  /**
   * Para contas comuns: o dinheiro disponível.
   *
   * Para `credit_card`: nesta primeira versão o sinal é o do lançamento —
   * ou seja, o valor **utilizado/dívida** do cartão (negativo quando há
   * gasto em aberto). Fatura, fechamento e vencimento ficam para a etapa
   * de Cartões 3.0; por isso o limite de crédito mora em `limitAmount`,
   * separado do saldo, para não misturar crédito com dinheiro real.
   */
  balance: number;
  /**
   * Limite total de crédito, só faz sentido para `credit_card`.
   * `null` = não informado (diferente de zero, que seria um limite válido).
   */
  limitAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Dados aceitos na criação/edição de uma conta. */
export type AccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;
