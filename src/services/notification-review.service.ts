import type { BankNotification, InterpretedBankNotification } from "../notifications/bank-notification-engine";

export type ReviewSummary = Omit<InterpretedBankNotification, "packageName" | "notificationId" | "description">;
export type NativeReviewRow = {
  localId: string; source: string; state: "received" | "pending" | "error";
  eventKey?: string; confirmationPending?: boolean;
  postedAt: number | null; receivedAt: number; busy: boolean; readError: boolean; summary: string | null;
};
export type ReviewItem = Omit<NativeReviewRow, "summary"> & { summary: ReviewSummary | null };
export type ReviewDetail = ReviewItem & { title: string | null; text: string | null };
export interface NotificationReviewBridge {
  listNotificationReview(limit: number, offset: number): Promise<NativeReviewRow[]>;
  reserveNotificationReview(id: string, readContent: boolean): Promise<(NativeReviewRow & { leaseToken: string; rawPayload: string | null }) | null>;
  completeNotificationReview(id: string, token: string, interpretation: string | null): Promise<boolean>;
  discardNotificationReview(id: string, token: string): Promise<boolean>;
}

export class NotificationReviewBusyError extends Error {
  constructor() { super("Evento indisponível ou reservado. Atualize a lista."); }
}

function summaryFromJson(value: string | null): ReviewSummary | null {
  if (value === null) return null;
  const data = JSON.parse(value) as ReviewSummary;
  if (!data || !("status" in data)) return null; // Older encrypted structured data needs interpretation.
  const nullableText = (text: unknown) => text === null || typeof text === "string";
  if (!["recognized", "pending", "ignored"].includes(data.status)
    || !(data.amountCents === null || (Number.isSafeInteger(data.amountCents) && data.amountCents > 0))
    || !(data.operation === null || ["pix", "debit_purchase", "credit_purchase", "transfer", "own_account_transfer", "payment", "receipt", "refund"].includes(data.operation))
    || !(data.direction === null || ["incoming", "outgoing", "internal"].includes(data.direction))
    || !nullableText(data.reason) || !nullableText(data.date) || !nullableText(data.time)
    || !(data.dateSource === null || ["message", "notification"].includes(data.dateSource))
    || !(data.paymentMethod == null || ["debit", "credit"].includes(data.paymentMethod))
    || !(data.paymentChannel == null || ["contactless", "online", "in_person"].includes(data.paymentChannel))) {
    throw new Error("Interpretação indisponível.");
  }
  return { status: data.status, reason: data.reason, amountCents: data.amountCents, operation: data.operation,
    direction: data.direction, date: data.date, time: data.time, dateSource: data.dateSource,
    paymentMethod: data.paymentMethod ?? null, paymentChannel: data.paymentChannel ?? null };
}

function viewOf(row: NativeReviewRow): ReviewItem {
  if (!row || typeof row.localId !== "string" || typeof row.source !== "string"
    || !["received", "pending", "error"].includes(row.state)) throw new Error("Evento indisponível.");
  return { ...(row.eventKey ? { eventKey: row.eventKey, confirmationPending: row.confirmationPending === true } : {}),
    localId: row.localId, source: row.source, state: row.state, postedAt: row.postedAt,
    receivedAt: row.receivedAt, busy: row.busy, readError: row.readError, summary: summaryFromJson(row.summary) };
}

