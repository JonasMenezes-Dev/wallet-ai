import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { AnimatedListItem, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { useTransactions } from "../../src/hooks/use-transactions";
import { removeTransaction } from "../../src/services/transaction.service";
import { ThemeColors, useThemedStyles } from "../../src/theme";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function getTransactionLabel(type: string) {
  switch (type) {
    case "income":
      return "Entrada";

    case "transfer":
      return "Aporte para meta";

    default:
      return "Gasto";
  }
}

function getTransactionAmountPrefix(type: string) {
  if (type === "income") {
    return "+";
  }

  if (type === "transfer") {
    return "↗";
  }

  return "-";
}

export default function TransactionsScreen() {
  const { transactions, loading, error, reload } = useTransactions();
  const styles = useThemedStyles(createStyles);
  const [filter, setFilter] = useState<
    "all" | "income" | "expense" | "transfer"
  >("all");

  const visibleTransactions =
    filter === "all"
      ? transactions
      : transactions.filter((item) => item.type === filter);

  async function handleDelete(id: number) {
    Alert.alert(
      "Excluir transação",
      "Tem certeza que deseja excluir esta transação?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await removeTransaction(id);
              await reload();
            } catch (error) {
              console.error("Erro ao excluir transação:", error);

              Alert.alert("Erro", "Não foi possível excluir a transação.");
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text>Carregando transações...</Text>
      </FadeInView>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transações</Text>

      <Text style={styles.subtitle}>
        {visibleTransactions.length === 0
          ? "Nenhuma transação registrada."
          : `${visibleTransactions.length} ${
              visibleTransactions.length === 1 ? "transação" : "transações"
            } registrada${visibleTransactions.length === 1 ? "" : "s"}.`}
      </Text>

      <View style={styles.filters}>
        {[
          ["all", "Todas"],
          ["income", "Entradas"],
          ["expense", "Gastos"],
          ["transfer", "Aportes"],
        ].map(([value, label]) => (
          <AnimatedPressable
            key={value}
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filter === value && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(value as typeof filter)}
          >
            <Text
              style={
                filter === value ? styles.filterTextActive : styles.filterText
              }
            >
              {label}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      <FlatList
        data={visibleTransactions}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={
          visibleTransactions.length === 0 ? styles.emptyList : styles.list
        }
        renderItem={({ item, index }) => {
          const isIncome = item.type === "income";

          const isGoalContribution =
            item.type === "transfer" && item.goalId !== null;

          const label = getTransactionLabel(item.type);

          const prefix = getTransactionAmountPrefix(item.type);

          return (
            <AnimatedListItem index={index} style={styles.transactionCard}>
              <View style={styles.transactionInfo}>
                <View style={styles.labelRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      isIncome
                        ? styles.incomeBadge
                        : isGoalContribution
                          ? styles.goalBadge
                          : styles.expenseBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        isIncome
                          ? styles.incomeBadgeText
                          : isGoalContribution
                            ? styles.goalBadgeText
                            : styles.expenseBadgeText,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.transactionDescription}>
                  {item.description || "Sem descrição"}
                </Text>

                <Text style={styles.transactionMeta}>
                  {item.source === "manual"
                    ? "Lançamento manual"
                    : "Automático"}
                </Text>
              </View>

              <View style={styles.transactionRight}>
                <Text
                  style={[
                    styles.transactionAmount,
                    isIncome
                      ? styles.income
                      : isGoalContribution
                        ? styles.goal
                        : styles.expense,
                  ]}
                >
                  {prefix} {formatCurrency(item.amount)}
                </Text>

                {!isGoalContribution && (
                  <AnimatedPressable
                    style={styles.editButton}
                    pressedScale={0.93}
                    onPress={() =>
                      router.push({
                        pathname: "/transaction/edit",
                        params: { id: String(item.id) },
                      })
                    }
                  >
                    <Text style={styles.editButtonText}>Editar</Text>
                  </AnimatedPressable>
                )}

                <AnimatedPressable
                  style={styles.deleteButton}
                  pressedScale={0.93}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </AnimatedPressable>
              </View>
            </AnimatedListItem>
          );
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },

  filters: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },

  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
  },

  filterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  filterTextActive: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  list: {
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },

  labelRow: {
    flexDirection: "row",
    marginBottom: 7,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  incomeBadge: {
    backgroundColor: colors.incomeSurface,
  },

  expenseBadge: {
    backgroundColor: colors.expenseSurface,
  },

  goalBadge: {
    backgroundColor: colors.accentSurface,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  incomeBadgeText: {
    color: colors.income,
  },

  expenseBadgeText: {
    color: colors.expense,
  },

  goalBadgeText: {
    color: colors.primary,
  },

  transactionDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },

  transactionMeta: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  transactionRight: {
    alignItems: "flex-end",
  },

  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

  income: {
    color: colors.income,
  },

  expense: {
    color: colors.expense,
  },

  goal: {
    color: colors.primary,
  },

  deleteButton: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.expenseSurface,
  },

  editButton: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.expense,
  },
  });
