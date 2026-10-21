import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { AppText as Text } from "../src/components/AppText";
import { AppCard } from "../src/components/AppCard";
import { AppButton } from "../src/components/AppButton";
import { AppField } from "../src/components/AppField";
import { AppSelector } from "../src/components/AppSelector";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { PremiumSheet } from "../src/components/PremiumSheet";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { AnimatedProgressFill } from "../src/components/AnimatedProgressFill";
import { AnimatedListItem } from "../src/components/AnimatedListItem";
import { WalletSymbol } from "../src/components/WalletSymbol";
import { listCategories } from "../src/services/category.service";
import {
  deleteMonthlyBudget,
  listMonthlyBudgets,
  saveMonthlyBudget,
  type MonthlyBudget,
} from "../src/services/budget.service";
import type { Category } from "../src/types/category";
import { useThemedStyles, useThemeColors, spacing, radii, typography } from "../src/theme";

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return getMonthKey(new Date(year, monthNumber - 1 + offset, 1));
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseAmount(value: string) {
  const normalized = value.trim().includes(",")
    ? value.trim().replace(/\./g, "").replace(",", ".")
    : value.trim();
  return Number(normalized);
}

function createStyles(colors: import("../src/theme").ThemeColors) {
  return StyleSheet.create({
    content: { padding: spacing["2xl"], paddingBottom: spacing["4xl"], gap: spacing["2xl"] },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    backButton: {
      width: 44, height: 44, borderRadius: radii.md,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 24, lineHeight: 30 },
    monthCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
    },
    monthButton: {
      width: 44, height: 44, borderRadius: radii.md,
      alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted,
    },
    monthArrow: { color: colors.text, fontSize: 24, lineHeight: 30 },
    monthLabel: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "700", fontFamily: typography.family.bold, fontSize: 16 },
    summaryCard: {
      padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface,
      gap: spacing.xs,
    },
    summaryLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase" },
    summaryValue: { color: colors.text, fontSize: 32, lineHeight: 40, fontVariant: ["tabular-nums"], fontWeight: "700", fontFamily: typography.family.bold },
    summaryMeta: { color: colors.textMuted, fontSize: 12 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: typography.family.bold, marginBottom: spacing.xs },
    card: {
      padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
    },
    budgetHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing.sm },
    budgetInfo: { flex: 1, minWidth: 110, gap: 3 },
    categoryName: { color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: typography.family.bold },
    budgetMeta: { color: colors.textMuted, fontSize: 12 },
    amountArea: { alignItems: "flex-end", gap: 2 },
    spentValue: { color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: typography.family.bold },
    limitValue: { color: colors.textMuted, fontSize: 12 },
    progressTrack: { height: 8, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    progressFill: { height: "100%", borderRadius: 8, backgroundColor: colors.primary },
    progressWarning: { backgroundColor: colors.warning },
    progressOver: { backgroundColor: colors.expense },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    statusText: { flex: 1, fontSize: 12, color: colors.textMuted },
    warningText: { color: colors.warning, fontWeight: "700", fontFamily: typography.family.bold },
    overText: { color: colors.expense, fontWeight: "700", fontFamily: typography.family.bold },
    actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm },
    smallButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    smallButtonText: { color: colors.text, fontSize: 12, fontWeight: "700", fontFamily: typography.family.bold },
    deleteButtonText: { color: colors.expense, fontSize: 12, fontWeight: "700", fontFamily: typography.family.bold },
    emptyCard: {
      padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: spacing.sm,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: typography.family.bold, textAlign: "center" },
    emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 20, fontSize: 13 },
    formActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
    formAction: { flex: 1, minWidth: 120 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: spacing.md },
    loadingText: { color: colors.textMuted },
  });
}

