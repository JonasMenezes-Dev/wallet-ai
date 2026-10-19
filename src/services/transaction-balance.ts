import type { Account } from "../types/account";
import type { TransactionType } from "../types/transaction";

/**
 * Regras de quanto uma transação mexe no valor guardado em uma conta.
 *
 * - Conta comum: `balance` é o dinheiro disponível. Uma despesa reduz
 *   o saldo e uma entrada aumenta; não pode ficar negativo.
 * - Cartão: `balance` é o valor utilizado/dívida em aberto, sempre positivo.
 *   Uma despesa aumenta a utilização e uma entrada (pagamento/estorno)
 *   reduz. O cartão pode ultrapassar o limite; a UI sinaliza isso.
 *
 * Toda a aritmética fica aqui para que criar, editar e excluir não divirjam.
 */

/**
 * `amount` positivo lança a transação; negativo desfaz (edição/exclusão).
 */
export function applyTransactionToAccount(
  balance: number,
  accountType: Account["type"],
  type: TransactionType,
  amount: number,
): number {
  if (type === "transfer") {
    return balance;
  }

  if (accountType === "credit_card") {
    return type === "expense" ? balance + amount : balance - amount;
  }

  return type === "expense" ? balance - amount : balance + amount;
}

/** Só contas comuns são impedidas de ficar negativas. */
export function isBalanceInvalid(
  balance: number,
  accountType: Account["type"],
): boolean {
  return !Number.isFinite(balance) ||
    (accountType === "credit_card" ? balance < 0 : balance < 0);
}
