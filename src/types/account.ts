export type AccountType = "bank" | "credit_card" | "benefit" | "cash" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  createdAt: string;
  updatedAt: string;
}
