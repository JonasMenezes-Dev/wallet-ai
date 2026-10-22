import type * as SQLite from "expo-sqlite";
import { getDatabase } from "../database/database";
import { normalizeNotificationConfirmation, validateNotificationEventKey, type NotificationConfirmationInput } from "../services/notification-confirmation-data";

export type FinancialConfirmationContext = { eventKey: string; requestJson: string; kind: NotificationConfirmationInput["kind"] };
export type NotificationFinancialReceipt = FinancialConfirmationContext & { reference: string };

export async function findNotificationReceipt(database: SQLite.SQLiteDatabase, eventKey: string): Promise<NotificationFinancialReceipt | null> {
  return database.getFirstAsync<NotificationFinancialReceipt>(
    `SELECT event_key AS eventKey, request_json AS requestJson, kind, reference
     FROM notification_confirmation_receipts WHERE event_key = ?`, eventKey);
}

export async function getNotificationFinancialReceipt(eventKey: string): Promise<NotificationFinancialReceipt | null> {
  validateNotificationEventKey(eventKey);
  return findNotificationReceipt(await getDatabase(), eventKey);
}

function approvedReceiptFields(requestJson: string, kind: FinancialConfirmationContext["kind"]): NotificationConfirmationInput {
  try {
    const approved = normalizeNotificationConfirmation(JSON.parse(requestJson));
    if (approved.kind !== kind) throw new Error();
    return approved;
  } catch {
    // Corrupt durable evidence cannot safely establish that a second write is distinct.
    throw new Error("Comprovante financeiro inválido. A confirmação permanece pendente para revisão.");
  }
}

function possibleSameOccurrence(first: string, second: string): boolean {
  // Legacy approvals contain a civil day only: conservatively hold matching days for review.
  // Never infer an occurrence time from the receipt's creation/confirmation timestamp.
  if (first.length === 10 || second.length === 10) return first.slice(0, 10) === second.slice(0, 10);
  // Inclusive two-minute window on the user-approved instants, including explicit offsets.
  return Math.abs(Date.parse(first) - Date.parse(second)) <= 120_000;
}

async function hasPossibleManualDuplicate(database: SQLite.SQLiteDatabase, approved: NotificationConfirmationInput): Promise<boolean> {
  if (approved.kind !== "internal_transfer") {
    const candidates = await database.getAllAsync<{ date: string }>(
      `SELECT date FROM transactions
       WHERE source = 'manual' AND type = ? AND account_id = ?
         AND transfer_id IS NULL AND goal_id IS NULL AND ROUND(amount * 100) = ?`,
      approved.kind, approved.accountId, approved.amountCents);
    return candidates.some(candidate => possibleSameOccurrence(candidate.date, approved.date));
  }
  // Only an intact expense/income pair identifies an internal transfer. Card payments
  // share transfer_id storage, so both endpoint accounts must be non-card accounts.
  const candidates = await database.getAllAsync<{ date: string }>(
    `SELECT outgoing.date FROM transactions outgoing
     JOIN transactions incoming ON incoming.transfer_id = outgoing.transfer_id AND incoming.id != outgoing.id
     JOIN accounts origin ON origin.id = outgoing.account_id
     JOIN accounts destination ON destination.id = incoming.account_id
     WHERE outgoing.transfer_id IS NOT NULL
       AND outgoing.source = 'manual' AND incoming.source = 'manual'
       AND outgoing.type = 'expense' AND incoming.type = 'income'
       AND outgoing.account_id = ? AND incoming.account_id = ?
       AND outgoing.goal_id IS NULL AND incoming.goal_id IS NULL
       AND origin.type != 'credit_card' AND destination.type != 'credit_card'
       AND outgoing.amount = incoming.amount AND outgoing.date = incoming.date
       AND ROUND(outgoing.amount * 100) = ?
       AND (SELECT COUNT(*) FROM transactions pair WHERE pair.transfer_id = outgoing.transfer_id) = 2`,
    approved.accountId, approved.toAccountId, approved.amountCents);
  return candidates.some(candidate => possibleSameOccurrence(candidate.date, approved.date));
}

async function assertNoPossibleDuplicate(database: SQLite.SQLiteDatabase, context: FinancialConfirmationContext): Promise<void> {
  const approved = approvedReceiptFields(context.requestJson, context.kind);
  const candidates = await database.getAllAsync<{ requestJson: string; kind: FinancialConfirmationContext["kind"] }>(
    `SELECT request_json AS requestJson, kind FROM notification_confirmation_receipts WHERE kind = ?`, context.kind);
  for (const candidate of candidates) {
    const previous = approvedReceiptFields(candidate.requestJson, candidate.kind);
    if (previous.accountId === approved.accountId && previous.toAccountId === approved.toAccountId
      && previous.amountCents === approved.amountCents && possibleSameOccurrence(previous.date, approved.date)) {
      // A heuristic is evidence for review, never authority to merge, discard or reuse a receipt.
      throw new Error("Possível duplicidade com outra notificação já confirmada. A confirmação permanece pendente para revisão; nenhum novo lançamento foi criado.");
    }
  }
  if (await hasPossibleManualDuplicate(database, approved)) {
    throw new Error("Possível duplicidade com lançamento manual já registrado. A confirmação permanece pendente para revisão; nenhum novo lançamento foi criado.");
  }
}

/** Called ONLY inside the existing movement transaction, on its own connection. */
export async function beginFinancialConfirmation(database: SQLite.SQLiteDatabase, context: FinancialConfirmationContext): Promise<NotificationFinancialReceipt | null> {
  // Obtain the writer lock before reading. A competing writer fails safely or sees the committed receipt.
  await database.runAsync("UPDATE notification_confirmation_receipts SET event_key = event_key WHERE event_key = ?", context.eventKey);
  const receipt = await findNotificationReceipt(database, context.eventKey);
  if (receipt && (receipt.requestJson !== context.requestJson || receipt.kind !== context.kind)) {
    throw new Error("Conflito: esta notificação já foi confirmada com outros dados.");
  }
  if (!receipt) await assertNoPossibleDuplicate(database, context);
  return receipt;
}

export async function finishFinancialConfirmation(database: SQLite.SQLiteDatabase, context: FinancialConfirmationContext, reference: string): Promise<void> {
  await database.runAsync(`INSERT INTO notification_confirmation_receipts
    (event_key, request_json, kind, reference, created_at) VALUES (?, ?, ?, ?, ?)`,
  context.eventKey, context.requestJson, context.kind, reference, new Date().toISOString());
}