export function createNotificationReview(bridge: Partial<NotificationReviewBridge> | null,
  interpret: (input: BankNotification) => InterpretedBankNotification) {
  const available = bridge !== null && ["listNotificationReview", "reserveNotificationReview",
    "completeNotificationReview", "discardNotificationReview"].every(
    (name) => typeof bridge[name as keyof NotificationReviewBridge] === "function");
  const native = bridge as NotificationReviewBridge;
  const active = new Set<string>();

  async function withReservation<T>(id: string, content: boolean,
    work: (row: NonNullable<Awaited<ReturnType<NotificationReviewBridge["reserveNotificationReview"]>>>) => Promise<T>): Promise<T> {
    if (!available) throw new Error("Revisão indisponível nesta instalação.");
    if (active.has(id)) throw new NotificationReviewBusyError();
    active.add(id);
    let reserved: Awaited<ReturnType<NotificationReviewBridge["reserveNotificationReview"]>> = null;
    let finished = false;
    try {
      reserved = await native.reserveNotificationReview(id, content);
      if (!reserved) throw new NotificationReviewBusyError();
      const result = await work(reserved);
      finished = true;
      return result;
    } finally {
      if (reserved && !finished) {
        // Preserve the original failure. A dead process is handled by native lease expiry.
        try { await native.completeNotificationReview(id, reserved.leaseToken, null); } catch { /* No sensitive logs. */ }
      }
      active.delete(id);
    }
  }

  async function detail(id: string): Promise<ReviewDetail> {
    return withReservation(id, true, async (row) => {
      if (row.readError) throw new Error("Não foi possível descriptografar este evento.");
      const item = viewOf(row);
      const payload = row.rawPayload === null ? null : JSON.parse(row.rawPayload) as { title?: string | null; text?: string | null; truncated?: boolean };
      if (payload && ![payload.title, payload.text].every((value) => value == null || typeof value === "string")) {
        throw new Error("Conteúdo indisponível.");
      }
      let summary = item.summary;
      if (payload || !summary) {
        if (!payload && row.summary !== null) throw new Error("Interpretação indisponível.");
        const parsed = interpret({ packageName: row.source, notificationId: row.localId,
          postedAt: row.postedAt, title: payload?.title, text: payload?.text });
        summary = { status: parsed.status, reason: parsed.reason, amountCents: parsed.amountCents,
          operation: parsed.operation, direction: parsed.direction, date: parsed.date, time: parsed.time, dateSource: parsed.dateSource,
          paymentMethod: parsed.paymentMethod, paymentChannel: parsed.paymentChannel };
        if (!payload || payload.truncated === true) {
          summary = { ...summary, status: "pending", reason: payload ? "truncated_content" : "content_unavailable",
            amountCents: null, operation: null, direction: null, paymentMethod: null, paymentChannel: null };
        }
      }
      if (!await native.completeNotificationReview(id, row.leaseToken, JSON.stringify(summary))) {
        throw new NotificationReviewBusyError();
      }
      const sensitive = summary?.reason === "sensitive_content";
      return { ...item, state: "pending", busy: false, summary, title: sensitive ? null : payload?.title ?? null, text: sensitive ? null : payload?.text ?? null };
    });
  }

  async function list(offset = 0, isCurrent: () => boolean = () => true): Promise<{ items: ReviewItem[]; hasMore: boolean }> {
    if (!available) throw new Error("Revisão indisponível nesta instalação.");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new Error("Página inválida.");
    const rows = await native.listNotificationReview(26, offset);
    if (!Array.isArray(rows)) throw new Error("Não foi possível consultar a fila.");
    const items: ReviewItem[] = [];
    for (const row of rows.slice(0, 25)) {
      if (!isCurrent()) break;
      let item: ReviewItem;
      try { item = viewOf(row); }
      catch { item = { ...viewOf({ ...row, summary: null }), readError: true }; }
      if (!item.summary && !item.busy && !item.readError && !item.confirmationPending) {
        try {
          const result = await detail(item.localId);
          item = { ...item, state: result.state, busy: false, readError: false, summary: result.summary };
        } catch (error) {
          item = { ...item, busy: error instanceof NotificationReviewBusyError, readError: !(error instanceof NotificationReviewBusyError) };
        }
      }
      items.push(item);
    }
    return { items, hasMore: rows.length > 25 };
  }

  async function discard(id: string): Promise<void> {
    await withReservation(id, false, async (row) => {
      if (!await native.discardNotificationReview(id, row.leaseToken)) throw new NotificationReviewBusyError();
    });
  }
  return { available, list, detail, discard };
}
