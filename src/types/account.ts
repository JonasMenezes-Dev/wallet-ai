export type AccountType = "bank" | "credit_card" | "benefit" | "cash" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  /**
   * Para contas comuns: dinheiro disponível.
   *
   * Para `credit_card`: valor utilizado/dívida em aberto, armazenado como
   * número positivo. Uma despesa aumenta esse valor e uma entrada (como
   * pagamento/estorno) reduz. O limite fica separado em `limitAmount`.
   * Fatura, fechamento e vencimento ficam para Cartões 3.0.
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
