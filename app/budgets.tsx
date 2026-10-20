import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { listCategories } from "../src/services/category.service";
import {
  deleteMonthlyBudget,
  listMonthlyBudgets,
  saveMonthlyBudget,
  type MonthlyBudget,
} from "../src/services/budget.service";
import type { Category } from "../src/types/category";
import { useThemedStyles, useThemeColors, spacing, radii } from "../src/theme";

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
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing["2xl"], gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    backButton: {
      width: 42, height: 42, borderRadius: radii.md,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    backText: { color: colors.text, fontSize: 24 },
    titleArea: { flex: 1 },
    title: { color: colors.text, fontSize: 27, fontWeight: "800" },
    subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
    monthCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
    },
    monthButton: {
      width: 42, height: 42, borderRadius: radii.md,
      alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted,
    },
    monthArrow: { color: colors.text, fontSize: 24 },
    monthLabel: { color: colors.text, fontWeight: "800", fontSize: 16 },
    summaryCard: {
      padding: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.primary,
      gap: spacing.xs,
    },
    summaryLabel: { color: colors.onPrimary, opacity: 0.82, fontSize: 13 },
    summaryValue: { color: colors.onPrimary, fontSize: 27, fontWeight: "800" },
    summaryMeta: { color: colors.onPrimary, opacity: 0.88, fontSize: 12 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.xs },
    card: {
      padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
    },
    budgetHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    budgetInfo: { flex: 1, gap: 3 },
    categoryName: { color: colors.text, fontSize: 16, fontWeight: "800" },
    budgetMeta: { color: colors.textMuted, fontSize: 12 },
    amountArea: { alignItems: "flex-end", gap: 2 },
    spentValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
    limitValue: { color: colors.textMuted, fontSize: 12 },
    progressTrack: { height: 8, borderRadius: 8, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    progressFill: { height: "100%", borderRadius: 8, backgroundColor: colors.primary },
    progressWarning: { backgroundColor: colors.warning },
    progressOver: { backgroundColor: colors.expense },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    statusText: { flex: 1, fontSize: 12, color: colors.textMuted },
    warningText: { color: colors.warning, fontWeight: "700" },
    overText: { color: colors.expense, fontWeight: "800" },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    smallButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    smallButtonText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    deleteButtonText: { color: colors.expense, fontSize: 12, fontWeight: "700" },
    primaryButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radii.md, alignItems: "center" },
    primaryButtonText: { color: colors.onPrimary, fontWeight: "800" },
    emptyCard: {
      padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: spacing.sm,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 20, fontSize: 13 },
    formCard: {
      padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
    },
    fieldLabel: { color: colors.text, fontWeight: "700", fontSize: 13, marginTop: spacing.xs },
    categoryOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    categoryChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radii.md },
    categoryChipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSurface },
    categoryChipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 18 },
    formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    secondaryButton: { flex: 1, padding: spacing.md, borderRadius: radii.md, alignItems: "center", backgroundColor: colors.surfaceMuted },
    secondaryButtonText: { color: colors.text, fontWeight: "700" },
    saveButton: { flex: 1, padding: spacing.md, borderRadius: radii.md, alignItems: "center", backgroundColor: colors.primary },
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.titleArea}>
            <Text style={styles.title}>Orçamentos</Text>
            <Text style={styles.subtitle}>Defina limites para seus gastos.</Text>
          </View>
        </View>

        <View style={styles.monthCard}>
          <Pressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, -1))} accessibilityLabel="Mês anterior">
            <Text style={styles.monthArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonth(month)}</Text>
          <Pressable style={styles.monthButton} onPress={() => setMonth((value) => shiftMonth(value, 1))} accessibilityLabel="Próximo mês">
            <Text style={styles.monthArrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total orçado neste mês</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBudget)}</Text>
          <Text style={styles.summaryMeta}>
            {formatCurrency(totalSpent)} gastos nas categorias orçadas · {formatCurrency(Math.abs(totalRemaining))} {totalRemaining >= 0 ? "restantes no total" : "acima do total orçado"}
          </Text>
        </View>

        <View>
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
              {budgets.map((budget) => {
                const ratio = budget.spent / budget.amount;
                const progress = Math.min(ratio * 100, 100);
                const isOver = ratio > 1;
                const isWarning = ratio >= 0.7 && !isOver;
                const left = budget.amount - budget.spent;

                return (
                  <View key={budget.id} style={styles.card}>
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
                      <View style={[
                        styles.progressFill,
                        { width: `${progress}%` },
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
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {formVisible ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{budgets.some((item) => item.categoryId === selectedCategoryId) ? "Editar orçamento" : "Novo orçamento"}</Text>
            <Text style={styles.fieldLabel}>Categoria</Text>
            <View style={styles.categoryOptions}>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={[styles.categoryChip, selectedCategoryId === category.id && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <Text style={styles.categoryChipText}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Limite mensal (R$)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Ex.: 400,00"
              keyboardType="decimal-pad"
              returnKeyType="done"
              style={styles.input}
              placeholderTextColor={colors.textSubtle}
            />
            <View style={styles.formActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Salvar limite</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.primaryButton} onPress={startNewBudget}>
            <Text style={styles.primaryButtonText}>+ Definir orçamento por categoria</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
