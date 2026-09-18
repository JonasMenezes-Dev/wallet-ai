import type { Account } from "../types/account";
import type { TransactionType } from "../types/transaction";

/**
 * Regras de quanto uma transação mexe no valor guardado em uma conta.
 *
 * Existem dois mundos diferentes guardados na mesma tabela `accounts`:
 *
 * - conta comum (`bank`, `benefit`, `cash`, `other`): `balance` é o
 *   DINHEIRO disponível. Uma despesa tira, uma entrada soma, e não é
 *   aceitável ficar negativo.
 *
 * - cartão (`credit_card`): `balance` é a DÍVIDA (valor utilizado). Uma
 *   despesa AUMENTA a dívida, um estorno/entrada reduz. Não há "saldo
 *   insuficiente": gastar mais que o limite é possível na vida real, e a
 *   UI é quem mostra "limite excedido".
 *
 * Toda a aritmética fica aqui para que criar, editar e excluir não possam
 * divergir entre si.
 */

/**
 * Aplica o efeito de uma transação ao valor guardado na conta.
 *
 * `amount` positivo lança a transação; negativo desfaz (usado ao editar
 * ou excluir). O retorno é o novo valor de `balance` já com o tipo de
 * conta respeitado.
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
    // Dívida: despesa soma, entrada (pagamento/estorno) subtrai.
    return type === "expense" ? balance + amount : balance - amount;
  }

  return type === "expense" ? balance - amount : balance + amount;
}

/**
 * `true` quando o valor ficou abaixo do permitido para o tipo de conta.
 *
 * Só vale para conta comum: cartão pode ficar "devendo" acima do limite
 * porque isso é gasto real, não erro de digitação.
 */
export function isBalanceInvalid(
  balance: number,
  accountType: Account["type"],
): boolean {
  return accountType !== "credit_card" && balance < 0;
}
