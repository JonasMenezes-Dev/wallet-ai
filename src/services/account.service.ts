import {
    createAccount,
    getAllAccounts,
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
