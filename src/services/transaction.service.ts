import {
  createTransaction,
  deleteTransaction,
  getAllTransactions,
} from '../repositories/transaction.repository';

import { Transaction } from '../types/transaction';

export async function listTransactions(): Promise<Transaction[]> {
  return getAllTransactions();
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  if (transaction.amount <= 0) {
    throw new Error('O valor da transação deve ser maior que zero.');
  }

  if (!transaction.type) {
    throw new Error('O tipo da transação é obrigatório.');
  }

  return createTransaction(transaction);
}

export async function removeTransaction(id: number): Promise<void> {
  if (id <= 0) {
    throw new Error('ID de transação inválido.');
  }

  await deleteTransaction(id);
}