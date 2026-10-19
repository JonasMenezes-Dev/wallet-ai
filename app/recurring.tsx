import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";

import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { listCategories } from "../src/services/category.service";
import {
  advanceRecurringItem,
  deleteRecurringItem,
  getCashflowForecast,
  listRecurringItems,
  saveRecurringItem,
  type CashflowForecast,
  type RecurringItem,
} from "../src/services/recurring.service";
import type { Category } from "../src/types/category";
import { ThemeColors, useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return parseDate(value).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(value: string) {
  const normalized = value.trim().includes(",")
    ? value.trim().replace(/\./g, "").replace(",", ".")
    : value.trim();
  return Number(normalized);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    backText: { color: colors.text, fontWeight: "700" },
    forecastCard: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radii.xl, gap: spacing.sm },
    forecastLabel: { color: colors.onPrimary, opacity: 0.85, fontSize: 13 },
    forecastValue: { color: colors.onPrimary, fontSize: 28, fontWeight: "800" },
    forecastDescription: { color: colors.onPrimary, opacity: 0.9, fontSize: 12, lineHeight: 18 },
    forecastRow: { flexDirection: "row", gap: spacing.sm },
    forecastMetric: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
    metricLabel: { color: colors.textMuted, fontSize: 11 },
    metricValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    itemCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radii.lg, gap: spacing.sm },
    itemHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    itemInfo: { flex: 1, gap: 4 },
    itemTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    itemMeta: { color: colors.textMuted, fontSize: 12 },
    itemAmount: { fontSize: 16, fontWeight: "800" },
    income: { color: colors.income },
    expense: { color: colors.expense },
    actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm },
    smallButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    smallButtonText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    dangerText: { color: colors.expense, fontSize: 12, fontWeight: "700" },
    formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
    label: { color: colors.text, fontWeight: "700", fontSize: 13, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 16 },
    typeRow: { flexDirection: "row", gap: spacing.sm },
    typeButton: { flex: 1, padding: spacing.md, alignItems: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
    typeButtonSelected: { backgroundColor: colors.accentSurface, borderColor: colors.primary },
    typeText: { color: colors.text, fontWeight: "700" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSurface },
    chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
    dateButton: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    dateText: { color: colors.text, fontWeight: "600" },
    formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    cancelButton: { flex: 1, padding: spacing.md, borderRadius: radii.md, alignItems: "center", backgroundColor: colors.surfaceMuted },
    cancelText: { color: colors.text, fontWeight: "700" },
    saveButton: { flex: 1, padding: spacing.md, borderRadius: radii.md, alignItems: "center", backgroundColor: colors.primary },
    saveText: { color: colors.onPrimary, fontWeight: "800" },
    primaryButton: { padding: spacing.md, borderRadius: radii.md, alignItems: "center", backgroundColor: colors.primary },
    primaryText: { color: colors.onPrimary, fontWeight: "800" },
    emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radii.lg, alignItems: "center", gap: spacing.sm },
    emptyTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
    emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 20, fontSize: 13 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: spacing.sm },
    loadingText: { color: colors.textMuted },
  });
}

