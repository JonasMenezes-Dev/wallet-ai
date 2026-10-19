/**
 * Exibe a data e a hora local de uma movimentação financeira.
 *
 * Transações novas guardam um ISO timestamp completo. Registros antigos que
 * só tenham a data não recebem uma hora inventada: a ausência fica explícita.
 */
export function formatTransactionDateTime(value: string): string {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const hasTime = /T\d{2}:\d{2}| \d{2}:\d{2}/.test(value);

  const parsed = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Data não disponível";
  }

  const formattedDate = parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (!hasTime) {
    return `${formattedDate} · horário não registrado`;
  }

  const formattedTime = parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formattedDate} às ${formattedTime}`;
}
