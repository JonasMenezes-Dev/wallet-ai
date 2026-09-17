export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer';

export type TransactionSource =
  | 'manual'
  | 'notification'
  | 'import'
  | 'open_finance';

export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  description: string | null;
  merchant: string | null;
  date: string;
  categoryId: number | null;
  accountId: number | null;
  paymentMethod: string | null;
  goalId: number | null;
  goalName?: string | null;
  isAutomatic: boolean;
  source: TransactionSource;
  /**
   * Identificador da transação na origem (notificação, extrato ou Open Finance).
   * Junto de `provider` e `institution`, forma a chave de deduplicação.
   */
  externalId: string | null;
  /** Provedor/integrador de onde a transação veio. */
  provider: string | null;
  /** Instituição financeira de origem. */
  institution: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Campos resolvidos por JOIN na leitura, não informados na gravação.
 * Ficam separados para que criar/editar uma transação não exija passá-los.
 */
export interface TransactionRelations {
  /** Nome da categoria. `null` quando a transação não está categorizada. */
  categoryName: string | null;
  /** Nome da conta. `null` se a conta foi removida. */
  accountName: string | null;
}

/** Transação como a listagem consome: já com os nomes resolvidos. */
export type TransactionWithRelations = Transaction & TransactionRelations;