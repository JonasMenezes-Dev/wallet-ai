import { StyleSheet, Text, View } from "react-native";

import { ThemeColors, useThemedStyles } from "../theme";

type CreditCardSummaryProps = {
  /** Valor utilizado/dívida do cartão. Nunca negativo. */
  usedAmount: number;
  /** Limite total cadastrado. `null` = não informado. */
  limitAmount: number | null;
};

/**
 * Valores de um cartão de crédito: utilizado, limite e disponível.
 *
 * Regras desta primeira versão (Cartões 2.0):
 * - o `balance` do cartão o valor UTILIZADO/dívida, não dinheiro em conta;
 * - o disponível é `limite - utilizado`;
 * - o disponível nunca é exibido negativo: quando o utilizado passa do
 *   limite, mostramos "Limite excedido" em vez de um número negativo.
 *
 * Fatura, fechamento e vencimento ficam para a etapa de Cartões 3.0.
 */
export function CreditCardSummary({
  usedAmount,
  limitAmount,
}: CreditCardSummaryProps) {
  const styles = useThemedStyles(createStyles);

  // Blindagem contra null/undefined/NaN vindos de dados antigos.
  const used = Number.isFinite(usedAmount) ? Math.max(usedAmount, 0) : 0;

  const limit =
    typeof limitAmount === "number" &&
      Number.isFinite(limitAmount) &&
      limitAmount > 0
      ? limitAmount
      : null;

  const isOverLimit = limit !== null && used > limit;
  const available = limit === null ? null : Math.max(limit - used, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.usedLabel}>Utilizado</Text>

      <Text style={styles.usedValue}>{formatCurrency(used)}</Text>

      {limit === null ? (
        <Text style={styles.mutedText}>Limite não informado</Text>
      ) : (
        <>
          <Text style={styles.mutedText}>
            Limite: {formatCurrency(limit)}
          </Text>

          {isOverLimit ? (
            <Text style={styles.overLimitText}>
              Limite excedido em {formatCurrency(used - limit)}
            </Text>
          ) : (
            <Text style={styles.availableText}>
              Disponível: {formatCurrency(available ?? 0)}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

export function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    usedLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: colors.textSubtle,
    },

    usedValue: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: "800",
      color: colors.expense,
    },

    mutedText: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textMuted,
    },

    availableText: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: "700",
      color: colors.income,
    },

    overLimitText: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: "700",
      color: colors.warning,
    },
  });
