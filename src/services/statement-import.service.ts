import type { SQLiteDatabase } from "expo-sqlite";
import { getDatabase, withTransferTransaction } from "../database/database";
import { createLinkedMovementInDatabase, createTransactionInDatabase } from "../repositories/transaction.repository";
import type { ImportDraft, ImportDraftRow, ParsedStatement, StatementRow } from "../types/statement-import";
import { identifyStatementRow, normalizeStatementDescription, suggestImportCategory } from "./statement-rules";
import { normalizeStatementDate } from "./statement-parsers";

type Receipt = { account_id: number; bank_scope: string; bank_id: string | null; file_hash: string;
  row_number: number; source_date: string; amount_cents: number; description_key: string };
type Movement = { amount: number; type: string; date: string; description: string | null;
  external_id: string | null; provider: string | null; institution: string | null; transfer_id: string | null };
type Context = { receipts: Map<string, Receipt[]>; files: Set<string>; fingerprints: Map<string, Receipt[]>;
  movements: Map<string, Movement[]> };
const commitOrder = (a: StatementRow, b: StatementRow) => day(a.date).localeCompare(day(b.date)) ||
  (a.date.length > 10 && b.date.length > 10 ? Date.parse(a.date) - Date.parse(b.date) : 0) || a.line - b.line;
