import type { ExtractedStatementPdf, PdfTextItem } from "./statement-pdf-extractor";
import type { ParsedStatement, StatementRow } from "../types/statement-import";
import { normalizeStatementDate, parseStatementAmount } from "./statement-parsers";
import { normalizeStatementDescription as normalize } from "./statement-rules";

type Columns = { date: number; description: number; value: number; balance: number; width: number };
type Line = { y: number; items: PdfTextItem[] };
const calendarPattern = /\b\d{2}\/\d{2}\/\d{4}\b/g;
const moneyPattern = /^[+-]?\d[\d.]*,\d{2}$/;
function textOf(items: PdfTextItem[]): string {
  let text = ""; let end = 0;
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    const value = item.text.replace(/\s+/g, " ").trim();
    if (!value) continue;
    if (text && item.x - end > 1.5) text += " ";
    text += value; end = Math.max(end, item.x + item.width);
  }
  return text.trim();
}
function linesOf(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.y - item.y) <= 2.5) previous.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines;
}
function columnHeader(line: Line, width: number): Columns | null {
  const date = line.items.find(item => normalize(item.text).trim() === "data");
  const description = line.items.find(item => /^lancamentos?$/.test(normalize(item.text).trim()));
  const value = line.items.find(item => /^valor\b/.test(normalize(item.text)));
  const balance = line.items.find(item => /^saldo\b/.test(normalize(item.text)));
  if (!date || !description || !value || !balance || !(date.x < description.x && description.x < value.x && value.x < balance.x)) return null;
  return { date: date.x, description: description.x, value: value.x, balance: balance.x, width };
}
function monetary(text: string): number {
  const value = text.replace(/\s+/g, "");
  if (!moneyPattern.test(value)) throw new Error("Valor ausente ou ambíguo na coluna de movimentação.");
  return parseStatementAmount(value);
}

