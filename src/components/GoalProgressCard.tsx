import { StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";

import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { durations, easings } from "../animations";
import { ThemeColors, useThemedStyles } from "../theme";
import type { DashboardGoal } from "../services/dashboard.service";

type GoalProgressCardProps = {
  goal: DashboardGoal;
  /** Quantidade total de metas, para o rodapé "1 de 3". */
  goalCount: number;
};

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDeadline(goal: DashboardGoal) {
  if (!goal.deadline) return "Sem prazo definido";

  const [year, month, day] = goal.deadline.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) return "Prazo inválido";

  return `Até ${parsed.toLocaleDateString("pt-BR")}`;
}

/**
 * Cartão de meta do dashboard: barra de progresso animada + valores.
 * Só mostra uma meta por vez — a mais próxima de terminar.
 */
export function GoalProgressCard({ goal, goalCount }: GoalProgressCardProps) {
  const styles = useThemedStyles(createStyles);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(
      withDelay(
        160,
        withTiming(goal.progressPercentage / 100, {
          duration: durations.slow,
          easing: easings.out,
        }),
      ),
    );
  }, [fill, goal.progressPercentage]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const isCompleted = goal.remainingAmount <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.badge}>🎯 Sua meta</Text>

          <Text style={styles.name} numberOfLines={1}>
            {goal.name}
          </Text>

          <Text style={styles.deadline}>{formatDeadline(goal)}</Text>
        </View>

        <Text style={styles.percentage}>
          {goal.progressPercentage.toFixed(0)}%
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            isCompleted && styles.fillCompleted,
            fillStyle,
          ]}
        />
      </View>

      <View style={styles.values}>
        <Text style={styles.valuesText}>
          {formatCurrency(goal.currentAmount)} de{" "}
          {formatCurrency(goal.targetAmount)}
        </Text>

        <Text style={styles.valuesText}>
          {isCompleted
            ? "Meta concluída 🎉"
            : `Faltam ${formatCurrency(goal.remainingAmount)}`}
        </Text>
      </View>

      {goalCount > 1 && (
        <Text style={styles.footer}>
          Mostrando a meta mais próxima de {goalCount} cadastradas
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: 14,
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },

    headerInfo: {
      flex: 1,
      marginRight: 12,
    },

    badge: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
    },

    name: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },

    deadline: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSubtle,
    },

    percentage: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.primary,
    },

    track: {
      height: 10,
      marginTop: 16,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
    },

    fill: {
      height: "100%",
      borderRadius: 10,
      backgroundColor: colors.primary,
    },

    fillCompleted: {
      backgroundColor: colors.income,
    },

    values: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      gap: 12,
    },

    valuesText: {
      fontSize: 12,
      color: colors.textMuted,
    },

    footer: {
      marginTop: 12,
      fontSize: 11,
      color: colors.textSubtle,
    },
  });