const day = (value: string) => {
  if (value.length === 10 || !Number.isFinite(Date.parse(value))) return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const key = (date: string, cents: number) => `${day(date)}:${cents}`;
const sameTime = (a: string, b: string) => a.length === 10 || b.length === 10 || new Date(a).getTime() === new Date(b).getTime();
function append<T>(map: Map<string, T[]>, index: string, value: T) {
  const existing = map.get(index);
  if (existing) existing.push(value); else map.set(index, [value]);
}
function indexReceipt(context: Context, receipt: Receipt) {
  context.files.add(`${receipt.file_hash}:${receipt.row_number}`);
  if (receipt.bank_id) append(context.receipts, `${receipt.bank_scope}:${receipt.bank_id}`, receipt);
  append(context.fingerprints, key(receipt.source_date, receipt.amount_cents), receipt);
}
async function loadContext(database: SQLiteDatabase, accountId: number): Promise<Context> {
  const context: Context = { receipts: new Map(), files: new Set(), fingerprints: new Map(), movements: new Map() };
  const receipts = await database.getAllAsync<Receipt>("SELECT * FROM statement_import_receipts WHERE account_id = ?", accountId);
  receipts.forEach(receipt => indexReceipt(context, receipt));
  const movements = await database.getAllAsync<Movement>(`SELECT t.amount, t.type, t.date, t.description,
    COALESCE(r.bank_id, t.external_id) AS external_id, t.provider, t.institution, t.transfer_id
    FROM transactions t LEFT JOIN statement_import_receipts r
      ON r.account_id = t.account_id AND r.reference = CAST(t.id AS TEXT)
    WHERE t.account_id = ? AND t.type IN ('income','expense')`, accountId);
  movements.forEach(row => append(context.movements, key(row.date, Math.round(row.amount * 100) * (row.type === "expense" ? -1 : 1)), row));
  return context;
}
function duplicateOf(context: Context, draft: ImportDraft, original: StatementRow, edited: StatementRow) {
  if (context.files.has(`${draft.fileHash}:${original.line}`)) return { duplicate: "exact" as const, duplicateReason: "Linha deste arquivo já confirmada." };
  const identities = original.bankId ? context.receipts.get(`${draft.bankScope}:${original.bankId}`) ?? [] : [];
  if (identities.some(record => record.amount_cents === original.amountCents && day(record.source_date) === day(original.date))) {
    return { duplicate: "exact" as const, duplicateReason: "Identificador bancário já importado nesta conta." };
  }
  if (identities.length) return { duplicate: "possible" as const, duplicateReason: "Identificador reutilizado com dados divergentes; confira o extrato." };
  for (const candidate of [original, edited]) {
    const descriptionKey = normalizeStatementDescription(candidate.description);
    const records = context.fingerprints.get(key(candidate.date, candidate.amountCents)) ?? [];
    if (records.some(record => sameTime(record.source_date, candidate.date) && record.description_key === descriptionKey &&
      !(record.bank_id && original.bankId && record.bank_scope === draft.bankScope && record.bank_id !== original.bankId))) {
      return { duplicate: "possible" as const, duplicateReason: "Data, valor e descrição coincidem com importação anterior." };
    }
    const movements = context.movements.get(key(candidate.date, candidate.amountCents)) ?? [];
    if (movements.some(record => sameTime(record.date, candidate.date) &&
      (record.transfer_id || normalizeStatementDescription(record.description ?? "") === descriptionKey) &&
      !(record.provider === "statement-import" && record.institution === draft.bankScope && record.external_id && original.bankId && record.external_id !== original.bankId))) {
      return { duplicate: "possible" as const, duplicateReason: "Possível correspondência com lançamento existente, inclusive manual ou transferência própria." };
    }
  }
  return { duplicate: "none" as const, duplicateReason: null };
}
function validateDraft(draft: ImportDraft) {
  if (!Number.isSafeInteger(draft.accountId) || draft.accountId <= 0 || !/^[a-f0-9]{64}$/.test(draft.fileHash) ||
    !/^[a-zA-Z0-9:_-]{1,128}$/.test(draft.bankScope) || draft.rows.length > 10000 || !draft.rows.length ||
    new Set(draft.rows.map(row => row.line)).size !== draft.rows.length) {
    throw new Error("Prévia inválida. Selecione novamente o arquivo e a conta.");
  }
  if (draft.statement.currency && draft.statement.currency.toUpperCase() !== "BRL") throw new Error("Apenas extratos em BRL são suportados; nenhuma conversão cambial é feita.");
}
async function checkAccount(database: SQLiteDatabase, draft: ImportDraft) {
  const account = await database.getFirstAsync<{ type: string }>("SELECT type FROM accounts WHERE id = ?", draft.accountId);
  if (!account) throw new Error("Conta de destino não encontrada.");
  if ((draft.statement.accountKind === "card" && account.type !== "credit_card") ||
      (draft.statement.accountKind === "bank" && account.type === "credit_card")) {
    throw new Error("O tipo de conta selecionado não corresponde ao extrato. Selecione banco ou cartão corretamente.");
  }
  return account;
}

export async function prepareStatementImport(statement: ParsedStatement, accountId: number, fileHash: string, bankScope: string): Promise<ImportDraft> {
  const draft: ImportDraft = { statement, accountId, fileHash, bankScope, currencyConfirmed: statement.currency?.toUpperCase() === "BRL",
    extractionConfirmed: statement.format !== "pdf", rows: [] };
  // Validate size using the unprocessed source rows as well.
  if (!statement.rows.length || statement.rows.length > 10000) throw new Error("Extrato vazio ou com mais de 10.000 linhas.");
  draft.rows = statement.rows.map(row => ({ ...row, original: { ...row, errors: [...row.errors] },
    identification: identifyStatementRow(row, statement.accountKind), resolution: "unresolved", categoryId: null,
    counterpartAccountId: null, selected: false, duplicate: "none", duplicateReason: null,
    allowPossibleDuplicate: false, learnCategory: false }));
  validateDraft(draft);
  const database = await getDatabase();
  const account = await checkAccount(database, draft);
  const context = await loadContext(database, accountId);
  const categories = await database.getAllAsync<{ id: number; name: string; createdAt: string }>("SELECT id, name, created_at AS createdAt FROM categories");
  const rules = await database.getAllAsync<{ merchantKey: string; categoryId: number }>("SELECT merchant_key AS merchantKey, category_id AS categoryId FROM statement_category_rules");
  for (const row of draft.rows) {
    row.identification = identifyStatementRow(row, account.type === "credit_card" ? "card" : "bank");
    row.resolution = row.identification.suggestedResolution;
    row.categoryId = suggestImportCategory(row.description, categories, rules).categoryId;
    row.selected = !row.errors.length && row.resolution !== "unresolved";
  }
  return reviewDuplicates(draft, context);
}

async function reviewDuplicates(draft: ImportDraft, context: Context): Promise<ImportDraft> {
  const seen = new Map<string, StatementRow[]>();
  const identities = new Map<string, StatementRow[]>();
  const rows: ImportDraftRow[] = [];
  const ordered = [...draft.rows].sort(commitOrder);
  for (let index = 0; index < ordered.length; index++) {
    const row = { ...ordered[index] };
    Object.assign(row, duplicateOf(context, draft, row.original, row));
    const fingerprint = `${key(row.date, row.amountCents)}:${normalizeStatementDescription(row.description)}`;
    const earlier = seen.get(fingerprint) ?? [];
    const sameIdentity = row.original.bankId ? identities.get(row.original.bankId) ?? [] : [];
    if (row.duplicate === "none" && sameIdentity.length) {
      row.duplicate = sameIdentity.some(previous => previous.amountCents === row.original.amountCents && day(previous.date) === day(row.original.date)) ? "exact" : "possible";
      row.duplicateReason = "Identificador repetido no arquivo: confira os dados e confirme se a operação é distinta.";
    }
    if (row.duplicate === "none" && earlier.some(previous => sameTime(previous.date, row.date) && (!previous.bankId || !row.original.bankId || previous.bankId === row.original.bankId))) {
      row.duplicate = "possible";
      row.duplicateReason = "Linha semelhante repetida no arquivo; confira se são operações distintas.";
    }
    append(seen, fingerprint, { ...row, bankId: row.original.bankId });
    if (row.original.bankId) append(identities, row.original.bankId, row.original);
    row.selected = row.selected && !row.errors.length && row.duplicate !== "exact" && row.resolution !== "unresolved" &&
      (row.duplicate !== "possible" || row.allowPossibleDuplicate);
    rows.push(row);
    if (index % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const indexed = new Map(rows.map(row => [row.line, row]));
  return { ...draft, rows: draft.rows.map(row => indexed.get(row.line)!) };
}

/** Refresh after editing or a late conflict; never writes or silently confirms a duplicate. */
export async function refreshStatementImport(draft: ImportDraft): Promise<ImportDraft> {
  validateDraft(draft);
  const database = await getDatabase();
  await checkAccount(database, draft);
  return reviewDuplicates(draft, await loadContext(database, draft.accountId));
}

function validateRow(row: ImportDraftRow) {
  let normalizedDate: string;
  try { normalizedDate = normalizeStatementDate(row.date); } catch { throw new Error(`Revise a data da linha ${row.line}.`); }
  if (row.errors.length || !Number.isSafeInteger(row.amountCents) || row.amountCents === 0 ||
    normalizedDate !== row.date ||
    !row.description.trim() || row.description.length > 1000 || !Number.isSafeInteger(row.original.line) || row.original.line <= 0 ||
    !["income", "expense", "refund", "internal_transfer", "card_payment"].includes(row.resolution)) {
    throw new Error(`Revise os campos ou desmarque a linha ${row.line}.`);
  }
  if ((["income", "refund"].includes(row.resolution) && row.amountCents < 0) || (row.resolution === "expense" && row.amountCents > 0)) {
    throw new Error(`Tipo incompatível com o sinal da linha ${row.line}.`);
  }
}

export async function confirmStatementImport(draft: ImportDraft): Promise<{ imported: number; ignored: number }> {
  validateDraft(draft);
  if (draft.statement.format === "pdf" && (!draft.statement.pdfSummary || !draft.extractionConfirmed)) {
    throw new Error("Confira o período, as movimentações, as linhas ignoradas e possíveis falhas do PDF antes de confirmar.");
  }
  if (!draft.currencyConfirmed) throw new Error("Confirme que o extrato está em BRL antes de importar.");
  const selected = draft.rows.filter(row => row.selected);
  if (!selected.length) throw new Error("Selecione ao menos uma movimentação resolvida.");
  selected.forEach(validateRow);
  await withTransferTransaction(async database => {
    const account = await checkAccount(database, draft);
    const context = await loadContext(database, draft.accountId);
    // Chronological application preserves intermediate balance checks; an overdraft is never invented.
    for (const row of [...selected].sort(commitOrder)) {
      const duplicate = duplicateOf(context, draft, row.original, row);
      if (duplicate.duplicate === "exact" || (duplicate.duplicate === "possible" && !row.allowPossibleDuplicate)) {
        throw new Error(`Possível duplicata na linha ${row.line}. Revise novamente; nada foi importado.`);
      }
      const amount = Math.abs(row.amountCents) / 100;
      let reference: string;
      if (row.resolution === "internal_transfer" || row.resolution === "card_payment") {
        if (!Number.isSafeInteger(row.counterpartAccountId) || !row.counterpartAccountId || row.counterpartAccountId === draft.accountId) {
          throw new Error(`Selecione a outra conta na linha ${row.line}.`);
        }
        if (row.resolution === "card_payment" && ((account.type === "credit_card" && row.amountCents < 0) ||
            (account.type !== "credit_card" && row.amountCents > 0))) throw new Error("Pagamento de fatura com direção incompatível.");
        reference = await createLinkedMovementInDatabase(database, {
          amount, date: row.date, description: row.description,
          fromAccountId: row.amountCents < 0 ? draft.accountId : row.counterpartAccountId,
          toAccountId: row.amountCents < 0 ? row.counterpartAccountId : draft.accountId,
        }, row.resolution === "card_payment", "import");
      } else {
        reference = String(await createTransactionInDatabase(database, {
          amount, type: row.resolution === "expense" ? "expense" : "income", isRefund: row.resolution === "refund",
          description: row.description.trim(), date: row.date, merchant: row.identification.merchant,
          categoryId: row.categoryId, accountId: draft.accountId, goalId: null, paymentMethod: null,
          isAutomatic: false, source: "import", externalId: null, provider: "statement-import", institution: draft.bankScope,
        }));
      }
      const receipt: Receipt = { account_id: draft.accountId, bank_scope: draft.bankScope, bank_id: row.original.bankId,
        file_hash: draft.fileHash, row_number: row.original.line, source_date: row.original.date,
        amount_cents: row.original.amountCents, description_key: normalizeStatementDescription(row.original.description) };
      await database.runAsync(`INSERT INTO statement_import_receipts
        (account_id, bank_scope, bank_id, file_hash, row_number, source_date, amount_cents, description_key, reference, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, receipt.account_id, receipt.bank_scope, receipt.bank_id, receipt.file_hash,
        receipt.row_number, receipt.source_date, receipt.amount_cents, receipt.description_key, reference, new Date().toISOString());
      indexReceipt(context, receipt);
      append(context.movements, key(row.date, row.amountCents), { amount, date: row.date,
        type: row.amountCents < 0 ? "expense" : "income", description: row.description, external_id: row.original.bankId,
        provider: "statement-import", institution: draft.bankScope,
        transfer_id: ["internal_transfer", "card_payment"].includes(row.resolution) ? reference : null });
      if (row.learnCategory && row.categoryId && row.resolution === "expense") {
        const merchantKey = suggestImportCategory(row.original.description, [], []).merchantKey;
        if (merchantKey) await database.runAsync(`INSERT INTO statement_category_rules (merchant_key, category_id, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(merchant_key) DO UPDATE SET category_id = excluded.category_id, updated_at = excluded.updated_at`, merchantKey, row.categoryId, new Date().toISOString());
      }
    }
  });
  return { imported: selected.length, ignored: draft.rows.length - selected.length };
}
