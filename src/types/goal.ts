export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}