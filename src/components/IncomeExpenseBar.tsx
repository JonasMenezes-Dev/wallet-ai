import { StyleSheet, Text, View } from "react-native";

import { useEffect } from "react";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { durations, easings } from "../animations";

type IncomeExpenseBarProps = {
  income: number;
  expenses: number;
};

/**
 * Comparação visual simples entre entradas e gastos do mês.
 * Não é um gráfico: é uma barra proporcional de leitura imediata.
 */
export function IncomeExpenseBar({ income, expenses }: IncomeExpenseBarProps) {
  const total = income + expenses;

  const incomeRatio = total > 0 ? income / total : 0.5;
  const expenseRatio = total > 0 ? expenses / total : 0.5;

  const incomeWidth = useSharedValue(0);
  const expenseWidth = useSharedValue(0);

  useEffect(() => {
    incomeWidth.set(
      withDelay(
        180,
        withTiming(1, { duration: durations.slow, easing: easings.out }),
      ),
    );

    expenseWidth.set(
      withDelay(
        240,
        withTiming(1, { duration: durations.slow, easing: easings.out }),
      ),
    );
  }, [incomeWidth, expenseWidth]);

  const incomeStyle = useAnimatedStyle(() => ({
    flexGrow: incomeRatio,
    transform: [{ scaleX: incomeWidth.value }],
  }));

  const expenseStyle = useAnimatedStyle(() => ({
    flexGrow: expenseRatio,
    transform: [{ scaleX: expenseWidth.value }],
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.incomeFill, incomeStyle]} />

      <Animated.View style={[styles.expenseFill, expenseStyle]} />
    </View>
  );
}

/** Legenda da barra, com os valores absolutos do mês. */
export function IncomeExpenseLegend({
  income,
  expenses,
}: IncomeExpenseBarProps) {
  const difference = income - expenses;

  if (income === 0 && expenses === 0) {
    return (
      <Text style={styles.legend}>
        Nenhuma movimentação registrada neste mês ainda.
      </Text>
    );
  }

  return (
    <Text style={styles.legend}>
      {difference >= 0
        ? `Você guardou ${formatCurrency(difference)} este mês`
        : `Você gastou ${formatCurrency(
            Math.abs(difference),
          )} a mais do que entrou`}
    </Text>
  );
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },

  incomeFill: {
    backgroundColor: "#15803D",
    borderRadius: 999,
    // Faz a barra crescer a partir da esquerda, e não do centro.
    transformOrigin: "left",
  },

  expenseFill: {
    backgroundColor: "#DC2626",
    borderRadius: 999,
    transformOrigin: "right",
  },

  legend: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B7280",
  },
});
