import { ScrollView, StyleSheet, Text, View } from "react-native";

import { router } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import {
  IncomeExpenseBar,
  IncomeExpenseLegend,
} from "../../src/components/IncomeExpenseBar";
import { useDashboard } from "../../src/hooks/use-dashboard";
import { ThemeColors, useThemedStyles } from "../../src/theme";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
  const { summary, loading, error } = useDashboard();
  const styles = useThemedStyles(createStyles);

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text>Carregando...</Text>
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <AnimatedBlock style={styles.header}>
          <View>
            <Text style={styles.month}>{summary.currentMonthName}</Text>

            <Text style={styles.subtitle}>Visão geral das suas finanças</Text>
          </View>
        </AnimatedBlock>

        <AnimatedBlock style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo disponível</Text>

          <Text style={styles.balance}>{formatCurrency(summary.balance)}</Text>

          <Text style={styles.accountCount}>
            {summary.accounts.length}{" "}
            {summary.accounts.length === 1
              ? "conta cadastrada"
              : "contas cadastradas"}
          </Text>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <Text style={styles.sectionTitle}>Este mês</Text>

          <View style={styles.cards}>
            <View style={styles.card}>
              <Text style={styles.label}>Entradas</Text>

              <Text style={styles.income}>
                {formatCurrency(summary.monthIncome)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Gastos</Text>

              <Text style={styles.expense}>
                {formatCurrency(summary.monthExpenses)}
              </Text>
            </View>
          </View>

          <View style={styles.barSection}>
            <IncomeExpenseBar
              income={summary.monthIncome}
              expenses={summary.monthExpenses}
            />

            <IncomeExpenseLegend
              income={summary.monthIncome}
              expenses={summary.monthExpenses}
            />
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={140} style={styles.sectionHeader}>
          <View>
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
              style={styles.addAccountButton}
              onPress={() => router.push("/(tabs)/accounts")}
            >
              <Text style={styles.addAccountButtonText}>+ Adicionar conta</Text>
            </AnimatedPressable>
          </FadeInView>
        ) : (
          <View style={styles.accountsList}>
            {summary.accounts.map((account, index) => (
              <AnimatedBlock
                key={account.id}
                delay={120 + index * 45}
                style={styles.accountCard}
              >
                <View style={styles.accountIcon}>
                  <Text style={styles.accountIconText}>$</Text>
                </View>

                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.name}</Text>

                  <Text style={styles.accountType}>
                    {getAccountTypeLabel(account.type)}
                  </Text>
                </View>

                <Text style={styles.accountBalance}>
                  {formatCurrency(account.balance)}
                </Text>
              </AnimatedBlock>
            ))}
          </View>
        )}

        <AnimatedBlock delay={220}>
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
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  month: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    textTransform: "capitalize",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: colors.textMuted,
  },

  balanceCard: {
    marginTop: 28,
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

  accountCount: {
    marginTop: 8,
    fontSize: 13,
    color: colors.onPrimary,
    opacity: 0.85,
  },

  cards: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  barSection: {
    marginTop: 16,
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

  income: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: "700",
    color: colors.income,
  },

  expense: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: "700",
    color: colors.expense,
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

  addAccountButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accentSurface,
  },

  addAccountButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  transactions: {
    marginTop: 24,
    fontSize: 13,
    color: colors.textMuted,
  },

  newTransactionButton: {
    height: 56,
    marginTop: 18,
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
