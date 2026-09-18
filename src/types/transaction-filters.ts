import type { TransactionType, TransactionWithRelations } from "./transaction";

export type TransactionTypeFilter = "all" | TransactionType;

export type TransactionOriginFilter = "all" | "manual" | "automatic";

/**
 * Períodos oferecidos na listagem.
 * `month` e `last30` são relativos a hoje; `custom` usa `from`/`to`.
 */
export type TransactionPeriodFilter =
  | "all"
  | "month"
  | "last30"
  | "last90"
  | "custom";

export interface TransactionFilters {
  /** Busca livre por descrição, estabelecimento, categoria ou conta. */
  search: string;
  type: TransactionTypeFilter;
  origin: TransactionOriginFilter;
  period: TransactionPeriodFilter;
  /** Início e fim do período, no formato `YYYY-MM-DD`. Só usados em `custom`. */
  from: string | null;
  to: string | null;
  categoryId: number | null;
  accountId: number | null;
  /**
   * Cartão de crédito selecionado. Como o cartão é uma conta do tipo
   * `credit_card`, este filtro também casa por `accountId` — é separado
   * só para a UI poder oferecer "Conta" e "Cartão" em fileiras distintas.
   */
  cardId: number | null;
}

export const emptyTransactionFilters: TransactionFilters = {
  search: "",
  type: "all",
  origin: "all",
  period: "all",
  from: null,
  to: null,
  categoryId: null,
  accountId: null,
  cardId: null,
};

/** `true` quando há qualquer filtro ativo (usado para "Limpar filtros"). */
export function hasActiveTransactionFilters(
  filters: TransactionFilters,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.type !== "all" ||
    filters.origin !== "all" ||
    filters.period !== "all" ||
    filters.categoryId !== null ||
    filters.accountId !== null ||
    filters.cardId !== null
  );
}

/** Normaliza texto para busca sem acento e sem caixa. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Data local no formato `YYYY-MM-DD` (sem passar por UTC). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Aplica todos os filtros da listagem.
 *
 * Fica no service, e não no componente, por dois motivos:
 * 1. é regra de negócio (o que "últimos 30 dias" significa), então é testável
 *    sem renderizar nada;
 * 2. a tela só desenha o resultado, mantendo a cadeia
 *    UI → Hook → Service → Repository.
 *
 * A lista já chega ordenada do banco (mais recente primeiro) e a ordem é
 * preservada aqui.
 */
export function filterTransactions(
  transactions: TransactionWithRelations[],
  filters: TransactionFilters,
  now: Date = new Date(),
): TransactionWithRelations[] {
  const search = normalizeSearchText(filters.search);

  const { start, end } = resolvePeriodRange(filters, now);

  return transactions.filter((transaction) => {
    if (filters.type !== "all" && transaction.type !== filters.type) {
      return false;
    }

    if (filters.origin === "manual" && transaction.isAutomatic) return false;
    if (filters.origin === "automatic" && !transaction.isAutomatic)
      return false;

    if (
      filters.categoryId !== null &&
      transaction.categoryId !== filters.categoryId
    ) {
      return false;
    }

    if (
      filters.accountId !== null &&
      transaction.accountId !== filters.accountId
    ) {
      return false;
    }

    if (filters.cardId !== null && transaction.accountId !== filters.cardId) {
      return false;
    }

    if (!isWithinRange(transaction.date, start, end)) return false;

    if (search.length > 0 && !matchesSearch(transaction, search)) return false;

    return true;
  });
}

/** Intervalo inclusivo de datas (`YYYY-MM-DD`). `null` = sem limite. */
function resolvePeriodRange(
  filters: TransactionFilters,
  now: Date,
): { start: string | null; end: string | null } {
  if (filters.period === "all") {
    return { start: null, end: null };
  }

  if (filters.period === "custom") {
    const from = filters.from || null;
    const to = filters.to || null;

    /*
     * Intervalo invertido pelo usuário é normalizado, não rejeitado.
     * Só comparamos quando os dois lados existem: ordenar com um lado
     * ausente trocaria o significado de início e fim.
     */
    if (from && to && from > to) {
      return { start: to, end: from };
    }

    return { start: from, end: to };
  }

  if (filters.period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return { start: toDateKey(first), end: toDateKey(last) };
  }

  const days = filters.period === "last30" ? 30 : 90;

  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));

  return { start: toDateKey(start), end: toDateKey(now) };
}

/**
 * Compara a data da transação com o intervalo.
 * Comparamos só a parte `YYYY-MM-DD`: a hora não deve influenciar o filtro
 * (uma transação de hoje às 23h continua sendo "deste mês").
 */
function isWithinRange(
  value: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start && !end) return true;

  const dateKey = extractDateKey(value);

  if (dateKey === null) return false;

  if (start && dateKey < start) return false;
  if (end && dateKey > end) return false;

  return true;
}

/**
 * Extrai `YYYY-MM-DD` de um ISO ou já de uma data simples.
 * Transações antigas podem ter sido gravadas das duas formas.
 */
function extractDateKey(value: string): string | null {
  if (!value) return null;

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : null;
}

function matchesSearch(
  transaction: TransactionWithRelations,
  search: string,
): boolean {
  const haystack = normalizeSearchText(
    [
      transaction.description ?? "",
      transaction.merchant ?? "",
      transaction.categoryName ?? "",
      transaction.accountName ?? "",
      transaction.goalName ?? "",
      transaction.institution ?? "",
    ].join(" "),
  );

  return haystack.includes(search);
}