export default function RecurringScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [forecast, setForecast] = useState<CashflowForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [nextDueDate, setNextDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return dateKey(date);
  });
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [nextItems, nextCategories, nextForecast] = await Promise.all([
        listRecurringItems(),
        listCategories(),
        getCashflowForecast(30),
      ]);
      setItems(nextItems);
      setCategories(nextCategories);
      setForecast(nextForecast);
    } catch (error) {
      console.error("Erro ao carregar recorrências:", error);
      Alert.alert("Erro", "Não foi possível carregar as contas recorrentes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  function resetForm() {
    setFormVisible(false);
    setEditingId(null);
    setTitle("");
    setType("expense");
    setAmount("");
    setCategoryId(null);
    const date = new Date();
    date.setDate(date.getDate() + 1);
    setNextDueDate(dateKey(date));
    setDatePickerVisible(false);
  }

  function startNew() {
    resetForm();
    setFormVisible(true);
  }

  function startEdit(item: RecurringItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setType(item.type);
    setAmount(item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setCategoryId(item.categoryId);
    setNextDueDate(item.nextDueDate);
    setFormVisible(true);
  }

  async function handleSave() {
    const parsed = parseMoney(amount);
    if (!title.trim()) {
      Alert.alert("Nome obrigatório", "Informe o nome da conta ou entrada recorrente.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert("Valor inválido", "Informe um valor maior que zero.");
      return;
    }
    try {
      setSaving(true);
      await saveRecurringItem({
        id: editingId ?? undefined,
        title,
        type,
        amount: parsed,
        categoryId,
        nextDueDate,
      });
      resetForm();
      await reload();
    } catch (error) {
      Alert.alert("Não foi possível salvar", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: RecurringItem) {
    Alert.alert("Excluir recorrência", `Deseja excluir "${item.title}"? O histórico de transações não será alterado.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        try {
          await deleteRecurringItem(item.id);
          await reload();
        } catch (error) {
          Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível excluir.");
        }
      } },
    ]);
  }

  function confirmAdvance(item: RecurringItem) {
    Alert.alert(
      "Atualizar próximo vencimento",
      "Confirme apenas se você já pagou/recebeu e registrou essa movimentação na tela Transações. Esta ação não cria uma transação; apenas avança a data prevista.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Já registrei", onPress: async () => {
          try {
            await advanceRecurringItem(item.id);
            await reload();
          } catch (error) {
            Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível atualizar.");
          }
        } },
      ],
    );
  }

  if (loading && !forecast) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Calculando previsão...</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={24}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AnimatedPressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>← Voltar</Text></AnimatedPressable>
        </View>

        <ScreenHeader title="Contas recorrentes" subtitle="Antecipe entradas e contas que se repetem todo mês." eyebrow="Planejamento financeiro" />

        {forecast && (
          <View style={styles.forecastCard}>
            <Text style={styles.forecastLabel}>Saldo projetado para os próximos 30 dias</Text>
            <Text style={styles.forecastValue}>{formatCurrency(forecast.projectedBalance)}</Text>
            <Text style={styles.forecastDescription}>
              Saldo atual de {formatCurrency(forecast.currentBalance)}, somado às entradas previstas e descontadas as contas cadastradas. É uma estimativa, não uma movimentação real.
            </Text>
            <View style={styles.forecastRow}>
              <View style={styles.forecastMetric}>
                <Text style={styles.metricLabel}>Entradas previstas</Text>
                <Text style={[styles.metricValue, styles.income]}>{formatCurrency(forecast.upcomingIncome)}</Text>
              </View>
              <View style={styles.forecastMetric}>
                <Text style={styles.metricLabel}>Contas previstas</Text>
                <Text style={[styles.metricValue, styles.expense]}>{formatCurrency(forecast.upcomingExpenses)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.sectionTitle}>Suas recorrências</Text>
          <Text style={styles.helper}>Cadastre aluguel, internet, faculdade, assinaturas ou salário. A previsão considera as ocorrências mensais dentro dos próximos 30 dias.</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nada programado ainda</Text>
            <Text style={styles.emptyText}>Adicione sua primeira conta ou entrada recorrente para descobrir quanto pode sobrar até o próximo mês.</Text>
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>{item.type === "income" ? "Entrada mensal" : "Conta mensal"} · Próxima data: {formatDate(item.nextDueDate)}{item.categoryName ? ` · ${item.categoryName}` : ""}</Text>
              </View>
              <Text style={[styles.itemAmount, item.type === "income" ? styles.income : styles.expense]}>{item.type === "income" ? "+" : "−"}{formatCurrency(item.amount)}</Text>
            </View>
            <View style={styles.actions}>
              <AnimatedPressable style={styles.smallButton} onPress={() => startEdit(item)}><Text style={styles.smallButtonText}>Editar</Text></AnimatedPressable>
              <AnimatedPressable style={styles.smallButton} onPress={() => confirmAdvance(item)}><Text style={styles.smallButtonText}>Já registrei</Text></AnimatedPressable>
              <AnimatedPressable style={styles.smallButton} onPress={() => confirmDelete(item)}><Text style={styles.dangerText}>Excluir</Text></AnimatedPressable>
            </View>
          </View>
        ))}

        {formVisible ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{editingId ? "Editar recorrência" : "Nova recorrência"}</Text>
            <Text style={styles.label}>Nome</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Internet, salário, faculdade" placeholderTextColor={colors.textSubtle} style={styles.input} maxLength={80} />
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.typeRow}>
              <AnimatedPressable style={[styles.typeButton, type === "expense" && styles.typeButtonSelected]} onPress={() => setType("expense")}><Text style={styles.typeText}>Conta a pagar</Text></AnimatedPressable>
              <AnimatedPressable style={[styles.typeButton, type === "income" && styles.typeButtonSelected]} onPress={() => setType("income")}><Text style={styles.typeText}>Entrada</Text></AnimatedPressable>
            </View>
            <Text style={styles.label}>Valor mensal (R$)</Text>
            <TextInput value={amount} onChangeText={setAmount} placeholder="Ex.: 150,00" placeholderTextColor={colors.textSubtle} keyboardType="decimal-pad" style={styles.input} />
            <Text style={styles.label}>Categoria (opcional)</Text>
            <View style={styles.chips}>
              <AnimatedPressable style={[styles.chip, categoryId === null && styles.chipSelected]} onPress={() => setCategoryId(null)}><Text style={styles.chipText}>Sem categoria</Text></AnimatedPressable>
              {categories.map((category) => (
                <AnimatedPressable key={category.id} style={[styles.chip, categoryId === category.id && styles.chipSelected]} onPress={() => setCategoryId(category.id)}><Text style={styles.chipText}>{category.name}</Text></AnimatedPressable>
              ))}
            </View>
            <Text style={styles.label}>Próxima data prevista</Text>
            <AnimatedPressable style={styles.dateButton} onPress={() => setDatePickerVisible(true)}><Text style={styles.dateText}>{formatDate(nextDueDate)}</Text></AnimatedPressable>
            {datePickerVisible && (
              <DateTimePicker value={parseDate(nextDueDate)} mode="date" display="default" onChange={(event, selectedDate) => { setDatePickerVisible(false); if (selectedDate) setNextDueDate(dateKey(selectedDate)); }} onDismiss={() => setDatePickerVisible(false)} />
            )}
            <Text style={styles.helper}>A recorrência é mensal. Ela não lança dinheiro automaticamente: registre a movimentação real na tela Transações e depois use “Já registrei” para avançar a data.</Text>
            <View style={styles.formActions}>
              <AnimatedPressable style={styles.cancelButton} onPress={resetForm} disabled={saving}><Text style={styles.cancelText}>Cancelar</Text></AnimatedPressable>
              <AnimatedPressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>{saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Salvar</Text>}</AnimatedPressable>
            </View>
          </View>
        ) : (
          <AnimatedPressable style={styles.primaryButton} onPress={startNew}><Text style={styles.primaryText}>+ Adicionar conta recorrente</Text></AnimatedPressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
