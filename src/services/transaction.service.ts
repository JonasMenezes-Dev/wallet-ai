import {
  createTransaction,
  deleteTransaction,
  getAllTransactions,
  updateTransaction,
} from "../repositories/transaction.repository";

import { Transaction, TransactionWithRelations } from "../types/transaction";

export async function listTransactions(): Promise<TransactionWithRelations[]> {
  return getAllTransactions();
}

export async function addTransaction(
  transaction: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  if (transaction.amount <= 0) {
    throw new Error("O valor da transação deve ser maior que zero.");
  }

  if (!transaction.type) {
    throw new Error("O tipo da transação é obrigatório.");
  }

  if (!transaction.accountId) {
    throw new Error("A conta da transação é obrigatória.");
  }

  return createTransaction(transaction);
}

export async function removeTransaction(id: number): Promise<void> {
  if (id <= 0) {
    throw new Error("ID de transação inválido.");
  }

  await deleteTransaction(id);
}

export interface TransactionEditPayload {
  amount: number;
  type: Transaction["type"];
  description: string | null;
  categoryId: number | null;
  accountId: number;
  /** Nova data (`YYYY-MM-DD` ou ISO). Omitir mantém a data atual. */
  date?: string;
}

export async function editTransaction(
  id: number,
  transaction: TransactionEditPayload,
): Promise<void> {
  if (id <= 0) {
    throw new Error("ID de transação inválido.");
  }

  if (transaction.amount <= 0) {
    throw new Error("O valor da transação deve ser maior que zero.");
  }

  if (!transaction.accountId) {
    throw new Error("A conta da transação é obrigatória.");
  }

  await updateTransaction(id, transaction);
}
