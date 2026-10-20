import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { getMonthlyReport, shiftMonth, type MonthlyReport } from "../src/services/reports.service";
import { useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function ReportsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setReport(await getMonthlyReport(month)); }
    catch (error) { console.error("Erro ao carregar relatório:", error); setReport(null); }
    finally { setLoading(false); }
  }, [month]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const expensesChange = report && report.previousExpenses > 0
    ? ((report.expenses - report.previousExpenses) / report.previousExpenses) * 100
    : null;
  const maxCategory = Math.max(1, ...(report?.expensesByCategory.map((item) => item.total) ?? []));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹  Voltar</Text></AnimatedPressable>
        <ScreenHeader title="Relatórios" subtitle="Entenda como seu dinheiro entrou e saiu." eyebrow="Visão financeira" />
        <View style={styles.monthPicker}>
          <AnimatedPressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, -1))}><Text style={styles.arrow}>‹</Text></AnimatedPressable>
          <Text style={styles.monthText}>{formatMonth(month)}</Text>
          <AnimatedPressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, 1))}><Text style={styles.arrow}>›</Text></AnimatedPressable>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : !report ? (
          <Text style={styles.helper}>Não foi possível carregar os dados deste mês.</Text>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Resultado do mês</Text>
              <Text style={[styles.heroValue, report.balance < 0 && styles.expense]}>{formatCurrency(report.balance)}</Text>
              <Text style={styles.heroCaption}>{report.transactionCount} movimentações registradas</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}><Text style={styles.label}>Entradas</Text><Text style={styles.income}>{formatCurrency(report.income)}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.label}>Despesas</Text><Text style={styles.expense}>{formatCurrency(report.expenses)}</Text></View>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Comparação com o mês anterior</Text>
              <Text style={styles.helper}>Mês anterior: {formatCurrency(report.previousExpenses)} em despesas.</Text>
              <Text style={[styles.comparison, expensesChange !== null && expensesChange > 0 ? styles.expense : styles.income]}>
                {expensesChange === null ? "Ainda não há dados suficientes para comparar." : expensesChange > 0 ? `Você gastou ${expensesChange.toFixed(0)}% a mais.` : expensesChange < 0 ? `Você gastou ${Math.abs(expensesChange).toFixed(0)}% a menos.` : "Seus gastos ficaram iguais."}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Despesas por categoria</Text>
              {report.expensesByCategory.length === 0 ? <Text style={styles.helper}>Nenhuma despesa registrada neste mês.</Text> :
                report.expensesByCategory.map((item) => (
                  <View key={String(item.categoryId ?? "none")} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}><Text style={styles.categoryName}>{item.categoryName}</Text><Text style={styles.categoryValue}>{formatCurrency(item.total)}</Text></View>
                    <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, item.total / maxCategory * 100)}%` }]} /></View>
                  </View>
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing["4xl"], gap: spacing.md },
  backButton: { alignSelf: "flex-start", padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  backText: { color: colors.text, fontWeight: "700" },
  monthPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.xs },
  monthButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  arrow: { color: colors.text, fontSize: 28 },
  monthText: { color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  hero: { padding: spacing.xl, borderRadius: radii.xl, backgroundColor: colors.primary, gap: spacing.xs },
  heroLabel: { color: colors.onPrimary, opacity: 0.85 },
  heroValue: { color: colors.onPrimary, fontSize: 30, fontWeight: "800" },
  heroCaption: { color: colors.onPrimary, opacity: 0.85, fontSize: 12 },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCard: { flex: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 12 },
  income: { color: colors.income, fontWeight: "800" },
  expense: { color: colors.expense, fontWeight: "800" },
  card: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  comparison: { fontSize: 14, fontWeight: "700" },
  categoryRow: { gap: spacing.xs },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  categoryName: { color: colors.text, fontSize: 13, flex: 1 },
  categoryValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  track: { height: 8, borderRadius: 8, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 8, backgroundColor: colors.primary },
});
