import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { AppText as Text } from "../src/components/AppText";
import { AppField } from "../src/components/AppField";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppSelector } from "../src/components/AppSelector";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { WalletSymbol } from "../src/components/WalletSymbol";
import { listAccounts } from "../src/services/account.service";
import { listCategories } from "../src/services/category.service";
import { inspectCsv, parseCsv, parseOfx, normalizeStatementDate, parseStatementAmount } from "../src/services/statement-parsers";
import { pickStatementFile, statementBankScope } from "../src/services/statement-file";
import { prepareStatementImport, confirmStatementImport, refreshStatementImport } from "../src/services/statement-import.service";
import type { Account } from "../src/types/account";
import type { Category } from "../src/types/category";
import type { CsvInspection, CsvMapping, ImportDraft, ImportDraftRow, ImportResolution } from "../src/types/statement-import";
import { radii, spacing, useThemeColors } from "../src/theme";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const resolutionOptions: { value: ImportResolution; label: string }[] = [
  { value: "unresolved", label: "Pendente" }, { value: "expense", label: "Consumo" }, { value: "income", label: "Receita real" },
  { value: "refund", label: "Estorno" }, { value: "internal_transfer", label: "Entre minhas contas" }, { value: "card_payment", label: "Pagamento de fatura" },
];
const operationLabels = { pix_sent: "Pix enviado", pix_received: "Pix recebido", debit_purchase: "Compra no débito", credit_purchase: "Compra no crédito",
  transfer: "Transferência", bill_payment: "Pagamento de conta", card_payment: "Pagamento de fatura", fee: "Tarifa", refund: "Estorno", yield: "Rendimento", unknown: "Não identificada" };
const mappingLabels: Record<keyof CsvMapping, string> = { date: "Data", description: "Descrição", amount: "Valor com sinal", credit: "Entrada", debit: "Saída", bankId: "Identificador bancário", typeHint: "Tipo" };

