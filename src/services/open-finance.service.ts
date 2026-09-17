import { TransactionType } from "../types/transaction";

export interface OpenFinanceConnection {
  id: string;
  provider: string;
  institutionName: string;
  status: "connected" | "pending" | "disconnected";
  lastSyncAt: string | null;
}

export interface ImportedTransaction {
  amount: number;
  type: Extract<TransactionType, "income" | "expense">;
  description: string;
  merchant: string | null;
  date: string;
  source: "import" | "notification";
  isAutomatic: true;
}

/**
 * Contrato local para uma futura conexão Open Finance.
 * Tokens bancários não devem ser armazenados no SQLite nem enviados pelo app.
 * A implementação real deve conversar com um backend/PSP certificado.
 */
export interface OpenFinanceProvider {
  connect(institutionId: string): Promise<OpenFinanceConnection>;
  sync(connectionId: string): Promise<ImportedTransaction[]>;
  disconnect(connectionId: string): Promise<void>;
}

/**
 * Analisa o texto de uma notificação bancária sem guardar a notificação original.
 * A leitura em segundo plano exige módulo nativo Android e consentimento explícito.
 */
export function parseBankNotification(
  text: string,
  date = new Date().toISOString(),
): ImportedTransaction | null {
  const value = text.match(
    /(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)/i,
  );
  if (!value) return null;

  const amount = Number(value[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const normalized = text.toLowerCase();
  const isIncome =
    /receb|pix recebido|depósito|deposito|entrada|salário|salario/.test(
      normalized,
    );

  return {
    amount,
    type: isIncome ? "income" : "expense",
    description: text.trim().slice(0, 120),
    merchant: null,
    date,
    source: "notification",
    isAutomatic: true,
  };
}
