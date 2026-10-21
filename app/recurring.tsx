import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect } from "expo-router";

import { AppText as Text } from "../src/components/AppText";
import { AppCard } from "../src/components/AppCard";
import { AppButton } from "../src/components/AppButton";
import { AppField } from "../src/components/AppField";
import { AppSelector } from "../src/components/AppSelector";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { PremiumSheet } from "../src/components/PremiumSheet";
import { WalletSymbol } from "../src/components/WalletSymbol";
import { AnimatedListItem } from "../src/components/AnimatedListItem";
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
import { ThemeColors, useThemeColors, useThemedStyles, spacing, radii, typography } from "../src/theme";

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
    content: { padding: spacing["2xl"], paddingBottom: spacing["4xl"], gap: spacing["2xl"] },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    introCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    backButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    backText: { color: colors.text, fontWeight: "700", fontFamily: typography.family.bold },
    forecastCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radii.lg, gap: spacing.sm },
    forecastLabel: { color: colors.textMuted, fontSize: 13 },
    forecastValue: { color: colors.primary, fontSize: 32, lineHeight: 40, fontVariant: ["tabular-nums"], fontWeight: "700", fontFamily: typography.family.bold },
    forecastDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    forecastRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    forecastMetric: { flex: 1, minWidth: 110, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
    metricLabel: { color: colors.textMuted, fontSize: 11 },
    metricValue: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: typography.family.bold },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: typography.family.bold },
    helper: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    itemCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, borderRadius: radii.lg, gap: spacing.sm },
    itemHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing.sm },
    itemInfo: { flex: 1, minWidth: 110, gap: 4 },
    itemTitle: { color: colors.text, fontSize: 16, fontWeight: "700", fontFamily: typography.family.bold },
    itemMeta: { color: colors.textMuted, fontSize: 12 },
    itemAmount: { fontSize: 16, fontWeight: "700", fontFamily: typography.family.bold },
    income: { color: colors.income },
    expense: { color: colors.expense },
    actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: spacing.sm },
    smallButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    smallButtonText: { color: colors.text, fontSize: 12, fontWeight: "700", fontFamily: typography.family.bold },
    dangerText: { color: colors.expense, fontSize: 12, fontWeight: "700", fontFamily: typography.family.bold },
    formActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
    formAction: { flex: 1, minWidth: 120 },
    emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radii.lg, alignItems: "center", gap: spacing.sm },
    emptyTitle: { color: colors.text, fontWeight: "700", fontFamily: typography.family.bold, fontSize: 16 },
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
    <PremiumScreen ambient="subtle">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AnimatedPressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>← Voltar</Text></AnimatedPressable>
        </View>

        <ScreenHeader title="Recorrências" subtitle="Controle os compromissos futuros." eyebrow="Automação" />

        <AppCard style={styles.introCard}>
          <WalletSymbol name="transfer" color={colors.primary} size={24} />
          <View style={styles.itemInfo}>
            <Text variant="subtitle">Pagamentos previsíveis</Text>
            <Text tone="muted">Organize despesas e receitas que se repetem no tempo.</Text>
          </View>
        </AppCard>

        {forecast && (
          <AppCard style={styles.forecastCard}>
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
          </AppCard>
        )}

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.sectionTitle}>Próximos lançamentos</Text>
          <Text style={styles.helper}>Cadastre aluguel, internet, faculdade, assinaturas ou salário. A previsão considera as ocorrências mensais dentro dos próximos 30 dias.</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nada programado ainda</Text>
            <Text style={styles.emptyText}>Adicione sua primeira conta ou entrada recorrente para descobrir quanto pode sobrar até o próximo mês.</Text>
          </View>
        ) : items.map((item, index) => (
          <AnimatedListItem key={item.id} index={index}><AppCard style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <WalletSymbol name="recurring" color={item.type === "income" ? colors.income : colors.warning} size={22} />
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
          </AppCard></AnimatedListItem>
        ))}

        <AppButton label="Nova recorrência" onPress={startNew} leading={<WalletSymbol name="plus" color={colors.onPrimary} size={18} />} />
      </ScrollView>
      <PremiumSheet visible={formVisible} onClose={() => { if (!saving) resetForm(); }} title={editingId ? "Editar recorrência" : "Nova recorrência"}>
        <AppField label="Nome" value={title} onChangeText={setTitle} placeholder="Ex.: Internet, salário, faculdade" maxLength={80} editable={!saving} />
        <Text variant="label" tone="muted">Tipo</Text>
        <AppSelector options={[{ label: "Conta a pagar", value: "expense" }, { label: "Entrada", value: "income" }]} value={type} onChange={setType} accessibilityLabel="Tipo de recorrência" disabled={saving} />
        <AppField label="Valor mensal (R$)" value={amount} onChangeText={setAmount} placeholder="Ex.: 150,00" keyboardType="decimal-pad" editable={!saving} />
        <Text variant="label" tone="muted">Categoria (opcional)</Text>
        <AppSelector options={[{ label: "Sem categoria", value: -1 }, ...categories.map(category => ({ label: category.name, value: category.id }))]} value={categoryId ?? -1} onChange={value => setCategoryId(value === -1 ? null : value)} accessibilityLabel="Categoria da recorrência" disabled={saving} />
        <Text variant="label" tone="muted">Próxima data prevista</Text>
        <AppButton label={formatDate(nextDueDate)} variant="secondary" onPress={() => setDatePickerVisible(true)} disabled={saving} leading={<WalletSymbol name="recurring" color={colors.primary} size={20} />} accessibilityLabel={`Alterar próxima data prevista, ${formatDate(nextDueDate)}`} />
        {datePickerVisible && (
          <DateTimePicker value={parseDate(nextDueDate)} mode="date" display="default" onChange={(event, selectedDate) => { setDatePickerVisible(false); if (selectedDate) setNextDueDate(dateKey(selectedDate)); }} onDismiss={() => setDatePickerVisible(false)} />
        )}
        <Text style={styles.helper}>A recorrência é mensal. Ela não lança dinheiro automaticamente: registre a movimentação real na tela Transações e depois use “Já registrei” para avançar a data.</Text>
        <View style={styles.formActions}>
          <AppButton label="Cancelar" variant="secondary" onPress={resetForm} disabled={saving} style={styles.formAction} />
          <AppButton label="Salvar" onPress={() => void handleSave()} loading={saving} style={styles.formAction} />
        </View>
      </PremiumSheet>
    </PremiumScreen>
  );
}
