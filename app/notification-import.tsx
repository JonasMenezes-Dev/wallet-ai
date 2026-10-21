import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { AppText as Text } from "../src/components/AppText";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { WalletSymbol } from "../src/components/WalletSymbol";
import { NotificationConfirmationForm } from "../src/components/NotificationConfirmationForm";
import { notificationReview, notificationConfirmation } from "../src/services/notification-import.service";
import type { NotificationConfirmationInput } from "../src/services/notification-confirmation-data";
import { NotificationReviewBusyError, type ReviewItem, type ReviewDetail, type ReviewSummary } from "../src/services/notification-review.service";
import { useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

function operationLabel(summary: ReviewSummary | null) {
  if (!summary?.operation) return "Tipo não identificado";
  if (summary.operation === "pix") return summary.direction === "incoming" ? "Pix recebido"
    : summary.direction === "outgoing" ? "Pix enviado" : "Pix · direção não identificada";
  return { debit_purchase: "Compra no débito", credit_purchase: "Compra no crédito",
    transfer: "Transferência", own_account_transfer: "Entre contas próprias",
    payment: "Pagamento", receipt: "Recebimento" }[summary.operation];
}

function eventDate(item: ReviewItem) {
  const date = item.summary?.date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.split("-").reverse().join("/") + (item.summary?.time ? " " + item.summary.time : "");
  }
  const parsed = date ? new Date(date) : item.postedAt === null ? null : new Date(item.postedAt);
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("pt-BR") : "Data não identificada";
}

function reviewNotice(summary: ReviewSummary | null) {
  if (summary?.reason === "ambiguous_content") return "Conteúdo ambíguo. Nenhum valor foi escolhido.";
  if (summary?.reason === "truncated_content") return "Texto incompleto. Tipo e valor precisam de conferência.";
  if (summary?.reason === "content_unavailable") return "O conteúdo original não está mais disponível.";
  if (summary?.status === "ignored") return "A mensagem não confirma uma movimentação financeira.";
  if (summary?.status === "recognized") return "Dados identificados para conferência. Nenhum lançamento foi criado.";
  return "Dados incompletos ou ambíguos. Confira a notificação antes de qualquer lançamento.";
}

