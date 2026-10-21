import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { emptyTransactionFilters, type TransactionFilters } from "../types/transaction-filters";
import type { Account } from "../types/account";
import type { Category } from "../types/category";
import { spacing } from "../theme";
import { AppButton } from "./AppButton";
import { AppField } from "./AppField";
import { AppSelector } from "./AppSelector";
import { AppText } from "./AppText";
import { PremiumSheet } from "./PremiumSheet";

type Props = { visible: boolean; filters: TransactionFilters; accounts: readonly Account[]; categories: readonly Category[]; onApply: (filters: TransactionFilters) => void; onClose: () => void };

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function TransactionFilterPanel({ visible, filters, accounts, categories, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<TransactionFilters>(() => ({ ...filters }));
  const [dateError, setDateError] = useState("");
  const [session, setSession] = useState({ visible, filters });
  if (session.visible !== visible || session.filters !== filters) {
    setSession({ visible, filters });
    if (visible) { setDraft({ ...filters }); setDateError(""); }
  }
  const update = (patch: Partial<TransactionFilters>) => setDraft(current => ({ ...current, ...patch }));
  function apply() {
    if (draft.period === "custom" && [draft.from, draft.to].some(date => date && !isDateKey(date))) {
      setDateError("Informe uma data válida no formato AAAA-MM-DD.");
      return;
    }
    onApply({ ...draft });
    onClose();
  }
  const options = (rows: readonly { id: number; name: string }[], all: string) => [{ label: all, value: "all" as string | number }, ...rows.map(row => ({ label: row.name, value: row.id }))];
  return (
    <PremiumSheet visible={visible} onClose={onClose} title="Filtros de transações" footer={
      <View style={styles.actions}>
        <AppButton label="Limpar filtros" variant="ghost" onPress={() => { setDraft({ ...emptyTransactionFilters }); setDateError(""); }} />
        <AppButton label="Aplicar filtros" onPress={apply} />
      </View>
    }>
      <AppText tone="muted">Combine os filtros para encontrar suas movimentações.</AppText>
      <AppText variant="label" tone="muted">Tipo de transação</AppText>
      <AppSelector accessibilityLabel="Tipo de transação" value={draft.type} onChange={type => update({ type })} options={[{ label: "Todas", value: "all" }, { label: "Entradas", value: "income" }, { label: "Despesas", value: "expense" }, { label: "Transferências", value: "transfer" }]} />
      <AppText variant="label" tone="muted">Período</AppText>
      <AppSelector accessibilityLabel="Período" value={draft.period} onChange={period => update({ period })} options={[{ label: "Qualquer período", value: "all" }, { label: "Este mês", value: "month" }, { label: "Últimos 30 dias", value: "last30" }, { label: "Últimos 90 dias", value: "last90" }, { label: "Personalizado", value: "custom" }]} />
      {draft.period === "custom" ? <>
        <AppField label="Data inicial" value={draft.from ?? ""} placeholder="AAAA-MM-DD" autoCorrect={false} maxLength={10} onChangeText={from => update({ from: from || null })} error={dateError || undefined} />
        <AppField label="Data final" value={draft.to ?? ""} placeholder="AAAA-MM-DD" autoCorrect={false} maxLength={10} onChangeText={to => update({ to: to || null })} />
      </> : null}
      <AppText variant="label" tone="muted">Categoria</AppText>
      <AppSelector accessibilityLabel="Categoria" value={draft.categoryId ?? "all"} onChange={value => update({ categoryId: value === "all" ? null : Number(value) })} options={options(categories, "Todas as categorias")} />
      <AppText variant="label" tone="muted">Conta</AppText>
      <AppSelector accessibilityLabel="Conta" value={draft.accountId ?? "all"} onChange={value => update({ accountId: value === "all" ? null : Number(value) })} options={options(accounts.filter(a => a.type !== "credit_card"), "Todas as contas")} />
      {accounts.some(a => a.type === "credit_card") ? <>
        <AppText variant="label" tone="muted">Cartão</AppText>
        <AppSelector accessibilityLabel="Cartão" value={draft.cardId ?? "all"} onChange={value => update({ cardId: value === "all" ? null : Number(value) })} options={options(accounts.filter(a => a.type === "credit_card"), "Todos os cartões")} />
      </> : null}
      <AppText variant="label" tone="muted">Origem</AppText>
      <AppSelector accessibilityLabel="Origem" value={draft.origin} onChange={origin => update({ origin })} options={[{ label: "Qualquer origem", value: "all" }, { label: "Manual", value: "manual" }, { label: "Automático", value: "automatic" }]} />
    </PremiumSheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.sm } });
