import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { getDatabase } from "../src/database/database";
import { ThemeColors, useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

type MonthTotals = { income: number; expenses: number; count: number };
type CategoryTotal = { name: string; total: number };

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function currency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backButton: { width: 42, height: 42, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    backText: { color: colors.text, fontSize: 24 },
    titleArea: { flex: 1 },
    title: { color: colors.text, fontSize: 27, fontWeight: "800" },
    subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
    monthCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    monthButton: { width: 42, height: 42, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
    monthArrow: { color: colors.text, fontSize: 24 },
    monthLabel: { color: colors.text, fontWeight: "800", fontSize: 16, textAlign: "center", flex: 1 },
    summaryCard: { padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.primary, gap: spacing.xs },
    summaryLabel: { color: colors.onPrimary, opacity: 0.82, fontSize: 13 },
    summaryValue: { color: colors.onPrimary, fontSize: 28, fontWeight: "800" },
    summaryMeta: { color: colors.onPrimary, opacity: 0.88, fontSize: 12 },
    metricRow: { flexDirection: "row", gap: spacing.sm },
    metricCard: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
    metricLabel: { color: colors.textMuted, fontSize: 12 },
    income: { color: colors.income, fontWeight: "800", fontSize: 17 },
    expense: { color: colors.expense, fontWeight: "800", fontSize: 17 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    card: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
    categoryRow: { gap: spacing.xs },
    categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    categoryName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
    categoryValue: { color: colors.text, fontSize: 14, fontWeight: "800" },
    track: { height: 8, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    fill: { height: "100%", borderRadius: 8, backgroundColor: colors.primary },
    categoryMeta: { color: colors.textMuted, fontSize: 11 },
    insight: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
    insightTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    insightText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
    empty: { padding: spacing.lg, alignItems: "center", gap: spacing.sm },
    emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 20 },
    loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, gap: spacing.md },
    loadingText: { color: colors.textMuted },
  });
}