export default function NotificationImportScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [busy, setBusy] = useState(notificationReview.available);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const ticket = useRef(0);
  const gate = useRef<number | null>(null);
  const nextOffset = useRef(0);
  const visible = useRef(false);

  const clearSensitive = useCallback(() => {
    ticket.current++;
    gate.current = null;
    nextOffset.current = 0;
    setItems([]);
    setDetail(null);
    setBusy(false);
    setError(null);
    setHasMore(false);
  }, []);

  const load = useCallback(async (append = false) => {
    if (!visible.current || gate.current !== null || !notificationReview.available) return;
    const id = ++ticket.current;
    gate.current = id;
    setBusy(true);
    setError(null);
    setDetail(null);
    const offset = append ? nextOffset.current : 0;
    try {
      if (notificationConfirmation.available) await notificationConfirmation.reconcile();
      if (id !== ticket.current) return;
      const result = await notificationReview.list(offset, () => id === ticket.current && AppState.currentState === "active");
      if (id !== ticket.current) return;
      setItems((current) => append
        ? [...new Map([...current, ...result.items].map((item) => [item.localId, item])).values()] : result.items);
      nextOffset.current = offset + result.items.length;
      setHasMore(result.hasMore);
    } catch {
      if (id === ticket.current) { setItems([]); setError("Não foi possível consultar a fila segura. Tente novamente."); }
    } finally {
      if (gate.current === id) gate.current = null;
      if (id === ticket.current) setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    visible.current = true;
    void load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
      else clearSensitive();
    });
    return () => { visible.current = false; subscription.remove(); clearSensitive(); };
  }, [load, clearSensitive]));

  async function openEvent(item: ReviewItem) {
    if (!visible.current || gate.current !== null) return;
    const id = ++ticket.current;
    gate.current = id;
    setBusy(true);
    setError(null);
    try {
      const next = item.confirmationPending ? { ...item, title: null, text: null } : await notificationReview.detail(item.localId);
      if (id === ticket.current) setDetail(next);
    } catch (failure) {
      if (id === ticket.current) {
        setDetail(null);
        setError(failure instanceof NotificationReviewBusyError
          ? "Evento reservado ou indisponível. Atualize a lista e tente novamente."
          : "Não foi possível consultar esta notificação. Ela não foi apagada.");
      }
    } finally {
      if (gate.current === id) gate.current = null;
      if (id === ticket.current) setBusy(false);
    }
  }

  async function confirmMovement(input: NotificationConfirmationInput, retry: boolean): Promise<void> {
    if (!detail || !visible.current || AppState.currentState !== "active" || gate.current !== null) return;
    const localId = detail.localId;
    const id = ++ticket.current;
    gate.current = id; setBusy(true); setError(null);
    let saved = false;
    try {
      if (retry) await notificationConfirmation.retry(localId);
      else await notificationConfirmation.confirm(localId, input);
      saved = true;
      if (id === ticket.current) setDetail(null);
    } catch (failure) {
      let uncertain = true;
      try { uncertain = (await notificationConfirmation.pending(localId)) !== null; } catch { /* Remain fail-closed. */ }
      if (id === ticket.current) {
        setDetail(current => current && current.localId === localId ? { ...current, confirmationPending: uncertain } : current);
        setItems(current => current.map(item => item.localId === localId ? { ...item, confirmationPending: uncertain } : item));
        setError(failure instanceof Error && /conflito/i.test(failure.message)
          ? "Conflito de confirmação. Os dados anteriores foram preservados; nenhum comprovante foi substituído."
          : uncertain ? "Confirmação sem conclusão. O descarte está bloqueado. Retome com os mesmos dados para verificar ou concluir sem duplicação."
            : "Não foi possível iniciar a confirmação. Atualize a fila e tente novamente.");
      }
    } finally {
      if (gate.current === id) gate.current = null;
      if (id === ticket.current) setBusy(false);
    }
    if (saved && id === ticket.current) await load();
  }

  async function discardEvent(localId: string) {
    if (!visible.current || AppState.currentState !== "active" || gate.current !== null) return;
    const id = ++ticket.current;
    gate.current = id;
    setBusy(true);
    setError(null);
    try {
      await notificationReview.discard(localId);
      if (id !== ticket.current) return;
      setDetail(null);
      setItems((current) => current.filter((item) => item.localId !== localId));
      nextOffset.current = Math.max(0, nextOffset.current - 1);
    } catch {
      if (id === ticket.current) setError("Descarte não confirmado. Atualize a lista antes de tentar novamente.");
    } finally {
      if (gate.current === id) gate.current = null;
      if (id === ticket.current) setBusy(false);
    }
  }

  function confirmDiscard(item: ReviewItem) {
    Alert.alert("Descartar notificação?", "O evento sairá da revisão. Isso não cria nem altera lançamentos financeiros.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => void discardEvent(item.localId) },
    ]);
  }

  function eventSummary(item: ReviewItem) {
    const cents = item.summary?.amountCents;
    return <>
      <Text style={styles.cardTitle}>{operationLabel(item.summary)}</Text>
      <Text style={[styles.amount, item.summary?.direction === "incoming" ? styles.income : styles.expense]}>
        {cents == null ? "Valor não identificado" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </Text>
      <Text style={styles.body}>Origem: {item.source}</Text>
      <Text style={styles.body}>{eventDate(item)}</Text>
      <Text style={styles.body}>{item.readError ? "Conteúdo indisponível. Você pode tentar consultar novamente ou descartar." : reviewNotice(item.summary)}</Text>
      {item.busy && <Text style={styles.body}>Este evento está reservado para revisão. Atualize em instantes.</Text>}
    </>;
  }

  return (
    <PremiumScreen ambient="subtle">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <AnimatedPressable style={styles.backButton} disabled={busy} accessibilityRole="button"
          onPress={() => detail ? setDetail(null) : router.back()}>
          <Text style={styles.backText}>{detail ? "‹  Voltar à lista" : "‹  Voltar"}</Text>
        </AnimatedPressable>
        <ScreenHeader title="Central de revisão" subtitle="Confirme antes de registrar." eyebrow="Captura inteligente" />
        <AppCard padded={false} style={styles.privacyCard}>
          <View style={styles.securityTitle}>
            <WalletSymbol name="success" size={22} color={colors.primary} />
            <Text style={styles.cardTitle}>Você tem o controle</Text>
          </View>
          <Text style={styles.body}>A fila permanece criptografada. A revisão dos eventos já capturados continua disponível com a captura desativada.</Text>
          <Text style={styles.body}>Cada movimentação exige sua confirmação explícita.</Text>
        </AppCard>
        {!notificationReview.available ? <View style={styles.card}>
          <Text style={styles.cardTitle}>Revisão indisponível</Text>
          <Text style={styles.body}>Este recurso requer uma instalação Android compatível e atualizada do Wallet AI.</Text>
        </View> : <>
          {busy && <View accessibilityRole="progressbar" accessibilityLabel="Consultando fila segura"><ActivityIndicator color={colors.primary} /></View>}
          {error && <View style={styles.card} accessibilityLiveRegion="polite">
            <Text style={styles.cardTitle}>Não foi possível concluir</Text><Text style={styles.body}>{error}</Text>
            <AppButton disabled={busy} variant="secondary" onPress={() => void load()} label="Atualizar fila" />
          </View>}
          {detail ? <View style={styles.card}>
            {eventSummary(detail)}
            {!detail.confirmationPending && <><Text style={styles.fieldLabel}>Notificação original</Text>
            <Text style={styles.cardTitle}>{detail.title ?? "Título indisponível"}</Text>
            <Text style={styles.body}>{detail.text ?? "Texto original indisponível ou expirado. Os dados já interpretados foram preservados."}</Text>
            </>}
            <NotificationConfirmationForm key={`${detail.localId}:${detail.confirmationPending === true}`} localId={detail.localId} summary={detail.summary} postedAt={detail.postedAt}
              pending={detail.confirmationPending === true} disabled={busy} onConfirm={confirmMovement} />
            <AppButton disabled={busy || detail.confirmationPending} variant="secondary"
              onPress={() => confirmDiscard(detail)} label="Descartar notificação" />
          </View> : <>
            {!busy && !error && items.length === 0 && <View style={styles.card}><Text style={styles.cardTitle}>Nenhuma notificação pendente</Text><Text style={styles.body}>As próximas notificações autorizadas aparecerão aqui após a captura.</Text></View>}
            {items.length > 0 && <Text variant="label" tone="muted">Pendentes · {items.length}</Text>}
            {items.map((item) => <View key={item.localId} style={styles.card}>
              {eventSummary(item)}
              <View style={styles.actions}>
                <AppButton disabled={busy || item.busy || item.confirmationPending} variant="secondary" accessibilityLabel="Descartar notificação"
                  onPress={() => confirmDiscard(item)} label="Descartar" />
                <AppButton disabled={busy || item.busy} accessibilityLabel="Revisar notificação"
                  onPress={() => void openEvent(item)} label={item.confirmationPending ? "Ver confirmação pendente" : "Revisar dados"} />
              </View>
            </View>)}
            {hasMore && <AppButton disabled={busy} variant="secondary" onPress={() => void load(true)} label="Carregar mais" />}
            <AppButton disabled={busy} variant="secondary" onPress={() => void load()} label="Atualizar notificações" />
          </>}
        </>}
      </ScrollView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing["2xl"], paddingBottom: spacing["4xl"], gap: spacing.lg },
  backButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  backText: { color: colors.text, fontWeight: "700" },
  privacyCard: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.accentSurface, gap: spacing.sm },
  securityTitle: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  card: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  statusCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: "Inter-Bold" },
  statusTitle: { color: colors.income, fontSize: 15, fontWeight: "800" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  summaryPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.md, backgroundColor: colors.surface },
  summaryReady: { color: colors.income, fontSize: 12, fontWeight: "700" },
  summaryReview: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  amount: { fontSize: 24, lineHeight: 32, fontWeight: "700", fontFamily: "Inter-Bold", fontVariant: ["tabular-nums"] },
  income: { color: colors.income },
  expense: { color: colors.expense },
  fieldLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginTop: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.accentSurface },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", flexWrap: "wrap" },
  primaryButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center" },
  disabledButton: { opacity: 0.45 },
  primaryText: { color: colors.onPrimary, fontWeight: "800" },
  secondaryButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center" },
  secondaryText: { color: colors.text, fontWeight: "700" },
});
