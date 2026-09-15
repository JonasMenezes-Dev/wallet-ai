export type TransactionType = "income" | "expense" | "transfer";

export type TransactionSource = "manual" | "notification" | "import";

export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  description: string | null;
  merchant: string | null;
  date: string;
  categoryId: number | null;
  accountId: number | null;
  paymentMethod: string | null;
  isAutomatic: boolean;
  source: TransactionSource;
  createdAt: string;
  updatedAt: string;
}
