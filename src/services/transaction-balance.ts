import type { Account } from "../types/account";
import type { TransactionType } from "../types/transaction";

/**
 * Regras de quanto uma transação mexe no valor guardado em uma conta.
 *
 * - Conta comum: balance é o dinheiro disponível; despesa reduz e entrada
 *   aumenta. Não pode ficar negativo.
 * - Cartão: balance é o valor utilizado/dívida em aberto, armazenado como
 *   número positivo; despesa aumenta e entrada (pagamento/estorno) reduz.
 *   O cartão pode ultrapassar o limite; a UI sinaliza isso.
 *
 * Toda a aritmética fica aqui para que criar, editar e excluir não divirjam.
 */

/** amount positivo lança a transação; negativo desfaz (edição/exclusão). */
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

/** Rejeita saldos negativos e resultados não finitos em qualquer conta. */
export function isBalanceInvalid(
  balance: number,
  _accountType: Account["type"],
): boolean {
  return !Number.isFinite(balance) || balance < 0;
}
