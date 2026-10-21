import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";
import { listAccounts } from "../services/account.service";
import { listCategories } from "../services/category.service";
import { notificationConfirmation } from "../services/notification-import.service";
import { createNotificationConfirmationDraft, normalizeNotificationConfirmation, notificationConfirmationDateTime, parseNotificationAmount,
  type NotificationConfirmationInput } from "../services/notification-confirmation-data";
import type { ReviewSummary } from "../services/notification-review.service";
import type { Account } from "../types/account";
import type { Category } from "../types/category";
import { useThemedStyles, type ThemeColors } from "../theme";

type Props = { localId: string; summary: ReviewSummary | null; postedAt?: number | null; pending: boolean; disabled: boolean;
  onConfirm(input: NotificationConfirmationInput, retry: boolean): Promise<void> };

export function NotificationConfirmationForm({ localId, summary, postedAt, pending, disabled, onConfirm }: Props) {
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = useState(() => createNotificationConfirmationDraft(summary, postedAt));
  const approvedDate = useRef<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const [nextAccounts, nextCategories, intent] = await Promise.all([
          listAccounts(), listCategories(), pending ? notificationConfirmation.pending(localId) : Promise.resolve(null),
        ]);
        if (!current) return;
        if (pending) {
          if (!intent) throw new Error("Intenção indisponível");
          const approved = normalizeNotificationConfirmation(JSON.parse(intent.requestJson));
          approvedDate.current = approved.date;
          setDraft({ ...approved, date: approved.date.slice(0, 10), time: approved.date.length > 10 ? approved.date.slice(11, 23) : "",
            amount: (approved.amountCents / 100).toFixed(2).replace(".", ","), description: approved.description ?? "" });
        }
        setAccounts(nextAccounts); setCategories(nextCategories);
      } catch {
        if (current) setError("Não foi possível consultar os dados seguros. Atualize antes de confirmar.");
      } finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [localId, pending, reload]);

  const blocked = disabled || submitting || loading;
  const editable = !blocked && !pending;
  const internal = draft.kind === "internal_transfer";
  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    if (editable) setDraft(current => ({ ...current, [key]: value }));
  }
  function requestConfirmation() {
    if (blocked || submittingRef.current || error) return;
    let input: NotificationConfirmationInput;
    try {
      input = normalizeNotificationConfirmation({ kind: draft.kind!, amountCents: parseNotificationAmount(draft.amount),
        accountId: draft.accountId!, toAccountId: internal ? draft.toAccountId : null,
        categoryId: internal ? null : draft.categoryId,
        date: pending ? approvedDate.current! : notificationConfirmationDateTime(draft.date, draft.time, postedAt), description: draft.description || null });
      const account = accounts.find(item => item.id === input.accountId);
      const destination = accounts.find(item => item.id === input.toAccountId);
      if (!pending && (!account || (internal && (!destination || account.type === "credit_card" || destination.type === "credit_card"))
        || (!internal && !categories.some(item => item.id === input.categoryId)))) {
        throw new Error("Selecione contas compatíveis e uma categoria válida.");
      }
    } catch (failure) {
      Alert.alert("Confira os dados", failure instanceof Error ? failure.message : "Preencha os campos obrigatórios.");
      return;
    }
    const origin = accounts.find(item => item.id === input.accountId)?.name ?? `Conta ${input.accountId}`;
    const destination = accounts.find(item => item.id === input.toAccountId)?.name ?? `Conta ${input.toAccountId}`;
    submittingRef.current = true; setSubmitting(true);
    function release() { submittingRef.current = false; if (mounted.current) setSubmitting(false); }
    const kind = internal ? "Transferência entre minhas contas" : input.kind === "income" ? "Receita" : "Despesa";
    Alert.alert(pending ? "Retomar confirmação?" : "Confirmar movimentação?",
      `${kind}\n${(input.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n${origin}${internal ? ` → ${destination}` : ""}\n${input.date}\n${pending ? "Se já houver registro, ele será reutilizado. Se ainda não houver, esta ação criará a movimentação com os dados aprovados." : "Esta ação registrará uma movimentação financeira real."}`, [
        { text: "Cancelar", style: "cancel", onPress: release },
        { text: pending ? "Retomar" : "Confirmar", onPress: () => { if (!mounted.current) { release(); return; } void onConfirm(input, pending).finally(release); } },
      ], { cancelable: false });
  }

  if (!notificationConfirmation.available) return <Text style={styles.notice}>Atualize a instalação Android para confirmar movimentações.</Text>;
  return <View style={styles.form}>
    <Text style={styles.title}>{pending ? "Confirmação pendente" : "Preparar movimentação"}</Text>
    <Text style={styles.notice}>{pending
      ? "O descarte está bloqueado. Os dados aprovados permanecem fixos para retomar com segurança. A recuperação nunca cria lançamentos sozinha."
      : "Confira e corrija os dados. Escolha a conta e a categoria. Uma transferência bancária só será interna se você selecionar essa opção."}</Text>
    {loading && <ActivityIndicator accessibilityLabel="Consultando contas e confirmação" />}
    {error && <><Text style={styles.notice}>{error}</Text><AnimatedPressable accessibilityRole="button" style={styles.option}
      disabled={blocked} onPress={() => { setLoading(true); setError(null); setReload(value => value + 1); }}><Text style={styles.text}>Atualizar dados</Text></AnimatedPressable></>}
    <Text style={styles.label}>Tipo *</Text>
    <View style={styles.options}>{([
      ["income", "Receita"], ["expense", "Despesa"], ["internal_transfer", "Entre minhas contas"],
    ] as const).map(([kind, label]) => <AnimatedPressable key={kind} accessibilityRole="radio"
      accessibilityState={{ checked: draft.kind === kind, disabled: !editable }} disabled={!editable}
      style={[styles.option, draft.kind === kind && styles.selected]} onPress={() => change("kind", kind)}><Text style={styles.text}>{label}</Text></AnimatedPressable>)}</View>
    <Text style={styles.label}>Valor (R$) *</Text>
    <TextInput accessibilityLabel="Valor da movimentação" style={styles.input} placeholderTextColor={styles.notice.color} editable={editable} keyboardType="decimal-pad"
      value={draft.amount} onChangeText={value => change("amount", value)} placeholder="0,00" />
    <Text style={styles.label}>Data (AAAA-MM-DD) *</Text>
    <TextInput accessibilityLabel="Data da movimentação" style={styles.input} placeholderTextColor={styles.notice.color} editable={editable}
      value={draft.date} maxLength={10} onChangeText={value => change("date", value)} placeholder="AAAA-MM-DD" />
    <Text style={styles.label}>Hora local (HH:mm:ss.SSS) *</Text>
    <TextInput accessibilityLabel="Hora da movimentação" style={styles.input} placeholderTextColor={styles.notice.color} editable={editable}
      value={draft.time} maxLength={12} onChangeText={value => change("time", value)} placeholder="HH:mm:ss.SSS" />
    {!pending && (!draft.date || !draft.time) && <Text style={styles.notice}>Sem timestamp válido. Informe a data e a hora da movimentação.</Text>}
    <Text style={styles.label}>Descrição</Text>
    <TextInput accessibilityLabel="Descrição da movimentação" style={styles.input} placeholderTextColor={styles.notice.color} editable={editable}
      value={draft.description} maxLength={160} onChangeText={value => change("description", value)} />
    <Text style={styles.label}>{internal ? "Conta de origem *" : "Conta *"}</Text>
    <View style={styles.options}>{accounts.filter(account => !internal || account.type !== "credit_card").map(account =>
      <AnimatedPressable key={account.id} accessibilityRole="radio" disabled={!editable}
        accessibilityState={{ checked: draft.accountId === account.id, disabled: !editable }}
        style={[styles.option, draft.accountId === account.id && styles.selected]} onPress={() => change("accountId", account.id)}>
        <Text style={styles.text}>{account.name}</Text></AnimatedPressable>)}</View>
    {!accounts.length && !loading && <Text style={styles.notice}>Cadastre uma conta financeira antes de confirmar.</Text>}
    {internal ? <><Text style={styles.label}>Conta de destino *</Text><View style={styles.options}>
      {accounts.filter(account => account.type !== "credit_card" && account.id !== draft.accountId).map(account =>
        <AnimatedPressable key={account.id} accessibilityRole="radio" disabled={!editable}
          accessibilityState={{ checked: draft.toAccountId === account.id, disabled: !editable }}
          style={[styles.option, draft.toAccountId === account.id && styles.selected]} onPress={() => change("toAccountId", account.id)}>
          <Text style={styles.text}>{account.name}</Text></AnimatedPressable>)}
    </View></> : <><Text style={styles.label}>Categoria *</Text><View style={styles.options}>{categories.map(category =>
      <AnimatedPressable key={category.id} accessibilityRole="radio" disabled={!editable}
        accessibilityState={{ checked: draft.categoryId === category.id, disabled: !editable }}
        style={[styles.option, draft.categoryId === category.id && styles.selected]} onPress={() => change("categoryId", category.id)}>
        <Text style={styles.text}>{category.name}</Text></AnimatedPressable>)}</View></>}
    <AnimatedPressable accessibilityRole="button" accessibilityState={{ disabled: blocked || !!error, busy: submitting }} disabled={blocked || !!error} style={[styles.confirm, (blocked || !!error) && styles.disabled]}
      onPress={requestConfirmation}><Text style={styles.confirmText}>{pending ? "Retomar confirmação" : "Confirmar movimentação"}</Text></AnimatedPressable>
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  form: { marginTop: 24, gap: 16 }, title: { color: colors.text, fontSize: 18, fontFamily: "Inter-Bold", fontWeight: "700" },
  notice: { color: colors.textMuted, fontSize: 13, lineHeight: 20, fontFamily: "Inter-Regular" },
  label: { color: colors.textMuted, fontSize: 11, fontFamily: "Inter-Bold", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8 },
  input: { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 21, paddingHorizontal: 20, paddingVertical: 12, minHeight: 55, fontSize: 14, fontFamily: "Inter-Regular" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  selected: { borderColor: colors.primary, backgroundColor: colors.accentSurface }, text: { color: colors.text, fontSize: 14, fontFamily: "Inter-Regular" },
  confirm: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 52, justifyContent: "center", padding: 16, alignItems: "center", marginTop: 8 },
  confirmText: { color: colors.onPrimary, fontFamily: "Inter-Bold", fontWeight: "700", fontSize: 14 }, disabled: { opacity: 0.5 },
});
