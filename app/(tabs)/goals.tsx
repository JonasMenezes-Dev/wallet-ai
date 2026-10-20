import { useState } from "react";

import {
  ActivityIndicator,
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
import { AnimatedProgressFill } from "../../src/components/AnimatedProgressFill";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useAccounts } from "../../src/hooks/use-accounts";
import { useGoals } from "../../src/hooks/use-goals";

import {
  calculateGoalProgress,
  contributeToGoal,
  removeGoal,
} from "../../src/services/goal.service";

import { ThemeColors, useThemeColors, useThemedStyles } from "../../src/theme";

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
  const colors = useThemeColors();

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
        <ActivityIndicator color={colors.primary} size="large" accessibilityLabel="Carregando metas" />
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
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedBlock style={styles.header}>
        <ScreenHeader
          title="Metas"
          subtitle="Planeje o que você quer conquistar."
          eyebrow="Seus objetivos"
          accessory={
            <AnimatedPressable
              style={styles.addButton}
              pressedOpacity={0.85}
              onPress={() => router.push("/goal/new")}
            >
              <Text style={styles.addButtonText}>+ Nova</Text>
            </AnimatedPressable>
          }
        />
      </AnimatedBlock>

      {goals.length === 0 ? (
        <FadeInView style={styles.emptyCard}>

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
              delayStep={30}
              style={styles.goalCard}
            >
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleArea}>
                  <Text style={styles.goalName}>{goal.name}</Text>

                  <Text style={styles.deadline}>
                    {formatDate(goal.deadline)}
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
                <AnimatedProgressFill
                  progress={progress.progressPercentage / 100}
                  delay={80 + Math.min(index * 30, 150)}
                  style={styles.progressFill}
                />
              </View>

              <View style={styles.valuesRow}>
                <View style={styles.valueColumn}>
                  <Text style={styles.smallLabel}>Guardado</Text>

                  <Text
                    style={styles.currentAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                </View>

                <View style={styles.targetArea}>
                  <Text style={styles.smallLabel}>Objetivo</Text>

                  <Text
                    style={styles.targetAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.remainingCard}>
                <Text style={styles.remainingLabel}>
                  {isCompleted ? "Meta concluída" : "Ainda falta"}
                </Text>

                <Text
                  style={styles.remainingAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
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

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Agressiva</Text>

                      <Text style={styles.planDescription}>
                        Economiza mais e antecipa sua meta.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.aggressive.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue} numberOfLines={2}>
                      {formatCurrency(progress.plans.aggressive.monthlyAmount)}
                      /mês
                    </Text>
                  </View>

                  {/* EQUILIBRADA */}
                  <View style={[styles.planCard, styles.balancedPlan]}>

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Equilibrada</Text>

                      <Text style={styles.planDescription}>
                        Valor necessário para chegar no prazo.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.balanced.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue} numberOfLines={2}>
                      {formatCurrency(progress.plans.balanced.monthlyAmount)}
                      /mês
                    </Text>
                  </View>

                  {/* CONFORTÁVEL */}
                  <View style={styles.planCard}>

                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Confortável</Text>

                      <Text style={styles.planDescription}>
                        Menos pressão no mês, mas leva mais tempo.
                      </Text>

                      <Text style={styles.planDate}>
                        Objetivo em {progress.plans.comfortable.estimatedDate}
                      </Text>
                    </View>

                    <Text style={styles.planValue} numberOfLines={2}>
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
                        <Text style={styles.quickValueText}>R$ {value}</Text>
                      </AnimatedPressable>
                    ))}
                  </View>

                  <View style={styles.contributionActions}>
                    <AnimatedPressable
                      style={styles.cancelButton}
                      pressedOpacity={0.85}
                      onPress={closeContribution}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
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
                  <Text style={styles.managementButtonText}>Editar</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={styles.managementButton}
                  pressedScale={0.94}
                  pressedOpacity={0.7}
                  onPress={() => handleDeleteGoal(goal.id)}
                >
                  <Text style={styles.deleteText}>Excluir</Text>
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flexGrow: 1,
    padding: 18,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
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
    color: colors.text,
  },

  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
  },

  addButton: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },

  addButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },

  goalCard: {
    width: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
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
    minWidth: 0,
    marginRight: 8,
  },

  goalName: {
    flexShrink: 1,
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
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
    flexShrink: 0,
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
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
    gap: 12,
    marginTop: 14,
  },

  valueColumn: {
    flex: 1,
    minWidth: 0,
  },

  targetArea: {
    flex: 1,
    minWidth: 0,
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
    color: colors.text,
  },

  targetAmount: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
  },

  remainingCard: {
    minWidth: 0,
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  remainingLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    fontWeight: "600",
  },

  remainingAmount: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },

  plansSection: {
    marginTop: 20,
  },

  plansTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
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
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    minWidth: 0,
    marginRight: 4,
  },

  planName: {
    fontWeight: "800",
    color: colors.text,
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
    flexShrink: 1,
    maxWidth: "44%",
    textAlign: "right",
    fontWeight: "800",
    fontSize: 14,
    color: colors.text,
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
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  quickValue: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 40,
    justifyContent: "center",
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
    textAlign: "center",
  },

  quickValueText: {
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
  },

  cancelButtonText: {
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
  },

  managementButtonText: {
    color: colors.text,
    fontWeight: "600",
  },

  managementRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },

  managementButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
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
    color: colors.text,
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
