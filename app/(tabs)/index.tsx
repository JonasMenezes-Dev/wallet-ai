import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { router } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { GoalProgressCard } from "../../src/components/GoalProgressCard";
import { useDashboard } from "../../src/hooks/use-dashboard";
import { useUserSettings } from "../../src/hooks/use-user-settings";
import { ThemeColors, useThemedStyles } from "../../src/theme";
import {
  getFinancialInsights,
  FinancialInsight,
} from "../../src/services/financial-insights.service";
import type { DashboardInsight } from "../../src/services/dashboard.service";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatTransactionDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "";

  const today = new Date();

  if (parsed.toDateString() === today.toDateString()) return "Hoje";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (parsed.toDateString() === yesterday.toDateString()) return "Ontem";

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";

  return "Boa noite";
}

function getAccountTypeLabel(type: string) {
  switch (type) {
    case "bank":
      return "Conta bancária";

    case "credit_card":
      return "Cartão de crédito";

    case "benefit":
      return "Benefício";

    case "cash":
      return "Dinheiro";

    default:
      return "Outra conta";
  }
}

export default function HomeScreen() {
  const { summary, loading, error, reload } = useDashboard();
  const { settings } = useUserSettings();
  const styles = useThemedStyles(createStyles);

  const [extraInsights, setExtraInsights] = useState<FinancialInsight[]>([]);

  useEffect(() => {
    getFinancialInsights()
      .then(setExtraInsights)
      .catch(() => setExtraInsights([]));
  }, [summary.transactionCount, summary.monthExpenses, settings?.salary]);

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text style={styles.loadingText}>Carregando seu resumo...</Text>
      </FadeInView>
    );
  }

  if (error) {
    return (
      <FadeInView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>

        <AnimatedPressable
          style={styles.retryButton}
          pressedOpacity={0.85}
          onPress={reload}
        >
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </AnimatedPressable>
      </FadeInView>
    );
  }

  const nonCardAccounts = summary.accounts.filter(
    (account) => account.type !== "credit_card",
  );

  const remainingThisMonth = summary.monthBalance;

  const categoryMax = summary.expensesByCategory[0]?.total ?? 0;

  /*
   * Duas fontes de leitura, uma lista só:
   * - `summary.insights` já vem calculada do dashboard.service;
   * - as demais dependem da renda cadastrada.
   */
  const allInsights: DashboardInsight[] = [
    ...summary.insights,
    ...extraInsights.map((insight, index) => ({
      id: `renda-${index}`,
      icon: insight.tone === "positive" ? "💡" : "🔔",
      title: insight.title,
      description: insight.description,
      tone: insight.tone,
    })),
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AnimatedBlock style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>

          <Text style={styles.month}>{summary.currentMonthName}</Text>

          <Text style={styles.subtitle}>
            {summary.monthTransactionCount === 0
              ? "Nenhuma movimentação neste mês ainda"
              : `${summary.monthTransactionCount} ${
                  summary.monthTransactionCount === 1
                    ? "movimentação"
                    : "movimentações"
                } neste mês`}
          </Text>
        </AnimatedBlock>

        <AnimatedBlock delay={60} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo total</Text>

          <Text style={styles.balance}>{formatCurrency(summary.balance)}</Text>

          <Text style={styles.balanceMeta}>
            {summary.accounts.length}{" "}
            {summary.accounts.length === 1 ? "conta" : "contas"}
            {summary.creditCardUsedTotal > 0
              ? ` · ${formatCurrency(summary.creditCardUsedTotal)} em cartão`
              : ""}
          </Text>
        </AnimatedBlock>

        <AnimatedBlock delay={100}>
          <Text style={styles.sectionLabel}>Este mês</Text>

          <View style={styles.cards}>
            <View style={styles.card}>
              <Text style={styles.label}>Entradas</Text>

              <Text style={styles.incomeValue}>
                {formatCurrency(summary.monthIncome)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Gastos</Text>

              <Text style={styles.expenseValue}>
                {formatCurrency(summary.monthExpenses)}
              </Text>
            </View>
          </View>

          <View style={styles.availableCard}>
            <Text style={styles.availableLabel}>Disponível no mês</Text>

            <Text
              style={[
                styles.availableValue,
                remainingThisMonth < 0 && styles.availableNegative,
              ]}
            >
              {formatCurrency(remainingThisMonth)}
            </Text>

            {summary.expensesChangeRatio !== null && (
              <Text style={styles.comparison}>
                {summary.expensesChangeRatio <= 0
                  ? `Você gastou ${Math.abs(
                      summary.expensesChangeRatio * 100,
                    ).toFixed(0)}% menos que no mês passado`
                  : `Você gastou ${(
                      summary.expensesChangeRatio * 100
                    ).toFixed(0)}% mais que no mês passado`}
              </Text>
            )}
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={140}>
          <Text style={styles.sectionTitle}>📊 Seus gastos</Text>

          {summary.expensesByCategory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nenhum gasto registrado neste mês ainda. Registre uma despesa
                para ver a divisão por categoria.
              </Text>
            </View>
          ) : (
            <View style={styles.categoryList}>
              {summary.expensesByCategory.map((category) => (
                <View key={category.name} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{category.name}</Text>

                    <Text style={styles.categoryValue}>
                      {formatCurrency(category.total)}
                    </Text>
                  </View>

                  <View style={styles.categoryTrack}>
                    <View
                      style={[
                        styles.categoryFill,
                        {
                          width: `${
                            categoryMax > 0
                              ? (category.total / categoryMax) * 100
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.categoryShare}>
                    {(category.share * 100).toFixed(0)}% dos gastos
                  </Text>
                </View>
              ))}

              {summary.categorizedExpenseTotal < summary.monthExpenses && (
                <Text style={styles.categoryFooter}>
                  Total do mês: {formatCurrency(summary.monthExpenses)}
                </Text>
              )}
            </View>
          )}
        </AnimatedBlock>

        {allInsights.length > 0 && (
          <AnimatedBlock delay={180}>
            <Text style={styles.sectionTitle}>💡 Insights</Text>

            <View style={styles.insightList}>
              {allInsights.map((insight) => (
                <View
                  key={insight.id}
                  style={[
                    styles.insightCard,
                    insight.tone === "positive" && styles.insightPositive,
                    insight.tone === "warning" && styles.insightWarning,
                  ]}
                >
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>{insight.icon}</Text>

                    <Text style={styles.insightTitle}>{insight.title}</Text>
                  </View>

                  <Text style={styles.insightText}>
                    {insight.description}
                  </Text>
                </View>
              ))}
            </View>
          </AnimatedBlock>
        )}

        {summary.featuredGoal && (
          <AnimatedBlock delay={210} style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>🎯 Sua meta</Text>

              <Text style={styles.sectionSubtitle}>
                O caminho até o seu objetivo
              </Text>
            </View>

            <AnimatedPressable
              pressedScale={0.92}
              pressedOpacity={0.6}
              onPress={() => router.push("/(tabs)/goals")}
            >
              <Text style={styles.seeAll}>Ver todas</Text>
            </AnimatedPressable>
          </AnimatedBlock>
        )}

        {summary.featuredGoal && (
          <GoalProgressCard
            goal={summary.featuredGoal}
            goalCount={summary.goalCount}
          />
        )}

        <AnimatedBlock delay={240} style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Minhas contas</Text>

            <Text style={styles.sectionSubtitle}>Seus saldos por conta</Text>
          </View>

          <AnimatedPressable
            pressedScale={0.92}
            pressedOpacity={0.6}
            onPress={() => router.push("/(tabs)/accounts")}
          >
            <Text style={styles.seeAll}>Ver todas</Text>
          </AnimatedPressable>
        </AnimatedBlock>

        {summary.accounts.length === 0 ? (
          <FadeInView style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>

            <Text style={styles.emptyText}>
              Cadastre uma conta para começar a acompanhar seu saldo.
            </Text>

            <AnimatedPressable
              style={styles.inlineButton}
              onPress={() => router.push("/(tabs)/accounts")}
            >
              <Text style={styles.inlineButtonText}>+ Adicionar conta</Text>
            </AnimatedPressable>
          </FadeInView>
        ) : (
          <View style={styles.accountsList}>
            {summary.accounts.map((account, index) => (
              <AnimatedBlock
                key={account.id}
                delay={260 + index * 45}
                style={styles.accountCard}
              >
                <View style={styles.accountIcon}>
                  <Text style={styles.accountIconText}>
                    {account.type === "credit_card" ? "💳" : "$"}
                  </Text>
                </View>

                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>

                  <Text style={styles.accountType}>
                    {getAccountTypeLabel(account.type)}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.accountBalance,
                    account.balance < 0 && styles.expenseValue,
                  ]}
                >
                  {formatCurrency(account.balance)}
                </Text>
              </AnimatedBlock>
            ))}

            {nonCardAccounts.length === 0 &&
              summary.creditCards.length > 0 && (
                <Text style={styles.accountsHint}>
                  Você tem apenas cartões cadastrados. Cadastre uma conta para
                  acompanhar o dinheiro que realmente entra e sai.
                </Text>
              )}
          </View>
        )}

        <AnimatedBlock delay={300} style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Últimas movimentações</Text>

            <Text style={styles.sectionSubtitle}>O que passou por aqui</Text>
          </View>

          <AnimatedPressable
            pressedScale={0.92}
            pressedOpacity={0.6}
            onPress={() => router.push("/(tabs)/transactions")}
          >
            <Text style={styles.seeAll}>Ver todas</Text>
          </AnimatedPressable>
        </AnimatedBlock>

        {summary.recentTransactions.length === 0 ? (
          <FadeInView style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem transações</Text>

            <Text style={styles.emptyText}>
              Você ainda não possui nenhuma transação. Registre a primeira para
              começar a ver seus números aqui.
            </Text>

            <AnimatedPressable
              style={styles.inlineButton}
              onPress={() => router.push("/transaction/new")}
            >
              <Text style={styles.inlineButtonText}>
                + Adicionar transação
              </Text>
            </AnimatedPressable>
          </FadeInView>
        ) : (
          <View style={styles.recentList}>
            {summary.recentTransactions.map((item, index) => (
              <AnimatedBlock
                key={item.id}
                delay={320 + index * 40}
                style={styles.recentRow}
              >
                <View style={styles.recentInfo}>
                  <Text style={styles.recentDescription} numberOfLines={1}>
                    {item.description}
                  </Text>

                  <Text style={styles.recentMeta}>
                    {formatTransactionDate(item.date)} ·{" "}
                    {item.source === "manual" ? "Manual" : "Automático"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.recentAmount,
                    item.type === "income"
                      ? styles.incomeValue
                      : item.type === "transfer"
                        ? styles.transferValue
                        : styles.expenseValue,
                  ]}
                >
                  {item.type === "income"
                    ? "+"
                    : item.type === "transfer"
                      ? "↗"
                      : "-"}{" "}
                  {formatCurrency(item.amount)}
                </Text>
              </AnimatedBlock>
            ))}
          </View>
        )}

        <AnimatedBlock delay={360}>
          <Text style={styles.transactions}>
            {summary.transactionCount}{" "}
            {summary.transactionCount === 1
              ? "transação registrada"
              : "transações registradas"}
          </Text>

          <AnimatedPressable
            style={styles.newTransactionButton}
            pressedOpacity={0.85}
            onPress={() => router.push("/transaction/new")}
          >
            <Text style={styles.newTransactionButtonText}>
              + Nova transação
            </Text>
          </AnimatedPressable>
        </AnimatedBlock>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },

  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },

  errorText: {
    fontSize: 14,
    textAlign: "center",
    color: colors.expense,
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  retryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },

  header: {},

  greeting: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },

  month: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    textTransform: "capitalize",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  balanceCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },

  balanceLabel: {
    fontSize: 14,
    color: colors.onPrimary,
    opacity: 0.85,
  },

  balance: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: "800",
    color: colors.onPrimary,
  },

  balanceMeta: {
    marginTop: 8,
    fontSize: 13,
    color: colors.onPrimary,
    opacity: 0.85,
  },

  sectionLabel: {
    marginTop: 32,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSubtle,
  },

  cards: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  card: {
    flex: 1,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  label: {
    fontSize: 13,
    color: colors.textMuted,
  },

  incomeValue: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: "700",
    color: colors.income,
  },

  expenseValue: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: "700",
    color: colors.expense,
  },

  transferValue: {
    color: colors.primary,
  },

  sectionHeaderText: {
    flex: 1,
    marginRight: 12,
  },

  sectionHeader: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSubtle,
  },

  seeAll: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  accountsList: {
    marginTop: 14,
    gap: 10,
  },

  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSurface,
  },

  accountIconText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },

  accountName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  accountType: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSubtle,
  },

  accountBalance: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },

  inlineButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accentSurface,
  },

  inlineButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  availableCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
  },

  availableLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },

  availableValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: "800",
    color: colors.income,
  },

  availableNegative: {
    color: colors.expense,
  },

  comparison: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSubtle,
  },

  categoryList: {
    marginTop: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
    gap: 14,
  },

  categoryRow: {},

  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  categoryName: {
    flex: 1,
    marginRight: 12,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  categoryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  categoryTrack: {
    height: 6,
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },

  categoryFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  categoryShare: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSubtle,
  },

  categoryFooter: {
    fontSize: 12,
    color: colors.textSubtle,
  },

  accountsHint: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSubtle,
  },

  insightList: {
    marginTop: 14,
    gap: 10,
  },

  recentList: {
    marginTop: 14,
    gap: 10,
  },

  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  recentInfo: {
    flex: 1,
    marginRight: 12,
  },

  recentDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },

  recentMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSubtle,
  },

  recentAmount: {
    fontSize: 15,
    fontWeight: "700",
  },

  insightCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  insightPositive: {
    backgroundColor: colors.incomeSurface,
  },

  insightWarning: {
    backgroundColor: colors.warningSurface,
  },

  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  insightIcon: {
    fontSize: 16,
  },

  insightTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },

  insightText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },

  transactions: {
    marginTop: 24,
    fontSize: 13,
    color: colors.textMuted,
  },

  newTransactionButton: {
    height: 56,
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.primary,
  },

  newTransactionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  });
