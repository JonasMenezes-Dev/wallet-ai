import { useState } from "react";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import { AnimatedBlock, AnimatedListItem, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { useAccounts } from "../../src/hooks/use-accounts";
import { useGoals } from "../../src/hooks/use-goals";

import {
  calculateGoalProgress,
  contributeToGoal,
  removeGoal,
} from "../../src/services/goal.service";

import { ThemeColors, useThemedStyles } from "../../src/theme";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDate(date: string | null) {
  if (!date) {
    return "Sem prazo definido";
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Prazo inválido";
  }

  return parsedDate.toLocaleDateString("pt-BR");
}

export default function GoalsScreen() {
  const {
    goals,
    loading: goalsLoading,
    error: goalsError,
    reload: reloadGoals,
  } = useGoals();

  const { accounts, reload: reloadAccounts } = useAccounts();
  const styles = useThemedStyles(createStyles);

  const [contributingGoalId, setContributingGoalId] = useState<number | null>(
    null,
  );

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );

  const [amount, setAmount] = useState("");

  async function handleContribution(goalId: number) {
    const amountValue = Number(amount.replace(/\./g, "").replace(",", "."));

    if (!selectedAccountId) {
      Alert.alert(
        "Conta obrigatória",
        "Selecione a conta de onde o dinheiro será retirado.",
      );
      return;
    }

    if (!amountValue || amountValue <= 0) {
      Alert.alert("Valor inválido", "Digite um valor maior que zero.");
      return;
    }

    try {
      await contributeToGoal(goalId, selectedAccountId, amountValue);

      setContributingGoalId(null);
      setSelectedAccountId(null);
      setAmount("");

      await Promise.all([reloadGoals(), reloadAccounts()]);

      Alert.alert("Aporte realizado", "O valor foi adicionado à sua meta.");
    } catch (error) {
      console.error("Erro ao realizar aporte:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível realizar o aporte.";

      Alert.alert("Erro", message);
    }
  }

  function openContribution(goalId: number) {
    setContributingGoalId(goalId);

    setSelectedAccountId(accounts[0]?.id ?? null);

    setAmount("");
  }

  function closeContribution() {
    setContributingGoalId(null);
    setSelectedAccountId(null);
    setAmount("");
  }

  function handleDeleteGoal(goalId: number) {
    Alert.alert("Excluir meta", "Tem certeza que deseja excluir esta meta?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGoal(goalId);

            await reloadGoals();

            Alert.alert("Meta excluída", "A meta foi removida com sucesso.");
          } catch (error) {
            console.error("Erro ao excluir meta:", error);

            const message =
              error instanceof Error
                ? error.message
                : "Não foi possível excluir a meta.";

            Alert.alert("Não foi possível excluir", message);
          }
        },
      },
    ]);
  }

  if (goalsLoading) {
    return (
      <FadeInView style={styles.center}>
        <Text style={styles.loadingText}>Carregando metas...</Text>
      </FadeInView>
    );
  }

  if (goalsError) {
    return (
      <FadeInView style={styles.center}>
        <Text style={styles.errorText}>{goalsError}</Text>

        <AnimatedPressable
          style={styles.retryButton}
          pressedOpacity={0.85}
          onPress={reloadGoals}
        >
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </AnimatedPressable>
      </FadeInView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedBlock style={styles.header}>
        <View>
          <Text style={styles.title}>Metas</Text>

          <Text style={styles.subtitle}>
            Planeje o que você quer conquistar.
          </Text>
        </View>

        <AnimatedPressable
          style={styles.addButton}
          pressedOpacity={0.85}
          onPress={() => router.push("/goal/new")}
        >
          <Text style={styles.addButtonText}>+ Nova</Text>
        </AnimatedPressable>
      </AnimatedBlock>

      {goals.length === 0 ? (
        <FadeInView style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎯</Text>

          <Text style={styles.emptyTitle}>Nenhuma meta criada</Text>

          <Text style={styles.emptyText}>
            Crie sua primeira meta e deixe o Wallet.ai calcular o caminho até
            ela.
          </Text>

          <AnimatedPressable
            style={styles.emptyButton}
            pressedOpacity={0.85}
            onPress={() => router.push("/goal/new")}
          >
            <Text style={styles.emptyButtonText}>
              Criar minha primeira meta
            </Text>
          </AnimatedPressable>
        </FadeInView>
      ) : (
        goals.map((goal, index) => {
          const progress = calculateGoalProgress(goal);

          const isContributing = contributingGoalId === goal.id;

          const isCompleted = progress.remainingAmount <= 0;

          return (
            <AnimatedListItem
              key={goal.id}
              index={index}
              delayStep={70}
              style={styles.goalCard}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleArea}>
                  <Text style={styles.goalName}>{goal.name}</Text>

                  <Text style={styles.deadline}>
                    📅 {formatDate(goal.deadline)}
                  </Text>

                  {progress.deadlineStatus === "overdue" && (
                    <Text style={styles.overdueText}>Prazo vencido</Text>
                  )}

                  {progress.deadlineStatus === "on-track" && (
                    <Text style={styles.daysRemainingText}>
                      {progress.daysRemaining === 0
                        ? "Vence hoje"
                        : `${progress.daysRemaining} dias restantes`}
                    </Text>
                  )}
                </View>

                <Text style={styles.percentage}>
                  {progress.progressPercentage.toFixed(0)}%
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress.progressPercentage}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.valuesRow}>
                <View>
                  <Text style={styles.smallLabel}>Guardado</Text>

                  <Text style={styles.currentAmount}>
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                </View>

                <View style={styles.targetArea}>
                  <Text style={styles.smallLabel}>Objetivo</Text>

                  <Text style={styles.targetAmount}>
                    {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.remainingCard}>
                <Text style={styles.remainingLabel}>
                  {isCompleted ? "Meta concluída 🎉" : "Ainda falta"}
                </Text>

                <Text style={styles.remainingAmount}>
                  {formatCurrency(progress.remainingAmount)}
                </Text>
              </View>

              {!isCompleted && progress.deadlineStatus === "on-track" && (
                <View style={styles.plansSection}>
                  <Text style={styles.plansTitle}>
                    Média mensal para chegar à meta
                  </Text>

                  {/* AGRESSIVA */}
                  <View style={styles.planCard}>
                    <Text style={styles.planIcon}>🔥</Text>

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Agressiva</Text>

                      <Text style={styles.planDescription}>
                        Economiza mais e antecipa sua meta.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.aggressive.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue}>
                      {formatCurrency(progress.plans.aggressive.monthlyAmount)}
                      /mês
                    </Text>
                  </View>

                  {/* EQUILIBRADA */}
                  <View style={[styles.planCard, styles.balancedPlan]}>
                    <Text style={styles.planIcon}>⚖️</Text>

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Equilibrada</Text>

                      <Text style={styles.planDescription}>
                        Valor necessário para chegar no prazo.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.balanced.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue}>
                      {formatCurrency(progress.plans.balanced.monthlyAmount)}
                      /mês
                    </Text>
                  </View>

                  {/* CONFORTÁVEL */}
                  <View style={styles.planCard}>
                    <Text style={styles.planIcon}>😌</Text>

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Confortável</Text>

                      <Text style={styles.planDescription}>
                        Menos pressão no mês, mas leva mais tempo.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.comfortable.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue}>
                      {formatCurrency(progress.plans.comfortable.monthlyAmount)}
                      /mês
                    </Text>
                  </View>
                </View>
              )}

              {progress.deadlineStatus === "overdue" && !isCompleted && (
                <View style={styles.overdueBox}>
                  <Text style={styles.overdueBoxTitle}>
                    Essa meta ficou para trás
                  </Text>

                  <Text style={styles.overdueBoxText}>
                    Escolha uma nova data para recalcular os três planos.
                  </Text>
                </View>
              )}

              {isContributing ? (
                <View style={styles.contributionBox}>
                  <Text style={styles.contributionTitle}>Fazer aporte</Text>

                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />

                  <Text style={styles.accountLabel}>Retirar de:</Text>

                  <View style={styles.accountsRow}>
                    {accounts.map((account) => (
                      <AnimatedPressable
                        key={account.id}
                        pressedScale={0.94}
                        style={[
                          styles.accountOption,
                          selectedAccountId === account.id &&
                            styles.accountOptionSelected,
                        ]}
                        onPress={() => setSelectedAccountId(account.id)}
                      >
                        <Text
                          style={[
                            styles.accountOptionText,
                            selectedAccountId === account.id &&
                              styles.accountOptionTextSelected,
                          ]}
                        >
                          {account.name}
                        </Text>
                      </AnimatedPressable>
                    ))}
                  </View>

                  <View style={styles.quickValues}>
                    {[50, 100, 200, 500].map((value) => (
                      <AnimatedPressable
                        key={value}
                        pressedScale={0.94}
                        style={styles.quickValue}
                        onPress={() =>
                          setAmount(value.toFixed(2).replace(".", ","))
                        }
                      >
                        <Text>R$ {value}</Text>
                      </AnimatedPressable>
                    ))}
                  </View>

                  <View style={styles.contributionActions}>
                    <AnimatedPressable
                      style={styles.cancelButton}
                      pressedOpacity={0.85}
                      onPress={closeContribution}
                    >
                      <Text>Cancelar</Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                      style={styles.confirmButton}
                      pressedOpacity={0.85}
                      onPress={() => handleContribution(goal.id)}
                    >
                      <Text style={styles.confirmButtonText}>
                        Confirmar aporte
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ) : (
                <AnimatedPressable
                  style={styles.contributeButton}
                  pressedOpacity={0.85}
                  onPress={() => openContribution(goal.id)}
                >
                  <Text style={styles.contributeButtonText}>
                    + Fazer aporte
                  </Text>
                </AnimatedPressable>
              )}

              <View style={styles.managementRow}>
                <AnimatedPressable
                  style={styles.managementButton}
                  pressedScale={0.94}
                  pressedOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/goal/edit",
                      params: {
                        id: String(goal.id),
                      },
                    })
                  }
                >
                  <Text>✏️ Editar</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.managementButton}
                  pressedScale={0.94}
                  pressedOpacity={0.7}
                  onPress={() => handleDeleteGoal(goal.id)}
                >
                  <Text style={styles.deleteText}>🗑️ Excluir</Text>
                </AnimatedPressable>
              </View>
            </AnimatedListItem>
          );
        })
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
  },

  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },

  addButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },

  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },

  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  goalTitleArea: {
    flex: 1,
    marginRight: 12,
  },

  goalName: {
    fontSize: 21,
    fontWeight: "800",
  },

  deadline: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 13,
  },

  daysRemainingText: {
    marginTop: 4,
    color: colors.income,
    fontSize: 12,
    fontWeight: "700",
  },

  overdueText: {
    marginTop: 4,
    color: colors.expense,
    fontSize: 12,
    fontWeight: "700",
  },

  percentage: {
    fontSize: 20,
    fontWeight: "800",
  },

  progressTrack: {
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 18,
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 10,
  },

  valuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },

  targetArea: {
    alignItems: "flex-end",
  },

  smallLabel: {
    fontSize: 12,
    color: colors.textSubtle,
  },

  currentAmount: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
  },

  targetAmount: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
  },

  remainingCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  remainingLabel: {
    color: colors.textMuted,
    fontWeight: "600",
  },

  remainingAmount: {
    fontSize: 17,
    fontWeight: "800",
  },

  plansSection: {
    marginTop: 20,
  },

  plansTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  overdueBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warning,
  },

  overdueBoxTitle: {
    color: colors.warning,
    fontWeight: "800",
  },

  overdueBoxText: {
    marginTop: 4,
    color: colors.warning,
    fontSize: 12,
  },

  planCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 8,
  },

  balancedPlan: {
    borderWidth: 1,
    borderColor: colors.border,
  },

  planIcon: {
    fontSize: 21,
    marginRight: 10,
  },

  planInfo: {
    flex: 1,
    marginRight: 8,
  },

  planName: {
    fontWeight: "800",
  },

  planDescription: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },

  planDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 5,
    fontWeight: "600",
  },

  planValue: {
    fontWeight: "800",
    fontSize: 15,
  },

  contributeButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },

  contributeButtonText: {
    color: colors.onPrimary,
    fontWeight: "800",
  },

  contributionBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
  },

  contributionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  amountInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: colors.text,
  },

  accountLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "700",
  },

  accountsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  accountOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  accountOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  accountOptionText: {
    fontWeight: "600",
    color: colors.text,
  },

  accountOptionTextSelected: {
    color: colors.onPrimary,
  },

  quickValues: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  quickValue: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },

  contributionActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  cancelButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  confirmButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
  },

  confirmButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },

  managementRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },

  managementButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  deleteText: {
    color: colors.expense,
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },

  emptyIcon: {
    fontSize: 42,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyText: {
    textAlign: "center",
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 8,
  },

  emptyButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  emptyButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },

  loadingText: {
    color: colors.textMuted,
  },

  errorText: {
    color: colors.expense,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },
  });
