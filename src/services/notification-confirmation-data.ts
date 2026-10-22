export type NotificationConfirmationInput = {
  kind: "income" | "expense" | "internal_transfer";
  amountCents: number;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  date: string;
  description: string | null;
};

export function parseNotificationAmount(value: string): number {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error("Informe um valor com até duas casas decimais.");
  const [whole, decimal = ""] = value.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Informe um valor maior que zero.");
  return cents;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");
function localFields(date: Date) {
  return { date: `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` };
}
function capturedDate(timestamp: unknown): Date | null {
  if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || timestamp < 0) return null;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) && date.getFullYear() >= 1 && date.getFullYear() <= 9999 ? date : null;
}
function validConfirmationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) return false;
  const calendar = value.slice(0, 10);
  const day = new Date(`${calendar}T00:00:00.000Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === calendar && Number.isFinite(Date.parse(value));
}

/** Explicit local wall-clock choice, with its offset. No fallback to the confirmation clock. */
export function notificationConfirmationDateTime(date: string, time: string, originalTimestamp?: number | null): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(time);
  if (!validConfirmationDate(date) || date.length !== 10 || !match) throw new Error("Informe data e hora válidas.");
  const normalizedTime = `${match[1]}:${match[2]}:${match[3] ?? "00"}.${(match[4] ?? "").padEnd(3, "0")}`;
  const original = capturedDate(originalTimestamp);
  // Preserve the exact captured instant even in the repeated hour at the end of DST.
  const sameOriginal = original && localFields(original).date === date && localFields(original).time === normalizedTime;
  const selected = sameOriginal ? original : new Date(`${date}T${normalizedTime}`);
  if (!Number.isFinite(selected.getTime()) || localFields(selected).date !== date || localFields(selected).time !== normalizedTime) {
    throw new Error("Data ou hora inexistente no fuso local. Corrija os campos.");
  }
  const offset = -selected.getTimezoneOffset();
  return `${date}T${normalizedTime}${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

export function createNotificationConfirmationDraft(summary: { direction?: string | null; amountCents?: number | null; date?: string | null } | null, postedAt?: number | null) {
  const captured = capturedDate(postedAt);
  return { kind: (summary?.direction === "incoming" ? "income" : summary?.direction === "outgoing" ? "expense" : null) as NotificationConfirmationInput["kind"] | null,
    amount: summary?.amountCents == null ? "" : (summary.amountCents / 100).toFixed(2).replace(".", ","),
    accountId: null as number | null, toAccountId: null as number | null, categoryId: null as number | null,
    ...(captured ? localFields(captured) : { date: "", time: "" }), description: "" };
}

export function validateNotificationEventKey(key: string): void {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (typeof key !== "string" || !new RegExp(`^${uuid}:${uuid}$`).test(key)) {
    throw new Error("Identidade da notificação inválida.");
  }
}

/** Canonical user-approved financial fields only. Never includes notification text. */
export function normalizeNotificationConfirmation(input: NotificationConfirmationInput): NotificationConfirmationInput {
  const id = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!input || !["income", "expense", "internal_transfer"].includes(input.kind)
    || !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || !id(input.accountId)) {
    throw new Error("Informe tipo, valor em centavos e conta.");
  }
  if (typeof input.date !== "string" || !validConfirmationDate(input.date)) {
    throw new Error("Informe uma data válida.");
  }
  const internal = input.kind === "internal_transfer";
  if (internal ? !id(input.toAccountId) || input.toAccountId === input.accountId || input.categoryId !== null
    : !id(input.categoryId) || input.toAccountId !== null) {
    throw new Error(internal ? "Selecione duas contas distintas; transferência não usa categoria." : "Selecione uma categoria.");
  }
  if (input.description !== null && (typeof input.description !== "string" || input.description.length > 160)) {
    throw new Error("Descrição inválida (máximo de 160 caracteres).");
  }
  return { kind: input.kind, amountCents: input.amountCents, accountId: input.accountId,
    toAccountId: internal ? input.toAccountId : null, categoryId: internal ? null : input.categoryId,
    date: input.date, description: input.description?.trim() || null };
}