export default function BudgetsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [month, setMonth] = useState(() => getMonthKey(new Date()));
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [nextBudgets, nextCategories] = await Promise.all([
        listMonthlyBudgets(month),
        listCategories(),
      ]);
      setBudgets(nextBudgets);
      setCategories(nextCategories);
    } catch (error) {
      console.error("Erro ao carregar orçamentos:", error);
      Alert.alert("Erro", "Não foi possível carregar os orçamentos.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const totalBudget = budgets.reduce((sum, item) => sum + item.amount, 0);
  const totalSpent = budgets.reduce((sum, item) => sum + item.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  function startNewBudget() {
    const firstUnused = categories.find(
      (category) => !budgets.some((budget) => budget.categoryId === category.id),
    );
    setSelectedCategoryId(firstUnused?.id ?? categories[0]?.id ?? null);
    setAmount("");
    setFormVisible(true);
  }

  function startEditing(budget: MonthlyBudget) {
    setSelectedCategoryId(budget.categoryId);
    setAmount(budget.amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
    setFormVisible(true);
  }

  async function handleSave() {
    const parsedAmount = parseAmount(amount);
    if (!selectedCategoryId) {
      Alert.alert("Categoria obrigatória", "Selecione uma categoria.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Valor inválido", "Informe um limite maior que zero.");
      return;
    }

    try {
      setSaving(true);
      await saveMonthlyBudget(selectedCategoryId, month, parsedAmount);
      setFormVisible(false);
      setAmount("");
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o orçamento.";
      Alert.alert("Erro ao salvar", message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(budget: MonthlyBudget) {
    Alert.alert(
      "Excluir orçamento",
      `Deseja remover o limite de ${budget.categoryName} em ${formatMonth(month)}? As transações serão mantidas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMonthlyBudget(budget.id);
              await reload();
            } catch (error) {
              Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível excluir o orçamento.");
            }
          },
        },
      ],
    );
  }

  if (loading && budgets.length === 0 && categories.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Carregando orçamentos...</Text>
      </View>
    );
  }

  return (
    <PremiumScreen ambient="subtle">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={styles.backText}>‹</Text>
          </Pressable>

        </View>

        <ScreenHeader title="Orçamentos" subtitle="Limites saudáveis para seus gastos." eyebrow="Planejamento" />

        <View style={styles.monthCard}>
          <Pressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, -1))} accessibilityLabel="Mês anterior">
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonth(month)}</Text>
          <Pressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, 1))} accessibilityLabel="Próximo mês">
            <Text style={styles.monthArrow}>›</Text>
          </Pressable>
        </View>

        <AppCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Disponível para gastar</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalRemaining)}</Text>
          <Text style={styles.summaryMeta}>
            {formatCurrency(totalSpent)} gastos de {formatCurrency(totalBudget)} orçados · {formatCurrency(Math.abs(totalRemaining))} {totalRemaining >= 0 ? "restantes no total" : "acima do total orçado"}
          </Text>
        </AppCard>

        <View style={{ gap: spacing.md }}>
          <Text style={styles.sectionTitle}>Limites por categoria</Text>
          {budgets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhum orçamento para este mês</Text>
              <Text style={styles.emptyText}>
                Defina um limite para alimentação, transporte, lazer ou outra categoria. O Wallet.ai acompanhará os gastos já registrados.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {budgets.map((budget, index) => {
                const ratio = budget.spent / budget.amount;
                const progress = Math.min(ratio * 100, 100);
                const isOver = ratio > 1;
                const isWarning = ratio >= 0.7 && !isOver;
                const left = budget.amount - budget.spent;

                return (
                  <AnimatedListItem key={budget.id} index={index}>
                  <AppCard style={styles.card}>
                    <View style={styles.budgetHeader}>
                      <View style={styles.budgetInfo}>
                        <Text style={styles.categoryName}>{budget.categoryName}</Text>
                        <Text style={styles.budgetMeta}>{ratio >= 1 ? "Limite atingido" : `${(ratio * 100).toFixed(0)}% utilizado`}</Text>
                      </View>
                      <View style={styles.amountArea}>
                        <Text style={styles.spentValue}>{formatCurrency(budget.spent)}</Text>
                        <Text style={styles.limitValue}>de {formatCurrency(budget.amount)}</Text>
                      </View>
                    </View>

                    <View style={styles.progressTrack}>
                      <AnimatedProgressFill progress={progress / 100} style={[
                        styles.progressFill,
                        isWarning && styles.progressWarning,
                        isOver && styles.progressOver,
                      ]} />
                    </View>

                    <View style={styles.statusRow}>
                      <Text style={[
                        styles.statusText,
                        isOver && styles.overText,
                        isWarning && styles.warningText,
                      ]}>
                        {isOver
                          ? `Você ultrapassou em ${formatCurrency(Math.abs(left))}`
                          : isWarning
                            ? `Atenção: restam ${formatCurrency(left)}`
                            : `Restam ${formatCurrency(left)}`}
                      </Text>
                      <Text style={styles.statusText}>{(ratio * 100).toFixed(0)}%</Text>
                    </View>

                    <View style={styles.actions}>
                      <Pressable style={styles.smallButton} onPress={() => startEditing(budget)}>
                        <Text style={styles.smallButtonText}>Editar limite</Text>
                      </Pressable>
                      <Pressable style={styles.smallButton} onPress={() => confirmDelete(budget)}>
                        <Text style={styles.deleteButtonText}>Excluir</Text>
                      </Pressable>
                    </View>
                  </AppCard>
                  </AnimatedListItem>
                );
              })}
            </View>
          )}
        </View>

        <AppButton label="Criar orçamento" onPress={startNewBudget} leading={<WalletSymbol name="plus" color={colors.onPrimary} size={18} />} />
      </ScrollView>
      <PremiumSheet visible={formVisible} onClose={() => { if (!saving) setFormVisible(false); }} title={budgets.some((item) => item.categoryId === selectedCategoryId) ? "Editar orçamento" : "Novo orçamento"}>
        <Text variant="label" tone="muted">Categoria</Text>
        <AppSelector options={categories.map(category => ({ label: category.name, value: category.id }))} value={selectedCategoryId ?? -1} onChange={setSelectedCategoryId} accessibilityLabel="Categoria do orçamento" disabled={saving} />
        <AppField label="Limite mensal (R$)" value={amount} onChangeText={setAmount} placeholder="Ex.: 400,00" keyboardType="decimal-pad" returnKeyType="done" editable={!saving} />
        <View style={styles.formActions}>
          <AppButton label="Cancelar" variant="secondary" onPress={() => setFormVisible(false)} disabled={saving} style={styles.formAction} />
          <AppButton label="Salvar limite" onPress={() => void handleSave()} loading={saving} style={styles.formAction} />
        </View>
      </PremiumSheet>
    </PremiumScreen>
  );
}
