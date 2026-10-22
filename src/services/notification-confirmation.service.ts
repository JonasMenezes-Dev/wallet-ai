import { normalizeNotificationConfirmation, validateNotificationEventKey, type NotificationConfirmationInput } from "./notification-confirmation-data";
import type { NotificationFinancialReceipt } from "../repositories/notification-confirmation.repository";
import type { NotificationReviewBridge } from "./notification-review.service";

export type NotificationConfirmationIntent = { localId: string; eventKey: string; requestJson: string; reference: string | null };
export interface NotificationConfirmationBridge extends NotificationReviewBridge {
  beginNotificationConfirmation(id: string, token: string, request: string): Promise<NotificationConfirmationIntent>;
  getNotificationConfirmation(id: string): Promise<NotificationConfirmationIntent | null>;
  listPendingNotificationConfirmations(): Promise<{ localId: string; eventKey: string }[]>;
  finishNotificationConfirmation(id: string, key: string, request: string, reference: string): Promise<boolean>;
}
type FinancialPort = {
  getReceipt(key: string): Promise<NotificationFinancialReceipt | null>;
  confirm(key: string, input: NotificationConfirmationInput): Promise<NotificationFinancialReceipt>;
};

export function createNotificationConfirmation(bridge: Partial<NotificationConfirmationBridge> | null, financial: FinancialPort) {
  const native = bridge as NotificationConfirmationBridge;
  const available = !!bridge && ["reserveNotificationReview", "completeNotificationReview", "beginNotificationConfirmation",
    "getNotificationConfirmation", "listPendingNotificationConfirmations", "finishNotificationConfirmation"].every(
    key => typeof bridge[key as keyof NotificationConfirmationBridge] === "function");
  const active = new Set<string>();
  function requireAvailable() { if (!available) throw new Error("Confirmação indisponível. Atualize a instalação Android."); }
  function assertIntent(intent: NotificationConfirmationIntent, id: string, request?: string) {
    validateNotificationEventKey(intent.eventKey);
    if (intent.localId !== id || (request !== undefined && intent.requestJson !== request)) {
      throw new Error("Conflito nos dados da confirmação. Nenhum comprovante foi substituído.");
    }
  }
  async function finish(intent: NotificationConfirmationIntent, receipt: NotificationFinancialReceipt) {
    if (receipt.eventKey !== intent.eventKey || receipt.requestJson !== intent.requestJson
      || receipt.kind !== JSON.parse(intent.requestJson).kind) {
      throw new Error("Conflito entre a intenção e o comprovante financeiro.");
    }
    if (!await native.finishNotificationConfirmation(intent.localId, intent.eventKey, receipt.requestJson,
      `${receipt.kind}:${receipt.reference}`)) throw new Error("Registro financeiro salvo; atualização da fila pendente.");
    return receipt;
  }
  async function confirm(id: string, input: NotificationConfirmationInput): Promise<NotificationFinancialReceipt> {
    requireAvailable();
    const data = normalizeNotificationConfirmation(input);
    const request = JSON.stringify(data);
    if (active.has(id)) throw new Error("Confirmação já em andamento.");
    active.add(id);
    try {
      let intent = await native.getNotificationConfirmation(id);
      if (!intent) {
        const row = await native.reserveNotificationReview(id, false);
        if (!row) throw new Error("Evento reservado, descartado ou indisponível.");
        try { intent = await native.beginNotificationConfirmation(id, row.leaseToken, request); }
        catch (error) {
          // Release only an unprepared lease. Native SQL refuses to release a durable intent.
          try { await native.completeNotificationReview(id, row.leaseToken, null); } catch { /* Safe native recovery. */ }
          throw error;
        }
      }
      assertIntent(intent, id, request);
      const receipt = await financial.getReceipt(intent.eventKey);
      if (receipt) return await finish(intent, receipt);
      if (intent.reference !== null) throw new Error("Comprovante financeiro ausente. A confirmação permanece bloqueada.");
      // This is the ONLY financial write, reached exclusively by an explicit user action.
      return await finish(intent, await financial.confirm(intent.eventKey, data));
    } finally { active.delete(id); }
  }
  async function pending(id: string): Promise<NotificationConfirmationIntent | null> {
    requireAvailable();
    const intent = await native.getNotificationConfirmation(id);
    if (intent) assertIntent(intent, id);
    return intent;
  }
  async function retry(id: string): Promise<NotificationFinancialReceipt> {
    const intent = await pending(id);
    if (!intent) throw new Error("Intenção de confirmação indisponível.");
    return confirm(id, JSON.parse(intent.requestJson));
  }
  async function reconcile(): Promise<{ resolved: number; unresolved: number }> {
    requireAvailable();
    const intents = await native.listPendingNotificationConfirmations();
    if (!Array.isArray(intents)) throw new Error("Não foi possível consultar confirmações pendentes.");
    let resolved = 0, unresolved = 0;
    for (const item of intents) {
      if (active.has(item.localId)) { unresolved++; continue; }
      validateNotificationEventKey(item.eventKey);
      const receipt = await financial.getReceipt(item.eventKey);
      if (!receipt) { unresolved++; continue; }
      const intent = await native.getNotificationConfirmation(item.localId);
      if (!intent) throw new Error("Intenção de confirmação ausente.");
      assertIntent(intent, item.localId);
      await finish(intent, receipt);
      resolved++;
    }
    return { resolved, unresolved };
  }
  return { available, confirm, pending, retry, reconcile };
}
