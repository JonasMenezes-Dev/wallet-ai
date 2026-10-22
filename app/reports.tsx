import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AppText as Text } from "../src/components/AppText";
import { AppCard } from "../src/components/AppCard";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { AnimatedListItem } from "../src/components/AnimatedListItem";
import { AnimatedProgressFill } from "../src/components/AnimatedProgressFill";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { getMonthlyReport, shiftMonth, type MonthlyReport } from "../src/services/reports.service";
import { useThemeColors, useThemedStyles, spacing, radii, typography } from "../src/theme";

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
    <PremiumScreen ambient="highlight">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹  Voltar</Text></AnimatedPressable>
        <ScreenHeader title="Relatórios" subtitle="Entenda para onde seu dinheiro vai." eyebrow="Inteligência financeira" />
        <View style={styles.monthPicker}>
          <AnimatedPressable accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, -1))}><Text style={styles.arrow}>‹</Text></AnimatedPressable>
          <Text style={styles.monthText}>{formatMonth(month)}</Text>
          <AnimatedPressable accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, 1))}><Text style={styles.arrow}>›</Text></AnimatedPressable>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : !report ? (
          <Text style={styles.helper}>Não foi possível carregar os dados deste mês.</Text>
        ) : (
          <>
            <AppCard ambient="highlight" style={styles.hero}>
              <Text style={styles.heroLabel}>Balanço do período</Text>
              <Text variant="amount" style={[styles.heroValue, report.balance < 0 && styles.expense]}>{formatCurrency(report.balance)}</Text>
              <Text style={styles.heroCaption}>{report.transactionCount} movimentações registradas</Text>
            </AppCard>
            <View style={styles.summaryRow}>
              <AppCard style={styles.summaryCard}><Text style={styles.label}>Entradas</Text><Text style={styles.income}>{formatCurrency(report.income)}</Text></AppCard>
              <AppCard style={styles.summaryCard}><Text style={styles.label}>Consumo líquido</Text><Text style={styles.expense}>{formatCurrency(report.expenses)}</Text></AppCard>
            </View>
            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Reservas próprias</Text>
              <Text style={styles.helper}>Aportes: {formatCurrency(report.contributions)}</Text>
              <Text style={styles.helper}>Resgates: {formatCurrency(report.withdrawals)}</Text>
              <Text style={styles.helper}>Economia efetiva: {formatCurrency(report.effectiveSavings)}</Text>
              <Text style={styles.helper}>Economia = receitas reais menos despesas de consumo. Mover dinheiro para metas não gera receita nem consumo.</Text>
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Evolução financeira</Text>
              <Text style={styles.helper}>Despesas em comparação com o mês anterior</Text>
              <View style={styles.chart}>
                {[{ label: "Mês anterior", value: report.previousExpenses }, { label: "Mês atual", value: report.expenses }].map((item, index) => (
                  <View key={item.label} style={styles.chartColumn}>
                    <Text variant="caption" tone="muted">{formatCurrency(item.value)}</Text>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartBar, { height: `${Math.max(0, item.value) / Math.max(1, report.previousExpenses, report.expenses) * 100}%`, backgroundColor: index === 1 ? colors.primary : colors.accentSurface }]} />
                    </View>
                    <Text variant="caption" tone="muted">{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.helper}>Mês anterior: {formatCurrency(report.previousExpenses)} em despesas.</Text>
              <Text style={[styles.comparison, expensesChange !== null && expensesChange > 0 ? styles.expense : styles.income]}>
                {expensesChange === null ? "Ainda não há dados suficientes para comparar." : expensesChange > 0 ? `Você gastou ${expensesChange.toFixed(0)}% a mais.` : expensesChange < 0 ? `Você gastou ${Math.abs(expensesChange).toFixed(0)}% a menos.` : "Seus gastos ficaram iguais."}
              </Text>
            </AppCard>
            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Despesas por categoria</Text>
              {report.expensesByCategory.length === 0 ? <Text style={styles.helper}>Nenhuma despesa registrada neste mês.</Text> :
                report.expensesByCategory.map((item, index) => (
                  <AnimatedListItem key={String(item.categoryId ?? "none")} index={index} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}><Text style={styles.categoryName}>{item.categoryName}</Text><Text style={styles.categoryValue}>{formatCurrency(item.total)}</Text></View>
                    <View style={styles.track}><AnimatedProgressFill progress={item.total / maxCategory} style={styles.fill} /></View>
                  </AnimatedListItem>
                ))}
            </AppCard>
          </>
        )}
      </ScrollView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { padding: spacing["2xl"], paddingBottom: spacing["4xl"], gap: spacing["2xl"] },
  backButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  backText: { color: colors.text, fontWeight: "700", fontFamily: typography.family.bold },
  monthPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.xs },
  monthButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  arrow: { color: colors.text, fontSize: 28, lineHeight: 34 },
  monthText: { flex: 1, textAlign: "center", flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: typography.family.bold, textTransform: "capitalize" },
  hero: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, gap: spacing.sm },
  heroLabel: { color: colors.textMuted, fontSize: 11, fontFamily: typography.family.bold, textTransform: "uppercase" },
  heroValue: { color: colors.primary, fontSize: 32, lineHeight: 40, fontWeight: "700", fontFamily: typography.family.bold, fontVariant: ["tabular-nums"] },
  heroCaption: { color: colors.textMuted, fontSize: 12 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryCard: { flex: 1, minWidth: 120, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 12 },
  income: { color: colors.income, fontWeight: "700", fontFamily: typography.family.bold },
  expense: { color: colors.expense, fontWeight: "700", fontFamily: typography.family.bold },
  card: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: "700", fontFamily: typography.family.bold },
  helper: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  comparison: { fontSize: 14, fontWeight: "700", fontFamily: typography.family.bold },
  chart: { flexDirection: "row", gap: spacing.xl, justifyContent: "space-around" },
  chartColumn: { flex: 1, alignItems: "center", gap: spacing.sm },
  chartTrack: { height: 110, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  chartBar: { width: 28, borderRadius: 6 },
  categoryRow: { gap: spacing.xs },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  categoryName: { color: colors.text, fontSize: 14, flex: 1 },
  categoryValue: { color: colors.text, fontSize: 14, fontWeight: "700", fontFamily: typography.family.bold },
  track: { height: 8, borderRadius: 8, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 8, backgroundColor: colors.primary },
});
