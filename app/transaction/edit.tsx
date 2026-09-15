import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput
} from "react-native";

import { AnimatedBlock } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { listAccounts } from "../../src/services/account.service";
import { listCategories } from "../../src/services/category.service";
import {
    editTransaction,
    listTransactions,
} from "../../src/services/transaction.service";
import { Account } from "../../src/types/account";
import { Category } from "../../src/types/category";
import { Transaction, TransactionType } from "../../src/types/transaction";

function parseMoney(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [transactions, categoriesData, accountsData] = await Promise.all([
          listTransactions(),
          listCategories(),
          listAccounts(),
        ]);
        const current = transactions.find((item) => item.id === transactionId);

        if (!current || current.type === "transfer" || current.goalId) {
          Alert.alert(
            "Edição indisponível",
            "Aportes de metas não podem ser editados.",
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
      await editTransaction(transaction.id, {
        amount: amountValue,
        type,
        description: description.trim() || null,
        categoryId,
        accountId,
      });
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
      <AnimatedBlock style={styles.center}>
        <Text>Carregando transação...</Text>
      </AnimatedBlock>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimatedPressable
        pressedScale={0.94}
        pressedOpacity={0.7}
        onPress={() => router.back()}
      >
        <Text style={styles.back}>← Voltar</Text>
      </AnimatedPressable>

      <AnimatedBlock delay={60}>
        <Text style={styles.title}>Editar transação</Text>

        <Text style={styles.subtitle}>
          Atualize o lançamento sem perder o saldo da conta.
        </Text>
      </AnimatedBlock>

      <AnimatedBlock delay={120} style={styles.typeSelector}>
        {(["expense", "income"] as TransactionType[]).map((item) => (
          <AnimatedPressable
            key={item}
            pressedScale={0.96}
            style={[
              styles.typeButton,
              type === item && styles.typeButtonActive,
            ]}
            onPress={() => setType(item)}
          >
            <Text
              style={[
                styles.typeButtonText,
                type === item && styles.typeButtonTextActive,
              ]}
            >
              {item === "expense" ? "Despesa" : "Receita"}
            </Text>
          </AnimatedPressable>
        ))}
      </AnimatedBlock>

      <Text style={styles.label}>Valor</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
        style={styles.input}
      />
      <Text style={styles.label}>Descrição</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Ex.: Almoço"
        style={styles.input}
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
      <Text style={styles.label}>Conta</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        {accounts.map((account) => (
          <AnimatedPressable
            key={account.id}
            pressedScale={0.94}
            style={[
              styles.option,
              accountId === account.id && styles.optionActive,
            ]}
            onPress={() => setAccountId(account.id)}
          >
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
        ))}
      </ScrollView>
      <AnimatedPressable
        pressedOpacity={0.85}
        style={[styles.saveButton, saving && styles.disabled]}
        disabled={saving}
        onPress={handleSave}
      >
        <Text style={styles.saveText}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Text>
      </AnimatedPressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
  },
  back: { color: "#174EA6", fontWeight: "700" },
  title: { marginTop: 28, fontSize: 30, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 8, color: "#6B7280" },
  typeSelector: {
    flexDirection: "row",
    marginTop: 28,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  typeButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  typeButtonActive: { backgroundColor: "#174EA6" },
  typeButtonText: { color: "#6B7280", fontWeight: "700" },
  typeButtonTextActive: { color: "#FFFFFF" },
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontWeight: "700",
    color: "#374151",
  },
  input: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
  },
  options: { gap: 8 },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  optionActive: { backgroundColor: "#174EA6" },
  optionText: { color: "#374151", fontWeight: "600" },
  optionTextActive: { color: "#FFFFFF", fontWeight: "700" },
  saveButton: {
    height: 56,
    marginTop: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#174EA6",
  },
  saveText: { color: "#FFFFFF", fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
