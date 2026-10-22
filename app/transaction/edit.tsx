import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { AnimatedBlock } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { AppText as Text } from "../../src/components/AppText";
import { AppField } from "../../src/components/AppField";
import { AppButton } from "../../src/components/AppButton";
import { AppSelector } from "../../src/components/AppSelector";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { WalletSymbol } from "../../src/components/WalletSymbol";
import { listAccounts } from "../../src/services/account.service";
import { listCategories } from "../../src/services/category.service";
import {
    editTransaction,
    listTransactions,
} from "../../src/services/transaction.service";
import { editGoalMovement } from "../../src/services/goal.service";
import { Account } from "../../src/types/account";
import { Category } from "../../src/types/category";
import { Transaction, TransactionType } from "../../src/types/transaction";
import { ThemeColors, useThemedStyles, useThemeColors } from "../../src/theme";

function parseMoney(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

/** Converte `YYYY-MM-DD`/ISO para um `Date` local, sem passar por UTC. */
function parseDate(value: string): Date {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactionId = Number(id);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();

  useEffect(() => {
    async function load() {
      try {
        const [transactions, categoriesData, accountsData] = await Promise.all([
          listTransactions(),
          listCategories(),
          listAccounts(),
        ]);
        const current = transactions.find((item) => item.id === transactionId);

        if (!current || current.transferId || (current.type === "transfer" && !current.goalId)) {
          Alert.alert(
            "Edição indisponível",
            "Esta transferência não pode ser editada individualmente.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        setTransaction(current);
        setType(current.type);
        setAmount(current.amount.toFixed(2).replace(".", ","));
        setDescription(current.description ?? "");
        setCategories(categoriesData);
        setAccounts(accountsData);
        setCategoryId(current.categoryId);
        setAccountId(current.accountId);
        setDate(parseDate(current.date));
      } catch (error) {
        console.error("Erro ao carregar transação:", error);
        Alert.alert("Erro", "Não foi possível carregar a transação.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    }

    load();
  }, [transactionId]);

  async function handleSave() {
    const amountValue = parseMoney(amount);

    if (!transaction || !amountValue || amountValue <= 0 || !accountId) {
      Alert.alert("Dados inválidos", "Informe um valor e uma conta válidos.");
      return;
    }

    try {
      setSaving(true);
      if (transaction.goalId) {
        await editGoalMovement(transaction.id, accountId, amountValue);
      } else {
      await editTransaction(transaction.id, {
        amount: amountValue,
        type,
        description: description.trim() || null,
        categoryId,
        accountId,
        date: date.toISOString(),
      });
      }
      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível editar a transação.";
      Alert.alert("Erro", message);
    } finally {
      setSaving(false);
    }
  }

  if (!transaction) {
    return (
      <PremiumScreen ambient="subtle"><AnimatedBlock style={styles.center}>
        <Text>Carregando transação...</Text>
      </AnimatedBlock></PremiumScreen>
    );
  }

  return (
    <PremiumScreen ambient="subtle">
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={24}
    >
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <AnimatedPressable
        pressedScale={0.94}
        pressedOpacity={0.7}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text style={styles.back}>← Voltar</Text>
      </AnimatedPressable>

      <AnimatedBlock delay={60}>
        <ScreenHeader
          title="Editar transação"
          subtitle="Atualize o lançamento sem perder o saldo da conta."
          eyebrow="Movimentação"
        />
      </AnimatedBlock>

      {!transaction.goalId && <AnimatedBlock delay={120} style={styles.typeSelector}>
        <AppSelector<TransactionType> accessibilityLabel="Tipo de movimentação" value={type} onChange={setType}
          options={[{ value: "expense", label: "Despesa" }, { value: "income", label: transaction.isRefund ? "Estorno" : "Receita" }]} />
      </AnimatedBlock>}

      <AppField label="Valor" containerStyle={styles.field}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
        style={styles.amountInput}
      />
      {!transaction.goalId && <>
      <Text style={styles.label}>Data</Text>
      <AnimatedPressable
        pressedScale={0.98}
        pressedOpacity={0.8}
        style={styles.input}
        accessibilityRole="button"
        accessibilityLabel="Alterar data da transação"
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
      </AnimatedPressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, selected) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selected) {
              setDate((current) => {
                const updated = new Date(current);
                updated.setFullYear(
                  selected.getFullYear(),
                  selected.getMonth(),
                  selected.getDate(),
                );
                return updated;
              });
            }
          }}
        />
      )}

      <Text style={styles.label}>Horário</Text>
      <AnimatedPressable
        pressedScale={0.98}
        pressedOpacity={0.8}
        style={styles.input}
        accessibilityRole="button"
        accessibilityLabel="Alterar horário da transação"
        onPress={() => setShowTimePicker(true)}
      >
        <Text style={styles.dateValue}>{formatTimeLabel(date)}</Text>
      </AnimatedPressable>

      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          is24Hour
          onChange={(_event, selected) => {
            setShowTimePicker(Platform.OS === "ios");
            if (selected) {
              setDate((current) => {
                const updated = new Date(current);
                updated.setHours(
                  selected.getHours(),
                  selected.getMinutes(),
                  0,
                  0,
                );
                return updated;
              });
            }
          }}
        />
      )}

      <AppField label="Descrição" containerStyle={styles.field}
        value={description}
        onChangeText={setDescription}
        placeholder="Ex.: Almoço"
      />
      <Text style={styles.label}>Categoria</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {categories.map((category) => (
          <AnimatedPressable
            key={category.id}
            pressedScale={0.94}
            accessibilityRole="radio"
            accessibilityState={{ checked: categoryId === category.id }}
            style={[
              styles.option,
              categoryId === category.id && styles.optionActive,
            ]}
            onPress={() => setCategoryId(category.id)}
          >
            <Text
              style={
                categoryId === category.id
                  ? styles.optionTextActive
                  : styles.optionText
              }
            >
              {category.name}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
      </>}
      <Text style={styles.label}>{transaction.goalId ? "Conta da movimentação" : "Conta ou cartão"}</Text>
      {!transaction.goalId && <Text style={styles.helper}>
        Escolher um cartão lança o gasto no limite dele (aumenta o utilizado,
        reduz o disponível). Contas comuns movimentam o saldo.
      </Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {accounts.filter(account => !transaction.goalId || account.type !== "credit_card").map((account) => {
          const isCard = account.type === "credit_card";

          return (
            <AnimatedPressable
              key={account.id}
              pressedScale={0.94}
              accessibilityRole="radio"
              accessibilityState={{ checked: accountId === account.id }}
              style={[
                styles.option,
                accountId === account.id && styles.optionActive,
              ]}
              onPress={() => setAccountId(account.id)}
            >
              {isCard && <WalletSymbol name="card" size={18} color={accountId === account.id ? colors.onPrimary : colors.textMuted} />}
              <Text
                style={
                  accountId === account.id
                    ? styles.optionTextActive
                    : styles.optionText
                }
              >
                {account.name}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
      <AppButton style={styles.saveButton} disabled={saving} loading={saving}
        onPress={handleSave} label={saving ? "Salvando..." : "Salvar alterações"} />
    </ScrollView>
    </KeyboardAvoidingView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 28, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { color: colors.primary, fontWeight: "700" },
  title: { marginTop: 28, fontSize: 30, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 8, color: colors.textMuted },
  typeSelector: {
    flexDirection: "row",
    marginTop: 24,
  },
  typeButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  typeButtonActive: { backgroundColor: colors.primary },
  typeButtonText: { color: colors.textMuted, fontWeight: "700" },
  typeButtonTextActive: { color: colors.onPrimary },
  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
    color: colors.textMuted,
  },
  field: { marginTop: 24 },
  amountInput: { minHeight: 78, fontSize: 30, fontFamily: "Inter-Bold", fontVariant: ["tabular-nums"] },
  input: {
    minHeight: 55,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  dateValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
  },
  helper: {
    marginTop: -4,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  options: { gap: 8 },
  option: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  optionActive: { backgroundColor: colors.primary },
  optionText: { color: colors.text, fontWeight: "600" },
  optionTextActive: { color: colors.onPrimary, fontWeight: "700" },
  saveButton: {
    minHeight: 52,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  saveText: { color: colors.onPrimary, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