export default function ReportsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [totals, setTotals] = useState<MonthTotals>({ income: 0, expenses: 0, count: 0 });
  const [previous, setPrevious] = useState<MonthTotals>({ income: 0, expenses: 0, count: 0 });
  const [categories, setCategories] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const currentMonth = monthKey(new Date());

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const [currentRows, previousRows, categoryRows] = await Promise.all([
        db.getFirstAsync<{ income: number; expenses: number; count: number }>(
          `SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
            COUNT(*) AS count
          FROM transactions WHERE substr(date, 1, 7) = ?`,
          month,
        ),
        db.getFirstAsync<{ income: number; expenses: number; count: number }>(
          `SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses,
            COUNT(*) AS count
          FROM transactions WHERE substr(date, 1, 7) = ?`,
          shiftMonth(month, -1),
        ),
        db.getAllAsync<CategoryTotal>(
          `SELECT COALESCE(categories.name, 'Sem categoria') AS name,
                  SUM(transactions.amount) AS total
           FROM transactions
           LEFT JOIN categories ON categories.id = transactions.category_id
           WHERE transactions.type = 'expense'
             AND substr(transactions.date, 1, 7) = ?
           GROUP BY transactions.category_id, categories.name
           ORDER BY total DESC`,
          month,
        ),
      ]);
      setTotals({ income: currentRows?.income ?? 0, expenses: currentRows?.expenses ?? 0, count: currentRows?.count ?? 0 });
      setPrevious({ income: previousRows?.income ?? 0, expenses: previousRows?.expenses ?? 0, count: previousRows?.count ?? 0 });
      setCategories(categoryRows);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const balance = totals.income - totals.expenses;
  const difference = totals.expenses - previous.expenses;
  const maxCategory = categories[0]?.total ?? 0;
  const expenseChange = previous.expenses > 0 ? (difference / previous.expenses) * 100 : null;

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Calculando relatório...</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></AnimatedPressable>
        <View style={styles.titleArea}>
          <Text style={styles.title}>Relatórios</Text>
          <Text style={styles.subtitle}>Seus números, sem estimativas ou IA.</Text>
        </View>
      </View>

      <View style={styles.monthCard}>
        <AnimatedPressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, -1))}><Text style={styles.monthArrow}>‹</Text></AnimatedPressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <AnimatedPressable style={[styles.monthButton, month >= currentMonth && { opacity: 0.35 }]} disabled={month >= currentMonth} onPress={() => setMonth((value) => shiftMonth(value, 1))}><Text style={styles.monthArrow}>›</Text></AnimatedPressable>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Resultado do mês</Text>
        <Text style={styles.summaryValue}>{currency(balance)}</Text>
        <Text style={styles.summaryMeta}>{balance >= 0 ? "Sobrou mais do que saiu" : "Você gastou mais do que recebeu"} · {totals.count} movimentações</Text>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Entradas</Text><Text style={styles.income} adjustsFontSizeToFit numberOfLines={1}>{currency(totals.income)}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Despesas</Text><Text style={styles.expense} adjustsFontSizeToFit numberOfLines={1}>{currency(totals.expenses)}</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Comparação com o mês anterior</Text>
      <View style={styles.insight}>
        <Text style={styles.insightTitle}>{expenseChange === null ? "Ainda sem base de comparação" : difference > 0 ? "Seus gastos aumentaram" : difference < 0 ? "Seus gastos diminuíram" : "Seus gastos ficaram iguais"}</Text>
        <Text style={styles.insightText}>
          {expenseChange === null
            ? `No mês anterior (${monthLabel(shiftMonth(month, -1))}), não houve despesas registradas para comparar.`
            : `${Math.abs(expenseChange).toFixed(0)}% ${difference > 0 ? "a mais" : difference < 0 ? "a menos" : "de variação"} em despesas. Mês atual: ${currency(totals.expenses)}; anterior: ${currency(previous.expenses)}.`}
        </Text>
        <Text style={styles.insightText}>Entradas no mês anterior: {currency(previous.income)}.</Text>
      </View>

      <Text style={styles.sectionTitle}>Despesas por categoria</Text>
      {categories.length === 0 ? (
        <View style={[styles.card, styles.empty]}><Text style={styles.emptyText}>Nenhuma despesa neste mês. Quando você registrar gastos, a divisão por categoria aparecerá aqui.</Text></View>
      ) : (
        <View style={styles.card}>
          {categories.map((item) => (
            <View key={item.name} style={styles.categoryRow}>
              <View style={styles.categoryHeader}><Text style={styles.categoryName}>{item.name}</Text><Text style={styles.categoryValue}>{currency(item.total)}</Text></View>
              <View style={styles.track}><View style={[styles.fill, { width: `${maxCategory > 0 ? (item.total / maxCategory) * 100 : 0}%` }]} /></View>
              <Text style={styles.categoryMeta}>{totals.expenses > 0 ? `${((item.total / totals.expenses) * 100).toFixed(0)}% das despesas` : "0% das despesas"}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>O que dá para concluir</Text>
      <View style={styles.insight}>
        <Text style={styles.insightTitle}>{totals.income === 0 && totals.expenses === 0 ? "Registre suas movimentações" : balance >= 0 ? "Você fechou no azul" : "Atenção ao resultado do mês"}</Text>
        <Text style={styles.insightText}>
          {totals.income === 0 && totals.expenses === 0
            ? "Ainda não há movimentações de entrada ou saída neste mês. Registre suas transações para receber uma leitura mais útil."
            : balance >= 0
              ? `Depois das despesas, restaram ${currency(balance)}. Se couber no seu orçamento, considere direcionar parte para uma meta ou reserva.`
              : `As despesas superaram as entradas em ${currency(Math.abs(balance))}. Revise as maiores categorias e compare os gastos recorrentes antes de assumir novos compromissos.`}
        </Text>
        {categories[0] && <Text style={styles.insightText}>Maior categoria: {categories[0].name} ({currency(categories[0].total)}).</Text>}
      </View>
    </ScrollView>
  );
}
