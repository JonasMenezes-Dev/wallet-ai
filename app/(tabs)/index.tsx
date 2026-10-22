import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { router } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { PremiumAmbient } from "../../src/components/PremiumAmbient";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { AnimatedProgressFill } from "../../src/components/AnimatedProgressFill";
import { GoalProgressCard } from "../../src/components/GoalProgressCard";
import { useDashboard } from "../../src/hooks/use-dashboard";
import { useUserSettings } from "../../src/hooks/use-user-settings";
import { ThemeColors, useThemeColors, useThemedStyles, radii, spacing, typography } from "../../src/theme";
import {
  getFinancialInsights,
  FinancialInsight,
} from "../../src/services/financial-insights.service";
import type { DashboardInsight } from "../../src/services/dashboard.service";
import { formatTransactionDateTime } from "../../src/utils/date-time";
import { WalletSymbol } from "../../src/components/WalletSymbol";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
  const colors = useThemeColors();
  const [balanceVisible, setBalanceVisible] = useState(true);

  const [extraInsights, setExtraInsights] = useState<FinancialInsight[]>([]);

  useEffect(() => {
    getFinancialInsights()
      .then(setExtraInsights)
      .catch(() => setExtraInsights([]));
  }, [summary.transactionCount, summary.monthExpenses, settings?.salary]);

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" accessibilityLabel="Carregando resumo financeiro" />
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

  const remainingThisMonth = summary.availableBalance;

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
      icon: "insight",
      title: insight.title,
      description: insight.description,
      tone: insight.tone,
    })),
  ];

  return (
    <PremiumScreen style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AnimatedBlock style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <ScreenHeader eyebrow="Visão geral" title={getGreeting()} subtitle={summary.currentMonthName + " · " + summary.monthTransactionCount + " movimentações"} />
          </View>
          <AnimatedPressable
            style={styles.headerAction}
            accessibilityLabel="Abrir alertas financeiros"
            onPress={() => router.push("/alerts")}
          >
            <WalletSymbol name="alerts" color={colors.textMuted} size={20} />
          </AnimatedPressable>
        </AnimatedBlock>

        <AnimatedBlock delay={40} style={styles.balanceCard}>
          <PremiumAmbient variant="highlight" placement="card" />
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelRow}>
              <WalletSymbol name="accounts" color={colors.primary} size={18} />
              <Text style={styles.balanceLabel}>Patrimônio total</Text>
            </View>
            <AnimatedPressable
              style={styles.balanceToggle}
              onPress={() => setBalanceVisible((value) => !value)}
            >
              <Text style={styles.balanceToggleText}>{balanceVisible ? "Ocultar" : "Mostrar"}</Text>
            </AnimatedPressable>
          </View>

          <Text
            style={styles.balance}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {balanceVisible ? formatCurrency(summary.totalBalance) : "R$ ••••••"}
          </Text>

          <Text style={styles.balanceMeta}>
            {balanceVisible ? `Reservado em metas: ${formatCurrency(summary.reservedBalance)} · ` : ""}
            {summary.accounts.length}{" "}
            {summary.accounts.length === 1 ? "conta" : "contas"}
            {summary.creditCardUsedTotal > 0
              ? ` · ${formatCurrency(summary.creditCardUsedTotal)} em cartão`
              : ""}
          </Text>

          <View style={styles.heroActions}>
            <AnimatedPressable
              style={styles.heroPrimaryAction}
              pressedScale={0.98}
              onPress={() => router.push("/transaction/new")}
            >
              <WalletSymbol name="plus" color={colors.text} size={18} />
              <Text style={styles.heroPrimaryActionText}>Adicionar</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.heroSecondaryAction}
              pressedScale={0.98}
              onPress={() => router.push("/(tabs)/accounts")}
            >
              <WalletSymbol name="accounts" color={colors.primary} size={18} />
              <Text style={styles.heroSecondaryActionText}>Minhas contas</Text>
            </AnimatedPressable>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={70}>
          <Text style={styles.sectionLabel}>Este mês</Text>

          <View style={styles.cards}>
            <View style={styles.card}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIcon, styles.incomeIcon]}>
                  <WalletSymbol name="income" color={colors.income} size={17} />
                </View>
                <Text style={styles.label}>Entradas</Text>
              </View>

              <Text style={styles.incomeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {formatCurrency(summary.monthIncome)}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIcon, styles.expenseIcon]}>
                  <WalletSymbol name="expense" color={colors.expense} size={17} />
                </View>
                <Text style={styles.label}>Gastos</Text>
              </View>

              <Text style={styles.expenseValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {formatCurrency(summary.monthExpenses)}
              </Text>
            </View>
          </View>

          <View style={styles.availableCard}>
            <View style={styles.availableHeader}>
              <View style={styles.availableIcon}>
                <WalletSymbol name="budget" color={colors.primary} size={20} />
              </View>
              <View style={styles.availableCopy}>
                <Text style={styles.availableLabel}>Saldo livre</Text>
                <Text style={styles.availableHint}>Entradas menos despesas registradas</Text>
              </View>
            </View>

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

        <AnimatedBlock delay={100}>
          <Text style={styles.sectionTitle}>Gastos por categoria</Text>

          {summary.expensesByCategory.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <WalletSymbol name="budget" color={colors.primary} size={22} />
              </View>
              <Text style={styles.emptyTitle}>Seus gastos vão aparecer aqui</Text>
              <Text style={styles.emptyText}>
                Registre uma despesa para acompanhar como seu dinheiro está sendo usado.
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
                    <AnimatedProgressFill style={styles.categoryFill} progress={categoryMax > 0 ? category.total / categoryMax : 0} />
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
          <AnimatedBlock delay={130}>
            <Text style={styles.sectionTitle}>Insights para você</Text>

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
                    <View style={styles.insightIconWrap}>
                      <WalletSymbol name={insight.tone === "warning" ? "alerts" : "insight"} color={insight.tone === "warning" ? colors.warning : colors.primary} size={22} />
                    </View>
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
          <AnimatedBlock delay={150} style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Sua meta</Text>

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

        <AnimatedBlock delay={90} style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Acesso rápido</Text>
              <Text style={styles.sectionSubtitle}>Suas ferramentas financeiras</Text>
            </View>
          </View>
          <View style={styles.quickGrid}>
            <View style={styles.quickRow}>
              <AnimatedPressable style={styles.quickAction} pressedScale={0.98} onPress={() => router.push("/budgets")}>
                <View style={styles.quickIcon}><WalletSymbol name="budget" color={colors.primary} size={20} /></View>
                <Text style={styles.quickTitle}>Planejar gastos</Text>
                <Text style={styles.quickDescription}>Orçamentos mensais</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.quickAction} pressedScale={0.98} onPress={() => router.push("/recurring")}>
                <View style={styles.quickIcon}><WalletSymbol name="recurring" color={colors.primary} size={20} /></View>
                <Text style={styles.quickTitle}>Contas recorrentes</Text>
                <Text style={styles.quickDescription}>Vencimentos e previsão</Text>
              </AnimatedPressable>
            </View>
            <View style={styles.quickRow}>
              <AnimatedPressable style={styles.quickAction} pressedScale={0.98} onPress={() => router.push("/reports")}>
                <View style={styles.quickIcon}><WalletSymbol name="reports" color={colors.primary} size={20} /></View>
                <Text style={styles.quickTitle}>Relatórios</Text>
                <Text style={styles.quickDescription}>Veja seus resultados</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.quickAction} pressedScale={0.98} onPress={() => router.push("/statement-import")}>
                <View style={styles.quickIcon}><WalletSymbol name="receipt" color={colors.primary} size={20} /></View>
                <Text style={styles.quickTitle}>Importar extrato</Text>
                <Text style={styles.quickDescription}>Arquivo OFX ou CSV</Text>
              </AnimatedPressable>
            </View>
            <AnimatedPressable style={styles.alertShortcut} pressedScale={0.99} onPress={() => router.push("/alerts")}>
              <View style={styles.quickIcon}><WalletSymbol name="alerts" color={colors.primary} size={20} /></View>
              <View style={styles.alertShortcutCopy}>
                <Text style={styles.quickTitle}>Alertas financeiros</Text>
                <Text style={styles.quickDescription}>Orçamentos e vencimentos próximos</Text>
              </View>
              <WalletSymbol name="more" color={colors.textSubtle} size={20} />
            </AnimatedPressable>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={170} style={styles.sectionHeader}>
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
            <View style={styles.emptyIcon}>
              <WalletSymbol name="accounts" color={colors.primary} size={22} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma conta cadastrada</Text>
            <Text style={styles.emptyText}>
              Cadastre uma conta para começar a acompanhar seu saldo.
            </Text>
            <AnimatedPressable
              style={styles.inlineButton}
              onPress={() => router.push("/(tabs)/accounts")}
            >
              <WalletSymbol name="plus" color={colors.primary} size={18} />
              <Text style={styles.inlineButtonText}>Adicionar conta</Text>
            </AnimatedPressable>
          </FadeInView>
        ) : (
          <View style={styles.accountsList}>
            {summary.accounts.map((account, index) => (
              <AnimatedBlock
                key={account.id}
                delay={260 + Math.min(index * 25, 100)}
                style={styles.accountCard}
              >
                <View style={styles.accountIcon}>
                  <WalletSymbol name={account.type === "credit_card" ? "card" : "bank"} color={colors.primary} size={21} />
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

        <AnimatedBlock delay={200} style={styles.sectionHeader}>
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
            <View style={styles.emptyIcon}>
              <WalletSymbol name="transactions" color={colors.primary} size={22} />
            </View>
            <Text style={styles.emptyTitle}>Sem transações</Text>
            <Text style={styles.emptyText}>
              Você ainda não possui nenhuma transação. Registre a primeira para começar a ver seus números aqui.
            </Text>
            <AnimatedPressable
              style={styles.inlineButton}
              onPress={() => router.push("/transaction/new")}
            >
              <WalletSymbol name="plus" color={colors.primary} size={18} />
              <Text style={styles.inlineButtonText}>Adicionar transação</Text>
            </AnimatedPressable>
          </FadeInView>
        ) : (
          <View style={styles.recentList}>
            {summary.recentTransactions.map((item, index) => (
              <AnimatedBlock
                key={item.id}
                delay={220 + Math.min(index * 25, 100)}
                style={styles.recentRow}
              >
                <View
                  style={[
                    styles.recentIcon,
                    item.type === "income" ? styles.incomeIcon : item.type === "transfer" ? styles.transferIcon : styles.expenseIcon,
                  ]}
                >
                  <WalletSymbol
                    name={item.type === "income" ? "income" : item.type === "transfer" ? "transfer" : "expense"}
                    color={item.type === "income" ? colors.income : item.type === "transfer" ? colors.primary : colors.expense}
                    size={19}
                  />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentDescription} numberOfLines={1}>
                    {item.description}
                  </Text>

                  <Text style={styles.recentMeta}>
                    {formatTransactionDateTime(item.date)} ·{" "}
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

        <AnimatedBlock delay={240}>
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
            <WalletSymbol name="plus" color={colors.onPrimary} size={20} />
            <Text style={styles.newTransactionButtonText}>
              Nova transação
            </Text>
          </AnimatedPressable>
        </AnimatedBlock>
      </ScrollView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing["2xl"], paddingTop: spacing["3xl"], paddingBottom: spacing["4xl"], gap: spacing["2xl"] },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
    loadingText: { fontFamily: typography.family.regular,  fontSize: 14, color: colors.textMuted },
    errorText: { fontFamily: typography.family.regular,  fontSize: 14, textAlign: "center", color: colors.expense },
    retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
    retryButtonText: { fontFamily: typography.family.bold,  fontSize: 14, fontWeight: "700", color: colors.onPrimary },

    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    headerCopy: { flex: 1 },
    header: {},
    greeting: { fontFamily: typography.family.bold,  fontSize: 13, fontWeight: "700", color: colors.textMuted },
    pageTitle: { fontFamily: typography.family.bold,  marginTop: 5, fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.5, color: colors.text },
    month: { fontFamily: typography.family.bold,  marginTop: 6, fontSize: 30, fontWeight: "800", color: colors.text, textTransform: "capitalize" },
    subtitle: { fontFamily: typography.family.regular,  marginTop: 5, fontSize: 12, color: colors.textSubtle, textTransform: "capitalize" },
    headerAction: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },

    balanceCard: { position: "relative", overflow: "hidden", padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    heroOrb: { position: "absolute", top: -56, right: -38, width: 170, height: 170, borderRadius: 100, borderWidth: 28, borderColor: colors.accentSurface, opacity: 0.24 },
    heroOrbSecondary: { position: "absolute", bottom: -76, right: 85, width: 135, height: 135, borderRadius: 100, backgroundColor: colors.accentSurface, opacity: 0.16 },
    balanceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    balanceLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    balanceLabel: { fontFamily: typography.family.bold,  fontSize: 11, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
    balanceToggle: { minWidth: 64, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: colors.accentSurface },
    balanceToggleText: { fontFamily: typography.family.bold,  color: colors.primary, fontSize: 11, fontWeight: "700" },
    balance: { fontFamily: typography.family.bold,  marginTop: spacing.md, fontSize: 32, lineHeight: 40, fontWeight: "700", letterSpacing: -0.4, color: colors.text },
    balanceMeta: { fontFamily: typography.family.regular,  marginTop: 8, fontSize: 12, color: colors.textMuted },
    heroActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
    heroPrimaryAction: { minWidth: 120, minHeight: 46, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: spacing.sm, borderRadius: 15, backgroundColor: colors.surfaceMuted },
    heroPrimaryActionText: { fontFamily: typography.family.bold,  color: colors.text, fontSize: 13, fontWeight: "800" },
    heroSecondaryAction: { minWidth: 120, minHeight: 46, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: spacing.sm, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: "transparent" },
    heroSecondaryActionText: { fontFamily: typography.family.bold,  color: colors.primary, fontSize: 13, fontWeight: "700" },

    sectionLabel: { fontFamily: typography.family.bold,  marginTop: spacing.md, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textSubtle },
    cards: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg },
    card: { flex: 1, minWidth: 128, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    metricHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    incomeIcon: { backgroundColor: colors.incomeSurface },
    expenseIcon: { backgroundColor: colors.expenseSurface },
    transferIcon: { backgroundColor: colors.accentSurface },
    label: { fontFamily: typography.family.bold,  flexShrink: 1, fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    incomeValue: { fontFamily: typography.family.bold,  marginTop: spacing.md, fontSize: 18, fontWeight: "800", color: colors.income },
    expenseValue: { fontFamily: typography.family.bold,  marginTop: spacing.md, fontSize: 18, fontWeight: "800", color: colors.expense },
    transferValue: { color: colors.primary },

    availableCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    availableHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    availableIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSurface },
    availableCopy: { flex: 1 },
    availableLabel: { fontFamily: typography.family.bold,  fontSize: 13, color: colors.textMuted, fontWeight: "600" },
    availableHint: { fontFamily: typography.family.regular,  marginTop: 3, fontSize: 11, color: colors.textSubtle },
    availableValue: { fontFamily: typography.family.bold,  marginTop: spacing.sm, fontSize: 27, lineHeight: 34, fontWeight: "800", color: colors.income },
    availableNegative: { color: colors.expense },
    comparison: { fontFamily: typography.family.regular,  marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.textSubtle },

    sectionBlock: { gap: spacing.md },
    sectionHeaderText: { flex: 1, marginRight: spacing.sm },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    sectionTitle: { fontFamily: typography.family.bold,  fontSize: typography.size.subtitle, fontWeight: "800", letterSpacing: -0.25, color: colors.text },
    sectionSubtitle: { fontFamily: typography.family.regular,  marginTop: 4, fontSize: 12, lineHeight: 17, color: colors.textSubtle },
    seeAll: { fontFamily: typography.family.bold,  fontSize: 12, fontWeight: "800", color: colors.primary },
    quickGrid: { gap: spacing.sm },
    quickRow: { flexDirection: "row", gap: spacing.sm },
    quickAction: { flex: 1, minWidth: 0, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    quickIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSurface, marginBottom: spacing.sm },
    quickTitle: { fontFamily: typography.family.bold,  fontSize: 13, lineHeight: 17, fontWeight: "800", color: colors.text },
    quickDescription: { fontFamily: typography.family.regular,  marginTop: 4, fontSize: 11, lineHeight: 15, color: colors.textSubtle },
    alertShortcut: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    alertShortcutCopy: { flex: 1 },

    accountsList: { marginTop: 12, gap: spacing.sm },
    accountCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    accountIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSurface },
    accountIconText: { fontFamily: typography.family.bold,  fontSize: 18, fontWeight: "800", color: colors.primary },
    accountInfo: { flex: 1, minWidth: 0 },
    accountName: { fontFamily: typography.family.bold,  fontSize: 13, fontWeight: "800", color: colors.text },
    accountType: { fontFamily: typography.family.regular,  marginTop: 3, fontSize: 11, color: colors.textSubtle },
    accountBalance: { fontFamily: typography.family.bold,  maxWidth: "42%", fontSize: 13, fontWeight: "800", color: colors.text },

    emptyCard: { marginTop: 12, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
    emptyIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accentSurface, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
    emptyTitle: { fontFamily: typography.family.bold,  fontSize: 15, fontWeight: "800", color: colors.text },
    emptyText: { fontFamily: typography.family.regular,  marginTop: spacing.xs, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    inlineButton: { marginTop: spacing.md, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.accentSurface },
    inlineButtonText: { fontFamily: typography.family.bold,  fontSize: 13, fontWeight: "800", color: colors.primary },
    categoryList: { marginTop: 12, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.lg },
    categoryRow: { gap: 3 },
    categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    categoryName: { fontFamily: typography.family.bold,  flex: 1, marginRight: spacing.sm, fontSize: 13, fontWeight: "700", color: colors.text },
    categoryValue: { fontFamily: typography.family.bold,  fontSize: 13, fontWeight: "800", color: colors.text },
    categoryTrack: { height: 8, marginTop: spacing.sm, borderRadius: radii.pill, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    categoryFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.primary },
    categoryShare: { fontFamily: typography.family.regular,  marginTop: 5, fontSize: 11, color: colors.textSubtle },
    categoryFooter: { fontFamily: typography.family.bold,  fontSize: 12, color: colors.textMuted, fontWeight: "700" },
    accountsHint: { fontFamily: typography.family.regular,  fontSize: 12, lineHeight: 18, color: colors.textSubtle },

    insightList: { marginTop: 12, gap: spacing.sm },
    insightCard: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    insightPositive: { borderColor: colors.border },
    insightWarning: { borderColor: colors.warning },
    insightHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    insightIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    insightIcon: { fontFamily: typography.family.regular,  fontSize: 17 },
    insightTitle: { fontFamily: typography.family.bold,  flex: 1, fontSize: 13, fontWeight: "800", color: colors.text },
    insightText: { fontFamily: typography.family.regular,  marginTop: spacing.sm, fontSize: 12, lineHeight: 18, color: colors.textMuted },

    recentList: { marginTop: 12, gap: spacing.sm },
    recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    recentIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    recentInfo: { flex: 1, minWidth: 0, marginRight: spacing.xs },
    recentDescription: { fontFamily: typography.family.bold,  fontSize: 13, fontWeight: "800", color: colors.text },
    recentMeta: { fontFamily: typography.family.regular,  marginTop: 4, fontSize: 10, color: colors.textSubtle },
    recentAmount: { fontFamily: typography.family.bold,  maxWidth: "44%", fontSize: 12, fontWeight: "800", textAlign: "right" },
    transactions: { fontFamily: typography.family.regular,  marginTop: spacing.md, fontSize: 12, color: colors.textSubtle, textAlign: "center" },
    newTransactionButton: { minHeight: 54, marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.primary },
    newTransactionButtonText: { fontFamily: typography.family.bold,  fontSize: 15, fontWeight: "800", color: colors.onPrimary },
  });
