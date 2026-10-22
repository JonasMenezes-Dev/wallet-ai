export type StatementFormat = "ofx" | "csv" | "pdf";
export type StatementAccountKind = "bank" | "card" | "unknown";
export interface StatementRow {
  line: number;
  bankId: string | null;
  date: string;
  /** Bank convention: incoming positive, outgoing negative; exact cents. */
  amountCents: number;
  description: string;
  typeHint: string | null;
  errors: string[];
}
export interface ParsedStatement {
  format: StatementFormat;
  rows: StatementRow[];
  currency: string | null;
  accountKey: string | null;
  accountKind: StatementAccountKind;
  warnings: string[];
  pdfSummary?: {
    pageCount: number;
    periodStart: string;
    periodEnd: string;
    emittedDate: string | null;
    ignoredBalanceLines: number;
    ignoredOtherLines: number;
    suspiciousLines: number;
    emptyPages: number;
    issues: { page: number; line: number; reason: string }[];
  };
}
export interface CsvMapping {
  date: number | null;
  description: number | null;
  amount: number | null;
  credit: number | null;
  debit: number | null;
  bankId: number | null;
  typeHint: number | null;
}
export interface CsvInspection {
  headers: string[];
  sample: string[][];
  delimiter: string;
  mapping: CsvMapping;
  ambiguous: boolean;
}
export type ImportOperation = "pix_sent" | "pix_received" | "debit_purchase" | "credit_purchase" |
  "transfer" | "bill_payment" | "card_payment" | "fee" | "refund" | "yield" | "unknown";
export type ImportResolution = "income" | "expense" | "refund" | "internal_transfer" | "card_payment" | "unresolved";
export interface ImportIdentification {
  operation: ImportOperation;
  merchant: string | null;
  suggestedResolution: ImportResolution;
  reason: string | null;
}
export interface ImportCategoryRule {
  merchantKey: string;
  categoryId: number;
}
export interface ImportDraftRow extends StatementRow {
  /** Immutable identity of original parsed row; editable fields never change these. */
  original: StatementRow;
  identification: ImportIdentification;
  resolution: ImportResolution;
  categoryId: number | null;
  counterpartAccountId: number | null;
  selected: boolean;
  duplicate: "none" | "exact" | "possible";
  duplicateReason: string | null;
  allowPossibleDuplicate: boolean;
  learnCategory: boolean;
}
export interface ImportDraft {
  /** SHA-256 of file bytes, not the raw statement. */
  fileHash: string;
  bankScope: string;
  accountId: number;
  statement: ParsedStatement;
  rows: ImportDraftRow[];
  currencyConfirmed: boolean;
  extractionConfirmed?: boolean;
}
