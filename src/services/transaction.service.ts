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
  validateTransaction(transaction.amount, transaction.type, transaction.accountId);
  return createTransaction(transaction);
}

export async function removeTransaction(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
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
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("ID de transação inválido.");
  }

  validateTransaction(transaction.amount, transaction.type, transaction.accountId);
  await updateTransaction(id, transaction);
}

function validateTransaction(
  amount: number,
  type: Transaction["type"],
  accountId: number,
): void {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("O valor da transação deve ser um número válido maior que zero.");
  }

  if (type !== "income" && type !== "expense" && type !== "transfer") {
    throw new Error("O tipo da transação é inválido.");
  }

  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("A conta da transação é obrigatória.");
  }
}
