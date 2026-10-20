/** Local interpretation only: a recognized candidate is never a posted transaction. */
export interface BankNotification {
  packageName?: string | null;
  title?: string | null;
  text?: string | null;
  notificationId?: string | null;
  /** Original notification timestamp, when supplied; never the parsing time. */
  postedAt?: number | null;
}

export type BankOperation = 'pix' | 'debit_purchase' | 'credit_purchase' |
  'transfer' | 'own_account_transfer' | 'payment' | 'receipt';

export interface InterpretedBankNotification {
  status: 'recognized' | 'pending' | 'ignored' | 'duplicate';
  reason: string | null;
  packageName: string | null;
  notificationId: string | null;
  amountCents: number | null;
  operation: BankOperation | null;
  direction: 'incoming' | 'outgoing' | 'internal' | null;
  description: string;
  /** Message date (YYYY-MM-DD), otherwise the original notification's ISO timestamp. */
  date: string | null;
  time: string | null;
  dateSource: 'message' | 'notification' | null;
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function moneyInCents(raw: string): number | null {
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) return null;
  const [integer, fraction = ''] = raw.replace(/\./g, '').split(',');
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function extractDate(text: string, postedAt: number | null | undefined) {
  const matches = [...text.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  if (matches.length > 1) return { date: null, time: null, dateSource: null, invalid: true } as const;
  if (matches.length === 1) {
    const match = matches[0];
    const date = match[1] ? `${match[3]}-${match[2]}-${match[1]}` : `${match[4]}-${match[5]}-${match[6]}`;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    const valid = Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
    const times = [...text.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
    const time = times.length === 1 ? `${times[0][1].padStart(2, '0')}:${times[0][2]}` : null;
    const validTime = times.length <= 1 && (!time || (Number(time.slice(0, 2)) < 24 && Number(time.slice(3)) < 60));
    return { date: valid ? date : null, time: validTime ? time : null, dateSource: 'message', invalid: !valid || !validTime } as const;
  }
  const stamp = typeof postedAt === 'number' && Number.isFinite(postedAt) ? new Date(postedAt) : null;
  const date = stamp && Number.isFinite(stamp.getTime()) ? stamp.toISOString() : null;
  return { date, time: null, dateSource: date ? 'notification' : null, invalid: false } as const;
}

export function interpretBankNotification(input: BankNotification): InterpretedBankNotification {
  const original = `${input.title ?? ''} ${input.text ?? ''}`.trim();
  const text = normalize(original);
  const timestamp = extractDate(text, input.postedAt);
  const result: InterpretedBankNotification = {
    status: 'pending', reason: null,
    packageName: input.packageName?.trim() || null,
    notificationId: input.notificationId?.trim() || null,
    amountCents: null, operation: null, direction: null,
    description: (input.text?.trim() || input.title?.trim() || '').slice(0, 500),
    date: timestamp.date, time: timestamp.time, dateSource: timestamp.dateSource,
  };
  const ignore = (reason: string): InterpretedBankNotification => ({ ...result, status: 'ignored', reason });
  const pending = (reason: string): InterpretedBankNotification => ({ ...result, status: 'pending', reason });

  if (/\b(oferta|promocao|ganhe|aproveite|cobranca|agendad[oa]|pendente|processamento|aguardando|recusad[oa]|cancelad[oa]|solicitad[oa]|solicitacao|vencimento|vence)\b/.test(text) ||
      /\bnao\b.{0,30}(realizad|concluid|enviad|recebid|aprovad|autorizad|efetuad)/.test(text) ||
      /\bnao foi possivel\b|\b(?:sera|seria|podera|poderia|for)\s+(?:enviad|recebid|realizad|efetuad|aprovad|concluid)/.test(text) ||
      /\b(pague|a pagar|para pagar)\b/.test(text)) return ignore('unconfirmed_or_non_movement');
  if (!/\b(pix|compra|comprou|transferencia|pagamento|recebimento|recebeu)\b/.test(text)) return ignore('no_movement');

  const incoming = /\b(recebid[oa]|recebeu|recebimento)\b/.test(text);
  const outgoing = /\b(enviad[oa]|enviou)\b/.test(text) ||
    (!incoming && /\b(efetuad[oa]|realizad[oa])\b/.test(text));
  const confirmed = /\b(recebid[oa]|recebeu|enviad[oa]|enviou|efetuad[oa]|realizad[oa]|aprovad[oa]|concluid[oa]|pago|paga|comprou)\b/.test(text);
  const own = /\bentre (?:as )?(?:suas|minhas|proprias) contas\b|\bentre contas proprias\b|\bmesma titularidade\b|\bpara (?:sua|minha) (?:outra )?conta\b/.test(text);
  const debit = /\bdebito\b/.test(text);
  const credit = /\bcredito\b/.test(text);
  const families = [
    /\b(pix|transferencia)\b/.test(text),
    /\b(compra|comprou)\b/.test(text),
    /\b(pagamento|recebimento)\b/.test(text) && !/\b(?:pagamento|recebimento) (?:via |por |com )?pix\b/.test(text),
  ].filter(Boolean).length;

  if (own && /\b(pix|transferencia)\b/.test(text) && confirmed) {
    result.operation = 'own_account_transfer'; result.direction = 'internal';
  } else if (/\bpix\b/.test(text)) {
    result.operation = 'pix'; result.direction = incoming ? 'incoming' : outgoing ? 'outgoing' : null;
  } else if (/\b(compra|comprou)\b/.test(text) && debit !== credit) {
    result.operation = debit ? 'debit_purchase' : 'credit_purchase'; result.direction = 'outgoing';
  } else if (/\btransferencia\b/.test(text)) {
    result.operation = 'transfer'; result.direction = incoming ? 'incoming' : outgoing ? 'outgoing' : null;
  } else if (/\b(pagamento|recebimento)\b/.test(text)) {
    result.operation = incoming ? 'receipt' : 'payment'; result.direction = incoming ? 'incoming' : confirmed ? 'outgoing' : null;
  }

  const amounts = [...text.matchAll(/r\$\s*([+-]?\d+(?:[.,]\d+)*)/g)];
  if (amounts.length === 1) result.amountCents = moneyInCents(amounts[0][1]);
  // Do not choose a purchase amount in the presence of an unlabelled balance/limit.
  const contextAmount = /\b(saldo|limite|total da fatura)\b.{0,25}\d/.test(text);
  if (amounts.length > 1 || contextAmount || incoming && outgoing || /\?/.test(text) || debit && credit || families > 1) {
    result.amountCents = null;
    return pending('ambiguous_content');
  }
  if (!confirmed || !result.operation || !result.direction) return pending('unknown_or_unconfirmed_operation');
  if (amounts.length === 0) return pending('missing_amount');
  if (result.amountCents === null) return pending('invalid_amount');
  if (timestamp.invalid) return pending('ambiguous_or_invalid_date');
  if (!result.packageName) return pending('missing_source');
  return { ...result, status: 'recognized' };
}

/**
 * Volatile FIFO deduplication: no storage, network, account matching or financial side effects.
 * Content updates and distinct original timestamps remain distinct even if an id is reused.
 * Without an id or timestamp, identical content is indistinguishable.
 */
export function createBankNotificationEngine(capacity = 1000) {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new Error('A capacidade deve ser um inteiro positivo.');
  const seen = new Set<string>();
  return {
    process(input: BankNotification): InterpretedBankNotification {
      const result = interpretBankNotification(input);
      if (result.status === 'ignored' || !result.packageName) return result;
      const key = JSON.stringify([
        result.packageName, result.notificationId,
        normalize(input.title ?? ''), normalize(input.text ?? ''),
        typeof input.postedAt === 'number' && Number.isFinite(input.postedAt) ? input.postedAt : null,
      ]);
      if (seen.has(key)) return { ...result, status: 'duplicate', reason: 'already_seen' };
      seen.add(key);
      if (seen.size > capacity) seen.delete(seen.values().next().value!);
      return result;
    },
  };
}
