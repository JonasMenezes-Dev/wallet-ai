import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { listAccounts } from "../src/services/account.service";
import { listCategories } from "../src/services/category.service";
import { addTransaction } from "../src/services/transaction.service";
import {
  dismissCapturedNotification, hasNotificationAccess, isNotificationListenerAvailable,
  listCapturedNotifications, openNotificationAccessSettings, parseFinancialNotification,
  type CapturedFinancialNotification,
} from "../src/services/notification-import.service";
import type { Account } from "../src/types/account";
import type { Category } from "../src/types/category";
import { useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

const currency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NotificationImportScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [available, setAvailable] = useState(isNotificationListenerAvailable());
  const [permission, setPermission] = useState(false);
  const [items, setItems] = useState<CapturedFinancialNotification[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountByKey, setAccountByKey] = useState<Record<string, number>>({});
  const [categoryByKey, setCategoryByKey] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setAvailable(isNotificationListenerAvailable());
    if (isNotificationListenerAvailable()) {
      setPermission(hasNotificationAccess());
      setItems(listCapturedNotifications());
    }
    try {
      const [nextAccounts, nextCategories] = await Promise.all([listAccounts(), listCategories()]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setAccountByKey((current) => Object.keys(current).length ? current : Object.fromEntries(nextAccounts[0] ? [["default", nextAccounts[0].id]] : []));
      setCategoryByKey((current) => Object.keys(current).length ? current : Object.fromEntries(nextCategories[0] ? [["default", nextCategories[0].id]] : []));
    } catch (error) { console.error("Erro ao carregar dados da importação:", error); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function importItem(item: CapturedFinancialNotification) {
    const parsed = parseFinancialNotification(item);
    if (!parsed.amount) {
      Alert.alert("Valor não identificado", "A notificação não contém um valor único e seguro. Ela pode mostrar o valor da compra e também o saldo; registre manualmente para evitar um saldo incorreto.");
      return;
    }
    const accountId = accountByKey[item.key] ?? accountByKey.default ?? accounts[0]?.id;
    if (!accountId) {
      Alert.alert("Conta necessária", "Cadastre uma conta ou cartão antes de importar a movimentação.");
      return;
    }
    const categoryId = categoryByKey[item.key] ?? categoryByKey.default ?? categories[0]?.id ?? null;
    const institution = item.packageName;
    try {
      setSavingKey(item.key);
      await addTransaction({
        amount: parsed.amount,
        type: parsed.type,
        description: parsed.description,
        merchant: null,
        date: new Date(item.postedAt || Date.now()).toISOString(),
        categoryId,
        accountId,
        paymentMethod: null,
        goalId: null,
        isAutomatic: true,
        source: "notification",
        externalId: item.key,
        provider: "android_notification_listener",
        institution,
      });
      dismissCapturedNotification(item.key);
      await reload();
      Alert.alert("Movimentação importada", "Confira os dados na tela Transações.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível importar.";
      Alert.alert(message.toLowerCase().includes("já foi registrada") ? "Já importada" : "Erro ao importar", message);
    } finally { setSavingKey(null); }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹  Voltar</Text></AnimatedPressable>
        <ScreenHeader title="Importar notificações" subtitle="Transforme avisos bancários em lançamentos revisados por você." eyebrow="Registro sem digitação" />
        <View style={styles.privacyCard}>
          <Text style={styles.cardTitle}>Privacidade primeiro</Text>
          <Text style={styles.body}>O Wallet filtra localmente notificações de aplicativos bancários compatíveis. O conteúdo não é enviado para um servidor. Revise o valor e a conta antes de importar.</Text>
        </View>
        {!available ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>É necessário um APK próprio</Text>
            <Text style={styles.body}>A leitura usa um serviço nativo do Android e não funciona no Expo Go nem na versão web. Gere um novo APK após instalar as alterações desta branch.</Text>
          </View>
        ) : !permission ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ative o acesso às notificações</Text>
            <Text style={styles.body}>O Android abrirá as configurações do sistema. Ative apenas se concordar com o acesso descrito acima. Depois volte para esta tela.</Text>
            <AnimatedPressable style={styles.primaryButton} onPress={() => { try { openNotificationAccessSettings(); } catch (error) { Alert.alert("Não foi possível abrir", error instanceof Error ? error.message : "Tente novamente."); } }}><Text style={styles.primaryText}>Abrir configurações do Android</Text></AnimatedPressable>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}><Text style={styles.statusTitle}>Acesso ativado</Text><Text style={styles.body}>Encontradas {items.length} notificações financeiras aguardando revisão.</Text></View>
            {items.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Nenhuma notificação capturada</Text><Text style={styles.body}>Faça uma compra ou Pix de teste em um banco compatível e volte aqui. Alguns bancos não incluem o valor na notificação.</Text></View> :
              items.map((item) => {
                const parsed = parseFinancialNotification(item);
                return (
                  <View key={item.key} style={styles.card}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.text}</Text>
                    <Text style={[styles.amount, parsed.type === "income" ? styles.income : styles.expense]}>{parsed.amount ? currency(parsed.amount) : "Valor não identificado"}</Text>
                    <Text style={styles.body}>Tipo sugerido: {parsed.type === "income" ? "Entrada" : "Despesa"} · {parsed.confidence === "high" ? "valor reconhecido" : "revisão necessária"}</Text>
                    <Text style={styles.fieldLabel}>Conta/cartão</Text>
                    <View style={styles.chips}>{accounts.map((account) => <AnimatedPressable key={account.id} style={[styles.chip, (accountByKey[item.key] ?? accountByKey.default ?? accounts[0]?.id) === account.id && styles.chipSelected]} onPress={() => setAccountByKey((current) => ({ ...current, [item.key]: account.id }))}><Text style={styles.chipText}>{account.name}</Text></AnimatedPressable>)}</View>
                    <Text style={styles.fieldLabel}>Categoria</Text>
                    <View style={styles.chips}>{categories.map((category) => <AnimatedPressable key={category.id} style={[styles.chip, (categoryByKey[item.key] ?? categoryByKey.default ?? categories[0]?.id) === category.id && styles.chipSelected]} onPress={() => setCategoryByKey((current) => ({ ...current, [item.key]: category.id }))}><Text style={styles.chipText}>{category.name}</Text></AnimatedPressable>)}</View>
                    <View style={styles.actions}>
                      <AnimatedPressable style={styles.secondaryButton} onPress={() => { dismissCapturedNotification(item.key); void reload(); }}><Text style={styles.secondaryText}>Descartar</Text></AnimatedPressable>
                      <AnimatedPressable style={styles.primaryButton} disabled={savingKey === item.key} onPress={() => void importItem(item)}><Text style={styles.primaryText}>{savingKey === item.key ? "Importando..." : "Confirmar lançamento"}</Text></AnimatedPressable>
                    </View>
                  </View>
                );
              })}
            <AnimatedPressable style={styles.secondaryButton} onPress={() => { setPermission(hasNotificationAccess()); setItems(listCapturedNotifications()); }}><Text style={styles.secondaryText}>Atualizar notificações</Text></AnimatedPressable>
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
  privacyCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.accentSurface, gap: spacing.xs },
  card: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  statusCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statusTitle: { color: colors.income, fontSize: 15, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  amount: { fontSize: 22, fontWeight: "800" },
  income: { color: colors.income },
  expense: { color: colors.expense },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSurface },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", flexWrap: "wrap" },
  primaryButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center" },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  secondaryButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center" },
  secondaryText: { color: colors.text, fontWeight: "700" },
});
