import { getDatabase } from "../database/database";
export interface RecurringItem {
  id: number;
  title: string;
  type: "income" | "expense";
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  nextDueDate: string;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowForecast {
  currentBalance: number;
  projectedBalance: number;
  upcomingIncome: number;
  upcomingExpenses: number;
  horizonDays: number;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthlyDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

export async function listRecurringItems(): Promise<RecurringItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: number;
    title: string;
    type: "income" | "expense";
    amount: number;
    category_id: number | null;
    category_name: string | null;
    next_due_date: string;
    due_day: number;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT recurring_items.*,
      categories.name AS category_name
    FROM recurring_items
    LEFT JOIN categories ON categories.id = recurring_items.category_id
    WHERE recurring_items.is_active = 1
    ORDER BY recurring_items.next_due_date ASC, recurring_items.title COLLATE NOCASE ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    categoryName: row.category_name,
    nextDueDate: row.next_due_date,
    dueDay: row.due_day,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveRecurringItem(input: {
  id?: number;
  title: string;
  type: "income" | "expense";
  amount: number;
  categoryId: number | null;
  nextDueDate: string;
}): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Informe um nome para a conta recorrente.");
  if (input.type !== "income" && input.type !== "expense") {
    throw new Error("O tipo da recorrência é inválido.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate)) {
    throw new Error("Selecione uma data de vencimento válida.");
  }
  const date = parseDate(input.nextDueDate);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== input.nextDueDate) {
    throw new Error("A data de vencimento é inválida.");
  }

  const database = await getDatabase();
  if (input.categoryId !== null) {
    const category = await database.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE id = $id",
      { $id: input.categoryId },
    );
    if (!category) throw new Error("A categoria selecionada não existe.");
  }

  const now = new Date().toISOString();
  const dueDay = date.getDate();

  if (input.id) {
    const result = await database.runAsync(`
      UPDATE recurring_items
      SET title = $title, type = $type, amount = $amount,
          category_id = $categoryId, next_due_date = $nextDueDate,
          due_day = CASE WHEN next_due_date = $nextDueDate THEN due_day ELSE $dueDay END,
          updated_at = $now
      WHERE id = $id AND is_active = 1
    `, {
      $title: title, $type: input.type, $amount: input.amount,
      $categoryId: input.categoryId, $nextDueDate: input.nextDueDate,
      $dueDay: dueDay, $now: now, $id: input.id,
    });
    if (result.changes === 0) throw new Error("Essa recorrência não foi encontrada.");
    return;
  }

  await database.runAsync(`
    INSERT INTO recurring_items (
      title, type, amount, category_id, next_due_date, due_day,
      frequency, is_active, created_at, updated_at
    )
    VALUES ($title, $type, $amount, $categoryId, $nextDueDate, $dueDay,
      'monthly', 1, $now, $now)
  `, {
    $title: title, $type: input.type, $amount: input.amount,
    $categoryId: input.categoryId, $nextDueDate: input.nextDueDate,
    $dueDay: dueDay, $now: now,
  });
}

export async function deleteRecurringItem(id: number): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    "UPDATE recurring_items SET is_active = 0, updated_at = $now WHERE id = $id AND is_active = 1",
    { $id: id, $now: new Date().toISOString() },
  );
  if (result.changes === 0) throw new Error("Essa recorrência não foi encontrada.");
}

export async function advanceRecurringItem(id: number): Promise<void> {
  const database = await getDatabase();
  const item = await database.getFirstAsync<{ next_due_date: string; due_day: number }>(
    "SELECT next_due_date, due_day FROM recurring_items WHERE id = $id AND is_active = 1",
    { $id: id },
  );
  if (!item) throw new Error("Essa recorrência não foi encontrada.");

  const current = parseDate(item.next_due_date);
  let next = monthlyDate(current.getFullYear(), current.getMonth() + 1, item.due_day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (dateKey(next) <= dateKey(today)) {
    next = monthlyDate(next.getFullYear(), next.getMonth() + 1, item.due_day);
  }
  const result = await database.runAsync(`
    UPDATE recurring_items
    SET next_due_date = $nextDueDate, updated_at = $now
    WHERE id = $id AND is_active = 1
  `, {
    $id: id, $nextDueDate: dateKey(next), $now: new Date().toISOString(),
  });
  if (result.changes === 0) throw new Error("Não foi possível atualizar o próximo vencimento.");
}

export async function getCashflowForecast(horizonDays = 30): Promise<CashflowForecast> {
  if (!Number.isSafeInteger(horizonDays) || horizonDays < 0 || horizonDays > 3650) {
    throw new Error("Informe um horizonte entre 0 e 3650 dias.");
  }

  const database = await getDatabase();
  const balances = await database.getFirstAsync<{ current_balance: number | null }>(`
    SELECT COALESCE(SUM(
      CASE WHEN type = 'credit_card' THEN -balance ELSE balance END
    ), 0) AS current_balance
    FROM accounts
  `);
  const items = await listRecurringItems();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + horizonDays);
  const todayKey = dateKey(today);
  const horizonKey = dateKey(horizon);
  let upcomingIncome = 0;
  let upcomingExpenses = 0;

  for (const item of items) {
    let due = parseDate(item.nextDueDate);
    // Uma conta vencida é considerada pendente hoje; não cria lançamentos.
    if (dateKey(due) < todayKey) due = new Date(today);

    while (dateKey(due) <= horizonKey) {
      if (item.type === "income") upcomingIncome += item.amount;
      else upcomingExpenses += item.amount;
      due = monthlyDate(due.getFullYear(), due.getMonth() + 1, item.dueDay);
    }
  }

  const currentBalance = balances?.current_balance ?? 0;
  return {
    currentBalance,
    upcomingIncome,
    upcomingExpenses,
    projectedBalance: currentBalance + upcomingIncome - upcomingExpenses,
    horizonDays,
  };
}
