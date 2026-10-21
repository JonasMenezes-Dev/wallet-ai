import { StyleSheet, Text, View } from "react-native";

import { AnimatedProgressFill } from "./AnimatedProgressFill";
import { AppCard } from "./AppCard";
import { WalletSymbol } from "./WalletSymbol";
import { spacing, typography, ThemeColors, useThemeColors, useThemedStyles } from "../theme";
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
  const colors = useThemeColors();
  const isCompleted = goal.remainingAmount <= 0;

  return (
    <AppCard ambient="highlight" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.badgeRow}>
            <WalletSymbol name="goals" color={colors.primary} size={18} />
            <Text style={styles.badge}>Sua meta</Text>
          </View>

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
        <AnimatedProgressFill
          progress={goal.progressPercentage / 100}
          delay={160}
          style={[styles.fill, isCompleted && styles.fillCompleted]}
        />
      </View>

      <View style={styles.values}>
        <Text style={styles.valuesText}>
          {formatCurrency(goal.currentAmount)} de{" "}
          {formatCurrency(goal.targetAmount)}
        </Text>

        <Text style={styles.valuesText}>
          {isCompleted
            ? "Meta concluída"
            : `Faltam ${formatCurrency(goal.remainingAmount)}`}
        </Text>
      </View>

      {goalCount > 1 && (
        <Text style={styles.footer}>
          Mostrando a meta mais próxima de {goalCount} cadastradas
        </Text>
      )}
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: spacing.lg,
    },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },

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
      fontFamily: typography.family.bold,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
    },

    name: {
      fontFamily: typography.family.bold,
      marginTop: 6,
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },

    deadline: {
      fontFamily: typography.family.regular,
      marginTop: 3,
      fontSize: 12,
      color: colors.textSubtle,
    },

    percentage: {
      fontFamily: typography.family.bold,
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
      fontFamily: typography.family.regular,
      fontSize: 12,
      color: colors.textMuted,
    },

    footer: {
      fontFamily: typography.family.regular,
      marginTop: 12,
      fontSize: 11,
      color: colors.textSubtle,
    },
  });