/** Itaú textual four-column statement. Geometry selects records; words only classify them later. */
export async function parseItauPdf(document: ExtractedStatementPdf): Promise<ParsedStatement> {
  if (!document?.pages?.length || document.pages.length > 30) throw new Error("PDF vazio ou acima do limite de 30 páginas.");
  let characters = 0; let glyphItems = 0;
  for (const page of document.pages) {
    if (!Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0 || !Array.isArray(page.items)) throw new Error("Geometria PDF inválida.");
    for (const item of page.items) {
      if (typeof item.text !== "string" || ![item.x, item.y, item.width, item.height].every(Number.isFinite) || item.width < 0 || item.height < 0) throw new Error("Texto PDF inválido.");
      characters += item.text.length; glyphItems++;
    }
  }
  if (characters > 500000 || glyphItems > 250000) throw new Error("PDF excede o limite de texto para revisão segura.");
  if (!characters || !document.pages.some(page => page.items.some(item => /[\p{L}\p{N}]/u.test(item.text)))) throw new Error("PDF sem texto extraível. OCR não está disponível.");
  const pageLines = document.pages.map(page => linesOf(page.items));
  const signature = pageLines.flatMap(lines => lines.map(line => normalize(textOf(line.items)))).join("\n");
  if (!/\bitau\b/.test(signature) || !/extrato\s+conta/.test(signature)) throw new Error("Layout PDF não reconhecido. Selecione um extrato textual Itaú compatível.");
  const periodLine = signature.split("\n").find(line => /periodo de visualizacao/.test(line));
  const periodDates = periodLine?.match(calendarPattern);
  if (periodDates?.length !== 2) throw new Error("Não foi possível validar o período do extrato Itaú.");
  let periodStart: string; let periodEnd: string;
  try { periodStart = normalizeStatementDate(periodDates[0]); periodEnd = normalizeStatementDate(periodDates[1]); }
  catch { throw new Error("Período do extrato inválido."); }
  if (periodStart > periodEnd) throw new Error("Período do extrato invertido.");
  const emissionLine = signature.split("\n").find(line => /emitid[oa]\s+em|data de emissao/.test(line));
  const emittedRaw = emissionLine?.match(calendarPattern)?.[0];
  let emittedDate: string | null = null;
  if (emittedRaw) { try { emittedDate = normalizeStatementDate(emittedRaw); } catch { /* Emission is never a fallback movement date. */ } }
  const summary: NonNullable<ParsedStatement["pdfSummary"]> = { pageCount: document.pages.length, periodStart, periodEnd, emittedDate,
    ignoredBalanceLines: 0, ignoredOtherLines: 0, suspiciousLines: 0, emptyPages: 0, issues: [] };
  const rows: StatementRow[] = [];
  let columns: Columns | null = null; let ended = false; let currency: string | null = null;
  let pending: { row: StatementRow; page: number; sourceLine: number; hasAmount: boolean; pageIndex: number; lastY: number; height: number } | null = null;
  const issue = (page: number, line: number, reason: string) => {
    summary.suspiciousLines++; if (summary.issues.length < 100) summary.issues.push({ page, line, reason });
  };
  const finish = () => {
    if (!pending) return;
    if (!pending.hasAmount) pending.row.errors.push("Movimentação sem valor válido na coluna de valor.");
    if (!pending.row.description) pending.row.errors.push("Descrição ausente.");
    if (pending.row.errors.length) issue(pending.page, pending.sourceLine, "Movimentação incompleta ou inválida; revise antes de selecionar.");
    pending.row.line = rows.length + 1; rows.push(pending.row); pending = null;
  };
  for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
    const page = document.pages[pageIndex]; const lines = pageLines[pageIndex];
    let pageHasHeader = false;
    if (!lines.length) { summary.emptyPages++; continue; }
    if (columns && Math.abs(page.width / columns.width - 1) > 0.02) throw new Error("Páginas PDF com geometria incompatível; nenhuma movimentação foi importada.");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (lineIndex % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const line = lines[lineIndex]; const fullText = textOf(line.items); const normalized = normalize(fullText);
      const header = columnHeader(line, page.width);
      if (header) { columns = header; pageHasHeader = true; ended = false; if (/r\s*\$/i.test(fullText)) currency = "BRL"; summary.ignoredOtherLines++; continue; }
      if (!columns || ended) { summary.ignoredOtherLines++; continue; }
      if (/^atencao\b/.test(normalized)) { finish(); ended = true; summary.ignoredOtherLines++; continue; }
      const current = columns;
      const valueLeft = current.value - Math.max(16, page.width * 0.03);
      const valueRight = (current.value + current.balance) / 2 + 6;
      const dateText = textOf(line.items.filter(item => item.x >= current.date - 5 && item.x < current.description - 5));
      const description = textOf(line.items.filter(item => item.x >= current.description - 3 && item.x < valueLeft));
      const valueText = textOf(line.items.filter(item => item.x >= valueLeft && item.x < valueRight));
      const balanceText = textOf(line.items.filter(item => item.x >= current.balance - 20));
      const dateShape = /^\d{2}\/\d{2}\/\d{4}$/.test(dateText);
      if (dateShape) {
        finish();
        if (/^saldo (?:do dia|anterior|disponivel|final|inicial)\b/.test(normalize(description))) {
          summary.ignoredBalanceLines++;
          if (valueText || !balanceText) issue(page.page, lineIndex + 1, "Linha de saldo fora da estrutura esperada.");
          continue;
        }
        const row: StatementRow = { line: 0, bankId: null, date: "", amountCents: 0, description, typeHint: "ITAU_PDF", errors: [] };
        try { row.date = normalizeStatementDate(dateText); } catch { row.errors.push("Data de lançamento inválida."); }
        if (row.date && (row.date < periodStart || row.date > periodEnd)) row.errors.push("Data de lançamento fora do período reconhecido.");
        pending = { row, hasAmount: false, page: page.page, sourceLine: lineIndex + 1,
          pageIndex, lastY: line.y, height: Math.max(...line.items.map(item => item.height), 10) };
        if (valueText) { try { row.amountCents = monetary(valueText); pending.hasAmount = row.amountCents !== 0; } catch { row.errors.push("Coluna de valor inválida ou ambígua."); } }
        continue;
      }
      // Only aligned cells may continue a pending row. Header/footer text is never appended.
      if (!dateText && pending && (description || valueText) && !balanceText) {
        const adjacent = pending.pageIndex === pageIndex
          ? line.y > pending.lastY && line.y - pending.lastY <= Math.max(24, pending.height * 2.5)
          : pending.pageIndex === pageIndex - 1 && !pending.hasAmount && !!valueText && pending.lastY > document.pages[pending.pageIndex].height * 0.8 && line.y < page.height * 0.2;
        if (!adjacent) {
          finish(); summary.ignoredOtherLines++;
          issue(page.page, lineIndex + 1, "Texto ou valor distante da movimentação; não foi anexado à descrição.");
          continue;
        }
        if (valueText && pending.hasAmount) { finish(); issue(page.page, lineIndex + 1, "Valor sem data de lançamento; possível linha perdida na extração."); continue; }
        if (pending.pageIndex !== pageIndex && !pageHasHeader) pending.row.errors.push("Continuação entre páginas sem novo cabeçalho; revise e confirme os campos manualmente.");
        if (description) pending.row.description += `${pending.row.description ? " " : ""}${description}`;
        if (valueText) { try { pending.row.amountCents = monetary(valueText); pending.hasAmount = pending.row.amountCents !== 0; } catch { pending.row.errors.push("Continuação com valor inválido."); } }
        pending.lastY = line.y; pending.pageIndex = pageIndex;
        continue;
      }
      if (valueText || (dateText && /\d{1,2}\//.test(dateText))) issue(page.page, lineIndex + 1, "Linha financeira sem estrutura confiável; não foi convertida automaticamente.");
      else summary.ignoredOtherLines++;
    }
  }
  finish();
  if (!rows.length) throw new Error("Nenhuma movimentação pôde ser extraída com segurança deste PDF.");
  if (rows.length > 10000) throw new Error("PDF acima do limite de 10.000 movimentações.");
  const account = signature.match(/\b(?:agencia|ag)\s*:\s*(\d{3,5})\b[^\n]*?\bconta\s*:\s*([\d.-]+)/);
  const warnings = [`${summary.ignoredBalanceLines} linhas de saldo e ${summary.ignoredOtherLines} linhas de cabeçalho/rodapé ignoradas.`];
  if (summary.suspiciousLines) warnings.push(`${summary.suspiciousLines} possíveis falhas de extração. Confira as páginas do documento antes de confirmar.`);
  if (summary.emptyPages) warnings.push(`${summary.emptyPages} páginas sem texto extraível. Nenhum OCR foi aplicado.`);
  return { format: "pdf", rows, currency, accountKind: "bank", accountKey: account ? `itau:${account[1]}:${account[2]}` : null, warnings, pdfSummary: summary };
}
