import {
    createAccount,
    deleteAccount,
    getAllAccounts,
    updateAccount,
} from "../repositories/account.repository";

import { Account } from "../types/account";

export async function listAccounts(): Promise<Account[]> {
  return getAllAccounts();
}

export async function addAccount(
  account: Omit<Account, "id" | "createdAt" | "updatedAt">,
): Promise<number> {
  if (!account.name.trim()) {
    throw new Error("O nome da conta é obrigatório.");
  }

  if (!account.type) {
    throw new Error("O tipo da conta é obrigatório.");
  }

  return createAccount(account);
}

export async function removeAccount(accountId: number): Promise<void> {
  if (accountId <= 0) {
    throw new Error("ID de conta inválido.");
  }

  await deleteAccount(accountId);
}

export async function editAccount(
  accountId: number,
  account: Omit<Account, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  if (accountId <= 0) {
    throw new Error("ID de conta inválido.");
  }

  if (!account.name.trim()) {
    throw new Error("O nome da conta é obrigatório.");
  }

  if (!account.type) {
    throw new Error("O tipo da conta é obrigatório.");
  }

  if (Number.isNaN(account.balance) || account.balance < 0) {
    throw new Error("O saldo da conta não pode ser negativo.");
  }

  await updateAccount(accountId, {
    name: account.name.trim(),
    type: account.type,
    balance: account.balance,
  });
}
