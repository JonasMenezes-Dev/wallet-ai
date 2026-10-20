import {
  createAccountTransfer,
  createCardPayment,
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
  validateTransactionPurpose(transaction.type, transaction.goalId);
  return createTransaction(transaction);
}

export async function transferBetweenAccounts(input: {
  amount: number;
  fromAccountId: number;
  toAccountId: number;
  description: string | null;
  date?: string;
}): Promise<string> {
  if (!Number.isInteger(input.fromAccountId) || input.fromAccountId <= 0 ||
      !Number.isInteger(input.toAccountId) || input.toAccountId <= 0) {
    throw new Error("Selecione as contas de origem e destino.");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("A origem e o destino precisam ser contas diferentes.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  return createAccountTransfer({
    ...input,
    date: input.date ?? new Date().toISOString(),
  });
}

export async function removeTransaction(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("ID de transação inválido.");
  }

  await deleteTransaction(id);
}

/** Paying debt moves existing money; linked entries stay outside cashflow totals. */
export async function payCreditCard(input: {
  amount: number;
  fromAccountId: number;
  toAccountId: number;
  description: string | null;
  date?: string;
}): Promise<string> {
  validateTransaction(input.amount, "expense", input.fromAccountId);
  validateTransaction(input.amount, "income", input.toAccountId);
  return createCardPayment({ ...input, date: input.date ?? new Date().toISOString() });
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

function validateTransactionPurpose(
  type: Transaction["type"],
  goalId: number | null,
): void {
  // "transfer" ainda representa exclusivamente um aporte para meta.
  // Transferências entre contas precisam de origem e destino próprios;
  // não devem ser gravadas como um lançamento neutro que não altera saldo.
  if (type === "transfer" && (!Number.isInteger(goalId) || (goalId ?? 0) <= 0)) {
    throw new Error("Aporte para meta precisa estar vinculado a uma meta válida. Transferências entre contas ainda não estão disponíveis.");
  }

  if (type !== "transfer" && goalId !== null) {
    throw new Error("Uma meta só pode ser vinculada a uma transação do tipo aporte.");
  }
}

function validateTransaction(
  amount: number,
  type: Transaction["type"],
  accountId: number | null,
): void {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("O valor da transação deve ser um número válido maior que zero.");
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || Math.abs(amount * 100 - cents) > 0.000001) {
    throw new Error("Informe um valor em centavos, com até duas casas decimais.");
  }

  if (type !== "income" && type !== "expense" && type !== "transfer") {
    throw new Error("O tipo da transação é inválido.");
  }

  if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("A conta da transação é obrigatória.");
  }
}
