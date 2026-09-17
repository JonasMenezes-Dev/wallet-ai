import {
  createAccount,
  deleteAccount,
  getAllAccounts,
  updateAccount,
} from "../repositories/account.repository";

import { Account, AccountType } from "../types/account";

const ACCOUNT_TYPES: AccountType[] = [
  "bank",
  "credit_card",
  "benefit",
  "cash",
  "other",
];

/** Dados aceitos na criação/edição de conta, já validados e normalizados. */
export interface AccountPayload {
  name: string;
  type: AccountType;
  balance: number;
  /** `null` em qualquer conta que não seja cartão. */
  limitAmount: number | null;
}

export async function listAccounts(): Promise<Account[]> {
  return getAllAccounts();
}

export async function addAccount(account: AccountPayload): Promise<number> {
  return createAccount(normalizeAccount(account));
}

export async function removeAccount(accountId: number): Promise<void> {
  if (accountId <= 0) {
    throw new Error("ID de conta inválido.");
  }

  await deleteAccount(accountId);
}

export async function editAccount(
  accountId: number,
  account: AccountPayload,
): Promise<void> {
  if (accountId <= 0) {
    throw new Error("ID de conta inválido.");
  }

  await updateAccount(accountId, normalizeAccount(account));
}

/**
 * Validação e normalização centralizadas das contas.
 *
 * É a única autoridade sobre as regras: a tela pode conferir os campos para
 * dar feedback rápido, mas o que decide o que vai para o banco é isto aqui.
 * Nada é validado só na UI, e nenhuma regra duplicada.
 */
function normalizeAccount(account: AccountPayload): AccountPayload {
  const name = account.name?.trim() ?? "";

  if (!name) {
    throw new Error("O nome da conta é obrigatório.");
  }

  if (!account.type || !ACCOUNT_TYPES.includes(account.type)) {
    throw new Error("O tipo da conta é obrigatório.");
  }

  if (!Number.isFinite(account.balance)) {
    throw new Error("O saldo da conta é inválido.");
  }

  if (account.balance < 0) {
    throw new Error("O saldo da conta não pode ser negativo.");
  }

  return {
    name,
    type: account.type,
    balance: account.balance,
    limitAmount: normalizeLimitAmount(account.type, account.limitAmount),
  };
}

/**
 * Limite de crédito só existe em cartão.
 *
 * `null` significa "não informado" e é um valor legítimo — não é trocado
 * por 0, porque 0 seria um limite válido de verdade (cartão sem limite).
 * Qualquer outro tipo de conta é forçado para `null`, inclusive quando o
 * usuário troca um cartão para banco na edição.
 */
function normalizeLimitAmount(
  type: AccountType,
  limitAmount: number | null | undefined,
): number | null {
  if (type !== "credit_card") {
    return null;
  }

  if (limitAmount === null || limitAmount === undefined) {
    return null;
  }

  if (typeof limitAmount !== "number" || !Number.isFinite(limitAmount)) {
    throw new Error("O limite do cartão é inválido.");
  }

  if (limitAmount <= 0) {
    throw new Error("O limite do cartão deve ser maior que zero.");
  }

  return limitAmount;
}
