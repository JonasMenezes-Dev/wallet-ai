import { Image } from "expo-image";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { AppCard } from "../../src/components/AppCard";
import { AppField } from "../../src/components/AppField";
import { AppText as Text } from "../../src/components/AppText";
import { useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
  withdrawFromGoal,
  removeGoal,
} from "../../src/services/goal.service";

import { typography, ThemeColors, useThemeColors, useThemedStyles } from "../../src/theme";

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
  const tabBarHeight = useBottomTabBarHeight();

  const [contributingGoalId, setContributingGoalId] = useState<number | null>(
    null,
  );

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );

  const [withdrawing, setWithdrawing] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const movementPending = useRef(false);

  const [amount, setAmount] = useState("");

  async function handleContribution(goalId: number) {
    if (movementPending.current) return;
    const amountValue = Number(amount.replace(/\./g, "").replace(",", "."));

    if (!selectedAccountId) {
      Alert.alert(
        "Conta obrigatória",
        "Selecione a conta da movimentação.",
      );
      return;
    }

    if (!amountValue || amountValue <= 0) {
      Alert.alert("Valor inválido", "Digite um valor maior que zero.");
      return;
    }

    try {
      movementPending.current = true;
      setSavingMovement(true);
      await (withdrawing ? withdrawFromGoal : contributeToGoal)(goalId, selectedAccountId, amountValue);

      setContributingGoalId(null);
      setSelectedAccountId(null);
      setAmount("");

      await Promise.all([reloadGoals(), reloadAccounts()]);

      Alert.alert(withdrawing ? "Resgate realizado" : "Aporte realizado", "Saldos da conta e da meta atualizados.");
    } catch (error) {
      console.error("Erro ao realizar aporte:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível realizar o aporte.";

      Alert.alert("Erro", message);
    } finally {
      movementPending.current = false;
      setSavingMovement(false);
    }
  }

  function openContribution(goalId: number, withdrawal = false) {
    setWithdrawing(withdrawal);
    setContributingGoalId(goalId);

    setSelectedAccountId(accounts.find(account => account.type !== "credit_card")?.id ?? null);

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
    <PremiumScreen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingBottom: tabBarHeight + 24 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <AnimatedBlock style={styles.header}>
        <ScreenHeader
          title="Minhas metas"
          subtitle="Conquistas que começam hoje"
          eyebrow="Seu futuro"
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
        <FadeInView>
        <AppCard style={styles.emptyCard}>
          <Image source={require("../../assets/premium/goals-target.svg")} tintColor={colors.primary} style={{ width: 23, height: 23 }} accessible={false} />

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
        </AppCard>
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
              style={{ marginBottom: 16 }}
            >
              <AppCard style={styles.goalCard} ambient={index === 0 ? "highlight" : "none"}>
              <Text variant="label" tone="muted" style={{ marginBottom: 14 }}>{index === 0 ? "Objetivo em destaque" : "Seus objetivos"}</Text>
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


                  >
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                </View>

                <View style={styles.targetArea}>
                  <Text style={styles.smallLabel}>Objetivo</Text>

                  <Text
                    style={styles.targetAmount}


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


                >
                  {formatCurrency(progress.remainingAmount)}
                </Text>
              </View>

              {!isCompleted && progress.deadlineStatus === "on-track" && (
                <View style={styles.plansSection}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image source={require("../../assets/premium/goals-calendar.svg")} tintColor={colors.primary} style={{ width: 22, height: 22 }} accessible={false} />
                  <Text style={styles.plansTitle}>
                    Média mensal para chegar à meta
                  </Text>
                  </View>

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

                    <Text style={styles.planValue}>
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

                    <Text style={styles.planValue}>
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
                  <Text style={styles.contributionTitle}>{withdrawing ? "Resgatar da meta" : "Fazer aporte"}</Text>

                  <AppField label={withdrawing ? "Valor do resgate" : "Valor do aporte"}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                  />

                  <Text style={styles.accountLabel}>{withdrawing ? "Depositar em:" : "Retirar de:"}</Text>

                  <View style={styles.accountsRow}>
                    {accounts.filter(account => account.type !== "credit_card").map((account) => (
                      <AnimatedPressable
                        key={account.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedAccountId === account.id }}
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
                      disabled={savingMovement}
                      onPress={() => handleContribution(goal.id)}
                    >
                      <Text style={styles.confirmButtonText}>
                        {savingMovement ? "Salvando..." : withdrawing ? "Confirmar resgate" : "Confirmar aporte"}
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

              {goal.currentAmount > 0 && !isContributing && (
                <AnimatedPressable style={styles.managementButton} accessibilityRole="button"
                  onPress={() => openContribution(goal.id, true)}>
                  <Text style={styles.managementButtonText}>Resgatar da meta</Text>
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
              </AppCard>
            </AnimatedListItem>
          );
        })
      )}
    </ScrollView>
    </KeyboardAvoidingView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },

  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 24,
    paddingBottom: 40,
    backgroundColor: "transparent",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "transparent",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  title: {
    fontSize: 29,
    fontWeight: "800",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  goalCard: {
    width: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: 21,
    padding: 20,
    marginBottom: 0,
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
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  overdueText: {
    marginTop: 4,
    color: colors.expense,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: typography.family.bold,
  },

  percentage: {
    lineHeight: 28,
    flexShrink: 0,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  targetAmount: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  remainingAmount: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  plansSection: {
    marginTop: 20,
  },

  plansTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  planValue: {
    flexShrink: 1,
    maxWidth: "44%",
    textAlign: "right",
    fontWeight: "800",
    fontFamily: typography.family.bold,
    fontSize: 14,
    color: colors.text,
  },

  contributeButton: {
    minHeight: 52,
    justifyContent: "center",
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },

  contributeButtonText: {
    color: colors.onPrimary,
    fontWeight: "800",
    fontFamily: typography.family.bold,
  },

  contributionBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
  },

  contributionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: typography.family.bold,
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
    color: colors.text,
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "700",
    fontFamily: typography.family.bold,
  },

  accountsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  accountOption: {
    minHeight: 44,
    justifyContent: "center",
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
    fontFamily: typography.family.bold,
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
    minHeight: 44,
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
    minHeight: 52,
    justifyContent: "center",
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  confirmButton: {
    minHeight: 52,
    justifyContent: "center",
    flex: 1,
    padding: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
  },

  confirmButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    textAlign: "center",
  },

  quickValueText: {
    color: colors.text,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    textAlign: "center",
  },

  cancelButtonText: {
    color: colors.text,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    textAlign: "center",
  },

  managementButtonText: {
    color: colors.text,
    fontWeight: "600",
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 21,
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
    fontFamily: typography.family.bold,
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
    fontFamily: typography.family.bold,
  },

  loadingText: {
    color: colors.textMuted,
  },

  errorText: {
    color: colors.expense,
    textAlign: "center",
  },

  retryButton: { minHeight: 44, justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },

  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
    fontFamily: typography.family.bold,
  },
  });