export default function StatementImportScreen() {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState(0);
  const [file, setFile] = useState<Awaited<ReturnType<typeof pickStatementFile>>>(null);
  const [inspection, setInspection] = useState<CsvInspection | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{ imported: number; ignored: number } | null>(null);
  const [editing, setEditing] = useState<ImportDraftRow | null>(null);
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => { void Promise.all([listAccounts(), listCategories()]).then(([a, c]) => { setAccounts(a); setCategories(c); })
    .catch(() => setError("Não foi possível carregar contas e categorias. Volte e tente novamente.")); }, []);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir. Nenhum lote parcial foi salvo."); }
    finally { pending.current = false; setBusy(false); }
  }
  function updateRow(line: number, patch: Partial<ImportDraftRow>) {
    setDraft(current => current ? { ...current, rows: current.rows.map(row => row.line === line ? { ...row, ...patch } : row) } : current);
  }
  async function chooseFile() {
    await run(async () => {
      const selected = await pickStatementFile();
      if (!selected) return;
      setDraft(null); setCompleted(null); setFile(selected); setInspection(null); setMapping(null);
      if (selected.format === "csv") {
        const result = await inspectCsv(selected.text); setInspection(result); setMapping(result.mapping);
      }
    });
  }
  async function preview() {
    await run(async () => {
      if (!file || !accountId) throw new Error("Escolha o arquivo e a conta ou cartão.");
      const statement = file.format === "ofx" ? await parseOfx(file.text) : await parseCsv(file.text, mapping!);
      const scope = await statementBankScope(statement.accountKey, file.format);
      setDraft(await prepareStatementImport(statement, accountId, file.hash, scope)); setCompleted(null);
    });
  }
  function saveEdit() {
    if (!editing) return;
    let amountCents: number; let date: string;
    try { amountCents = parseStatementAmount(editAmount); date = normalizeStatementDate(editing.date); }
    catch { Alert.alert("Dados inválidos", "Confira data e valor, com até duas casas decimais."); return; }
    if (!amountCents || !editing.description.trim()) {
      Alert.alert("Dados inválidos", "Confira data, descrição e valor."); return;
    }
    const edited = { ...editing, date, amountCents, errors: [], selected: editing.duplicate !== "exact" && editing.resolution !== "unresolved" &&
      (editing.duplicate !== "possible" || editing.allowPossibleDuplicate) };
    if (draft) { const revised = { ...draft, rows: draft.rows.map(row => row.line === edited.line ? edited : row) };
      void run(async () => { setDraft(await refreshStatementImport(revised)); }); }
    setEditing(null);
  }
  function askConfirmation() {
    if (!draft || busy) return;
    const snapshot = draft;
    Alert.alert("Confirmar importação", `${snapshot.rows.filter(row => row.selected).length} movimentações na conta ${accounts.find(a => a.id === accountId)?.name}. Confira saldo inicial e período para não somar um extrato já incluído no saldo cadastrado.`, [
      { text: "Cancelar", style: "cancel" }, { text: "Confirmar e salvar", onPress: () => { void run(async () => {
        let result;
        try { result = await confirmStatementImport(snapshot); }
        catch (reason) { setDraft(await refreshStatementImport(snapshot)); throw reason; }
        setCompleted(result); setDraft(null); setFile(null); setInspection(null); setMapping(null);
        setAccounts(await listAccounts());
      }); } },
    ]);
  }
  const selectedAccount = accounts.find(account => account.id === accountId);
  const recognized = draft?.rows.filter(row => !row.errors.length && row.resolution !== "unresolved").length ?? 0;
  const duplicates = draft?.rows.filter(row => row.duplicate !== "none").length ?? 0;
  const unresolved = draft?.rows.filter(row => row.errors.length || row.resolution === "unresolved" || (row.duplicate === "possible" && !row.allowPossibleDuplicate)).length ?? 0;
  const selectedCount = draft?.rows.filter(row => row.selected).length ?? 0;
  const dates = draft?.rows.map(row => row.date.slice(0, 10)).filter(Boolean).sort();
  const header = <View style={styles.header}>
    <AppButton label="Voltar" variant="secondary" disabled={busy} onPress={() => router.back()} />
    <ScreenHeader title="Importar extrato" subtitle="OFX e CSV, processados somente neste aparelho." eyebrow="Inteligência financeira" />
    {completed && <AppCard><Text variant="title">Importação concluída</Text><Text>{completed.imported} movimentações salvas. {completed.ignored} não selecionadas.</Text></AppCard>}
    {error ? <Text accessibilityRole="alert" tone="error">{error}</Text> : null}
    <AppCard>
      <Text variant="label">Conta ou cartão de destino</Text>
      <AppSelector accessibilityLabel="Conta do extrato" value={accountId} disabled={busy} onChange={id => { setAccountId(id); setDraft(null); }}
        options={accounts.map(account => ({ value: account.id, label: `${account.name}${account.type === "credit_card" ? " · cartão" : ""}` }))} />
      {!accounts.length && <Text>Cadastre uma conta antes de importar.</Text>}
      {selectedAccount && <Text tone="muted">Saldo atual: {money(Math.round(selectedAccount.balance * 100))}. O saldo cadastrado deve representar o início do período ainda não lançado.</Text>}
      <AppButton label={file ? "Trocar arquivo" : "Selecionar arquivo OFX/CSV"} disabled={busy} onPress={() => { void chooseFile(); }} />
      {file && <Text>{file.name} · limite 5 MiB / 10.000 movimentações</Text>}
    </AppCard>
    {file && !draft && <>
      {inspection && mapping && <AppCard>
        <Text variant="title">Confirme as colunas CSV</Text>
        <Text>{inspection.ambiguous ? "Layout ambíguo: escolha as colunas manualmente." : "Mapeamento sugerido; confirme antes de continuar."}</Text>
        <Text tone="muted">Use valor com sinal OU as colunas entrada/saída. Não use os dois modos ao mesmo tempo.</Text>
        <ScrollView horizontal><View>{inspection.sample.map((sample, index) => <Text key={index}>{sample.join(" | ")}</Text>)}</View></ScrollView>
        {(Object.keys(mappingLabels) as (keyof CsvMapping)[]).map(field => <View key={field} style={styles.field}>
          <Text>{mappingLabels[field]}</Text><AppSelector accessibilityLabel={`Coluna ${mappingLabels[field]}`} value={mapping[field] ?? -1} disabled={busy}
            options={[{ value: -1, label: "Não usar" }, ...inspection.headers.map((name, index) => ({ value: index, label: `${index + 1}: ${name}` }))]}
            onChange={value => setMapping(current => current ? { ...current, [field]: value < 0 ? null : value } : current)} />
        </View>)}
      </AppCard>}
      <AppButton label="Confirmar conta/mapeamento e preparar prévia" disabled={busy || !accountId || (file.format === "csv" && !mapping)} onPress={() => { void preview(); }} />
    </>}
    {busy && <ActivityIndicator accessibilityLabel="Processando extrato localmente" color={colors.primary} />}
    {draft && <AppCard>
      <Text variant="title">Revise antes de salvar</Text>
      <Text>{dates?.[0]} a {dates?.at(-1)} · {draft.rows.length} linhas</Text>
      <Text>{recognized} reconhecidas · {duplicates} duplicadas/semelhantes · {unresolved} pendentes</Text>
      {draft.statement.warnings.map((warning, index) => <Text key={index} tone="muted">{warning}</Text>)}
      {!draft.statement.currency && <AppButton variant="secondary" disabled={busy} label={draft.currencyConfirmed ? "✓ Valores em BRL confirmados" : "Confirmo que os valores estão em BRL"}
        onPress={() => setDraft(current => current ? { ...current, currencyConfirmed: !current.currencyConfirmed } : current)} />}
      <AppButton variant="secondary" disabled={busy} label="Selecionar todas as resolvidas sem duplicidade"
        onPress={() => setDraft(current => current ? { ...current, rows: current.rows.map(row => ({ ...row, selected: !row.errors.length && row.resolution !== "unresolved" && row.duplicate === "none" })) } : current)} />
      <AppButton variant="secondary" disabled={busy} label="Desmarcar todas" onPress={() => setDraft(current => current ? { ...current, rows: current.rows.map(row => ({ ...row, selected: false })) } : current)} />
      <AppButton label={`Revisar e confirmar ${selectedCount} selecionadas`} disabled={busy || !selectedCount || !draft.currencyConfirmed} onPress={askConfirmation} />
    </AppCard>}
  </View>;

  return <PremiumScreen ambient="subtle">
    <FlatList data={draft?.rows ?? []} keyExtractor={row => String(row.line)} ListHeaderComponent={header} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5}
      renderItem={({ item }) => <AppCard style={styles.row}>
        <AnimatedPressable accessibilityRole="checkbox" accessibilityState={{ checked: item.selected, disabled: busy || item.duplicate === "exact" || !!item.errors.length || item.resolution === "unresolved" || (item.duplicate === "possible" && !item.allowPossibleDuplicate) }}
          disabled={busy || item.duplicate === "exact" || !!item.errors.length || item.resolution === "unresolved" || (item.duplicate === "possible" && !item.allowPossibleDuplicate)}
          onPress={() => updateRow(item.line, { selected: !item.selected })} style={styles.select}>
          <WalletSymbol name={item.selected ? "success" : "receipt"} color={colors.primary} size={20} />
          <Text>{item.selected ? "Selecionada" : "Não selecionada"} · linha {item.line}</Text>
        </AnimatedPressable>
        <Text variant="label">{item.description || "Sem descrição"}</Text><Text>{item.date || "Data inválida"} · {money(item.amountCents)}</Text>
        <Text tone="muted">{operationLabels[item.identification.operation]} · {categories.find(c => c.id === item.categoryId)?.name ?? "Sem categoria"}</Text>
        {item.duplicateReason && <Text tone="muted">{item.duplicateReason}</Text>}
        {item.errors.map((message, index) => <Text tone="error" key={index}>{message}</Text>)}
        <AppButton variant="secondary" label="Revisar e editar" disabled={busy || item.duplicate === "exact"} onPress={() => { setEditing({ ...item }); setEditAmount((item.amountCents / 100).toFixed(2).replace(".", ",")); }} />
      </AppCard>} />
    <Modal visible={!!editing} animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setEditing(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><PremiumScreen ambient="subtle"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Revisar movimentação" subtitle="Nada será salvo até confirmar o lote." />
        {editing && <>
          <Text tone="muted">{editing.identification.reason}</Text>
          <AppField label="Descrição" value={editing.description} onChangeText={value => setEditing({ ...editing, description: value })} />
          <AppField label="Data AAAA-MM-DD; hora somente se fornecida" value={editing.date} onChangeText={value => setEditing({ ...editing, date: value })} autoCapitalize="none" />
          <AppField label="Valor com sinal (saídas negativas)" value={editAmount} onChangeText={setEditAmount} keyboardType="numbers-and-punctuation" />
          <AppSelector accessibilityLabel="Natureza financeira" value={editing.resolution} options={resolutionOptions} onChange={resolution => setEditing({ ...editing, resolution })} />
          <Text>Categoria</Text><AppSelector accessibilityLabel="Categoria da movimentação" value={editing.categoryId ?? 0}
            options={[{ value: 0, label: "Sem categoria" }, ...categories.map(category => ({ value: category.id, label: category.name }))]}
            onChange={value => setEditing({ ...editing, categoryId: value || null })} />
          {["internal_transfer", "card_payment"].includes(editing.resolution) && <>
            <Text>Outra conta da mesma movimentação (o outro lado também será atualizado)</Text>
            <AppSelector accessibilityLabel="Outra conta ou cartão" value={editing.counterpartAccountId ?? 0}
              options={accounts.filter(a => a.id !== accountId && (editing.resolution === "internal_transfer" ? a.type !== "credit_card" :
                selectedAccount?.type === "credit_card" ? a.type !== "credit_card" : a.type === "credit_card")).map(a => ({ value: a.id, label: a.name }))}
              onChange={value => setEditing({ ...editing, counterpartAccountId: value })} />
          </>}
          {editing.duplicate === "possible" && <AppButton variant="secondary" label={editing.allowPossibleDuplicate ? "✓ Confirmei que é uma operação distinta" : "Confirmar que esta operação semelhante é distinta"}
            onPress={() => setEditing({ ...editing, allowPossibleDuplicate: !editing.allowPossibleDuplicate })} />}
          <AppButton variant="secondary" label={editing.learnCategory ? "✓ Lembrar esta categoria para o estabelecimento" : "Lembrar esta categoria para o estabelecimento"}
            onPress={() => setEditing({ ...editing, learnCategory: !editing.learnCategory })} />
          <AppButton label="Aplicar à prévia" onPress={saveEdit} /><AppButton variant="secondary" label="Cancelar edição" onPress={() => setEditing(null)} />
        </>}
      </ScrollView></PremiumScreen></SafeAreaView>
    </Modal>
  </PremiumScreen>;
}
const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: 48, gap: spacing.lg }, header: { gap: spacing.lg },
  row: { marginBottom: spacing.md }, select: { minHeight: 48, flexDirection: "row", gap: spacing.sm, alignItems: "center", borderRadius: radii.sm },
  field: { gap: spacing.sm },
});
