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
  source: "import";
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
