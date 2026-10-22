import type { CsvInspection, CsvMapping, ParsedStatement, StatementRow } from '../types/statement-import';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const failure = (message: string): never => { throw new Error(message); };

/** No legacy TextDecoder encoding is required by the native runtime. */
export function decodeStatementBytes(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > MAX_BYTES) return failure('Arquivo vazio ou maior que 5 MiB.');
  if ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255)) {
    if (bytes.length % 2) return failure('UTF-16 truncado.');
    const little = bytes[0] === 255;
    let value = '';
    for (let i = 2; i < bytes.length; i += 2) value += String.fromCharCode(little ? bytes[i] + bytes[i + 1] * 256 : bytes[i] * 256 + bytes[i + 1]);
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return failure('UTF-16 inválido.'); }
      else if (c >= 0xdc00 && c <= 0xdfff) return failure('UTF-16 inválido.');
    }
    return value;
  }
  const bom = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191;
  try {
    let value = '';
    for (let i = bom ? 3 : 0; i < bytes.length;) {
      const first = bytes[i++];
      if (first < 128) { value += String.fromCharCode(first); continue; }
      const count = first >= 194 && first <= 223 ? 1 : first >= 224 && first <= 239 ? 2 : first >= 240 && first <= 244 ? 3 : -1;
      if (count < 0 || i + count > bytes.length) throw new Error();
      let code = first & (0x7f >> (count + 1));
      for (let n = 0; n < count; n++) { const b = bytes[i++]; if ((b & 192) !== 128) throw new Error(); code = code * 64 + (b & 63); }
      if (code < [0,128,2048,65536][count] || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Error();
      value += String.fromCodePoint(code);
    }
    return value;
  } catch { if (bom) return failure('UTF-8 inválido.'); }
  const cp1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
  let value = '';
  for (const b of bytes) value += b >= 128 && b <= 159 ? cp1252[b - 128] : String.fromCharCode(b);
  return value;
}

function checkText(text: string) {
  if (!text.trim() || text.includes('\0')) failure('Arquivo vazio ou inválido.');
  let size = 0;
  for (const c of text) { const point = c.codePointAt(0)!; size += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4; if (size > MAX_BYTES) failure('Arquivo maior que 5 MiB.'); }
}

function dateValue(raw: string): string {
  const value = raw.trim();
  let match: readonly string[] | null = /^(\d{4})-?(\d{2})-?(\d{2})(?:(?:T| )?(\d{2}):?(\d{2})(?::?(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2}|\[[+-]?\d{1,2}(?:\.\d+)?(?::[^\]]+)?\])?)?$/.exec(value);
  if (!match) {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!br) return failure('Data inválida.');
    match = [br[0],br[3],br[2],br[1]];
  }
  const [, year, month, day, hour, minute, second, fraction = '', timezone = ''] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31][m-1]) return failure('Data inválida.');
  const date = `${year}-${month}-${day}`;
  if (hour === undefined) return date;
  if (Number(hour) > 23 || Number(minute) > 59 || (second !== undefined && Number(second) > 59)) return failure('Horário inválido.');
  let zone = timezone;
  if (zone.startsWith('[')) {
    const offset = Number(zone.slice(1,-1).split(':')[0]) * 60;
    if (!Number.isInteger(offset) || Math.abs(offset) > 840) return failure('Fuso horário inválido.');
    zone = `${offset < 0 ? '-' : '+'}${String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')}:${String(Math.abs(offset)%60).padStart(2,'0')}`;
  } else if (zone && zone !== 'Z') {
    const digits = zone.slice(1).replace(':','');
    if (Number(digits.slice(2)) > 59 || Number(digits.slice(0,2))*60 + Number(digits.slice(2)) > 840) return failure('Fuso horário inválido.');
    zone = `${zone[0]}${digits.slice(0,2)}:${digits.slice(2)}`;
  }
  return `${date}T${hour}:${minute}${second === undefined ? '' : `:${second}${fraction}`}${zone}`;
}

function cents(raw: string, ofx = false): number {
  let value = raw.trim();
  if (!value) return failure('Valor ausente.');
  let negative = false;
  if (value.startsWith('(') && value.endsWith(')')) { negative = true; value = value.slice(1,-1); }
  if (/^[+-]/.test(value)) { if (negative) return failure('Sinal inválido.'); negative = value[0] === '-'; value = value.slice(1); }
  if (ofx) { if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return failure('Valor inválido.'); }
  else if (value.includes(',') && value.includes('.')) {
    const decimal = value.lastIndexOf(',') > value.lastIndexOf('.') ? ',' : '.';
    const pattern = decimal === ',' ? /^\d{1,3}(?:\.\d{3})+,\d{1,2}$/ : /^\d{1,3}(?:,\d{3})+\.\d{1,2}$/;
    if (!pattern.test(value)) return failure('Valor inválido.');
    value = value.replace(decimal === ',' ? /\./g : /,/g,'').replace(',','.');
  } else { if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return failure('Valor inválido ou ambíguo.'); value = value.replace(',','.'); }
  const [whole, decimal = ''] = value.split('.');
  const result = Number(whole)*100 + Number(decimal.padEnd(2,'0'));
  if (!Number.isSafeInteger(result)) return failure('Valor fora do limite seguro.');
  return negative ? -result : result;
}

/** The review editor uses the same validated calendar and exact-cent rules as the readers. */
export function normalizeStatementDate(value: string): string { return dateValue(value); }
export function parseStatementAmount(value: string): number { return cents(value); }

interface CsvRecord { fields: string[]; line: number }
async function readCsv(text: string, delimiter: string): Promise<CsvRecord[]> {
  const records: CsvRecord[] = []; let fields: string[] = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  for (let i = 0; i <= text.length; i++) {
    if (i && i % 32768 === 0) await pause();
    const c = text[i];
    if (quoted) {
      if (c === undefined) return failure('Aspas CSV não fechadas.');
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else { field += c; if (c === '\n') line++; }
      continue;
    }
    if (c === '"') { if (field || closed) return failure('Aspas CSV inválidas.'); quoted = true; continue; }
    if (c === delimiter || c === '\n' || c === '\r' || c === undefined) {
      fields.push(field); field = ''; closed = false;
      if (c !== delimiter) {
        if (!(fields.length === 1 && fields[0] === '')) records.push({fields, line: startLine});
        fields = []; if (records.length > MAX_ROWS + 1) return failure('Limite de 10000 linhas excedido.');
        if (c === '\r' && text[i+1] === '\n') i++;
        line++; startLine = line;
      }
    } else { if (closed) return failure('Conteúdo após aspas CSV.'); field += c; }
  }
  return records;
}
async function csvData(text: string) {
  checkText(text); text = text.replace(/^\uFEFF/,'');
  // Count only the first logical record; punctuation in quoted headers is ignored.
  const counts = new Map([[';',0],[',',0],['\t',0]]); let quoted = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i+1] === '"') i++; else quoted = !quoted; } else if (!quoted) { if (c === '\n' || c === '\r') break; if (counts.has(c)) counts.set(c,counts.get(c)!+1); } }
  const sorted = [...counts].sort((a,b) => b[1]-a[1]);
  if (!sorted[0][1] || sorted[0][1] === sorted[1][1]) return failure('Separador CSV ausente ou ambíguo.');
  const delimiter = sorted[0][0], records = await readCsv(text,delimiter);
  if (records.length < 2) return failure('CSV sem transações.');
  return { delimiter, records };
}
const aliases: Record<keyof CsvMapping,string[]> = {
  date: ['data','date','data lancamento','data transacao','posted date','transaction date'],
  description: ['descricao','description','historico','memo','name','lancamento'],
  amount: ['valor','amount','transaction amount','valor transacao'],
  credit: ['credito','credit','entrada','entradas'], debit: ['debito','debit','saida','saidas'],
  bankId: ['id','fitid','transaction id','identificador'], typeHint: ['tipo','type','trntype'],
};
export async function inspectCsv(text: string): Promise<CsvInspection> {
  const {delimiter,records} = await csvData(text), headers = records[0].fields;
  const normalized = headers.map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').replace(/\s+/g,' '));
  const mapping = {} as CsvMapping; let ambiguous = false;
  for (const key of Object.keys(aliases) as (keyof CsvMapping)[]) { const matches = normalized.flatMap((header,i) => aliases[key].includes(header) ? [i] : []); mapping[key] = matches.length === 1 ? matches[0] : null; if (matches.length > 1) ambiguous = true; }
  if (mapping.amount !== null && (mapping.credit !== null || mapping.debit !== null)) { mapping.amount = null; mapping.credit = null; mapping.debit = null; ambiguous = true; }
  if (mapping.date === null || mapping.description === null || (mapping.amount === null && (mapping.credit === null || mapping.debit === null))) ambiguous = true;
  return { headers, sample: records.slice(1,6).map(r => r.fields), delimiter, mapping, ambiguous };
}
export async function parseCsv(text: string, mapping: CsvMapping): Promise<ParsedStatement> {
  const {records} = await csvData(text); const width = records[0].fields.length;
  const indexes = Object.values(mapping).filter((v): v is number => v !== null);
  if (mapping.date === null || mapping.description === null || (mapping.amount === null && (mapping.credit === null || mapping.debit === null)) || (mapping.amount !== null && (mapping.credit !== null || mapping.debit !== null)) || indexes.some(i => !Number.isInteger(i) || i < 0 || i >= width) || new Set(indexes).size !== indexes.length) return failure('Confirme um mapeamento CSV válido.');
  const rows: StatementRow[] = [];
  for (let i = 1; i < records.length; i++) {
    if (i % 200 === 0) await pause();
    const {fields,line} = records[i], errors: string[] = [], cell = (index: number | null) => index === null ? '' : (fields[index] ?? '').trim();
    if (fields.length !== width) errors.push('Quantidade de colunas diferente do cabeçalho.');
    let date = '', amountCents = 0;
    try { date = dateValue(cell(mapping.date)); } catch { errors.push('Data ou horário inválido.'); }
    try {
      if (mapping.amount !== null) amountCents = cents(cell(mapping.amount));
      else {
        const creditText = cell(mapping.credit), debitText = cell(mapping.debit);
        const credit = creditText ? cents(creditText) : 0, debit = debitText ? cents(debitText) : 0;
        if (credit < 0 || debit < 0) failure('Sinal conflitante em crédito/débito.');
        if ((credit !== 0 && debit !== 0) || (credit === 0 && debit === 0)) failure('Crédito/débito ambíguo ou valor zero.');
        amountCents = credit !== 0 ? credit : -debit;
      }
    } catch { errors.push('Valor inválido ou ambíguo.'); }
    const description = cell(mapping.description); if (!description) errors.push('Descrição ausente.');
    rows.push({line,bankId:cell(mapping.bankId) || null,date,amountCents,description,typeHint:cell(mapping.typeHint) || null,errors});
  }
  return {format:'csv',rows,currency:null,accountKey:null,accountKind:'unknown',warnings:['Confirme as colunas e a moeda antes de importar.']};
}

function entities(value: string) {
  return value.replace(/&([^;\s]+);/g, (_, entity: string) => {
    const named: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if (named[entity]) return named[entity];
    if (/^#(?:\d+|x[0-9a-f]+)$/i.test(entity)) { const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1)); if (point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)) return String.fromCodePoint(point); }
    return failure('Entidade OFX inválida.');
  });
}
export async function parseOfx(text: string): Promise<ParsedStatement> {
  checkText(text);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return failure('DTD e entidades externas não são permitidos.');
  // Keep original line positions while excluding comment contents from parsing.
  text = text.replace(/<!--([\s\S]*?)-->/g, (comment: string, contents: string) => {
    if (contents.includes('--')) return failure('Comentário XML inválido.');
    return comment.replace(/[^\r\n]/g, ' ');
  });
  if (text.includes('<!--')) return failure('Comentário XML incompleto.');
  // Normalize only the standard OFX namespace declaration and its optional
  // `ofx:` prefix. Other attributes are rejected rather than interpreted.
  let prefixedNamespace = false;
  text = text.replace(/<(\/?)(ofx:)?([A-Za-z][A-Za-z0-9_.-]*)([^<>]*?)>/g, (_tag, closing: string, prefix: string | undefined, name: string, attributes: string) => {
    if (name.toUpperCase() === 'OFX' && !closing) {
      const declarations = attributes.match(/\s+xmlns(?::ofx)?\s*=\s*(?:"http:\/\/ofx\.net\/types\/2003\/04"|'http:\/\/ofx\.net\/types\/2003\/04')/g) ?? [];
      const remainder = attributes.replace(/\s+xmlns(?::ofx)?\s*=\s*(?:"http:\/\/ofx\.net\/types\/2003\/04"|'http:\/\/ofx\.net\/types\/2003\/04')/g, '');
      if (remainder.trim() || declarations.length > 2 || new Set(declarations.map(d => /xmlns:ofx/.test(d) ? 'prefix' : 'default')).size !== declarations.length) return failure('Atributo ou namespace OFX não suportado.');
      prefixedNamespace = declarations.some(d => /xmlns:ofx/.test(d));
    } else if (attributes.trim()) return failure('Atributos OFX não suportados.');
    if (prefix && !prefixedNamespace) return failure('Prefixo OFX sem namespace válido.');
    return `<${closing}${name}>`;
  });
  const root = text.search(/<OFX\s*>/i); if (root < 0 || !/<\/OFX\s*>\s*$/i.test(text)) return failure('Estrutura OFX incompleta.');
  const source = text.slice(root); if (/<!(?!--)|<!--|<\?/.test(source)) return failure('Estrutura OFX não suportada.');
  const tokens = [...source.matchAll(/<\/?[A-Za-z][A-Za-z0-9_.-]*\s*>|[^<]+/g)];
  const explicit = new Set([...source.matchAll(/<\/([A-Za-z][\w.-]*)\s*>/g)].map(m => m[1].toUpperCase()));
  const stack: string[] = [], globals = new Map<string,string>(), rows: StatementRow[] = [];
  let current: Map<string,string> | null = null, correction = false, accountKind: ParsedStatement['accountKind'] = 'unknown';
  let pending: string | null = null, cursor = 0;
  const containers = new Set(['OFX','BANKMSGSRSV1','STMTTRNRS','STMTRS','BANKACCTFROM','CCACCTFROM','CREDITCARDMSGSRSV1','CCSTMTTRNRS','CCSTMTRS','BANKTRANLIST','STMTTRN','LEDGERBAL','AVAILBAL','SIGNONMSGSRSV1','SONRS','STATUS','FI']);
  const leaves = new Set(['TRNTYPE','DTPOSTED','DTUSER','DTAVAIL','TRNAMT','FITID','CORRECTFITID','CORRECTACTION','NAME','MEMO','CHECKNUM','REFNUM','SIC','PAYEEID','BANKID','ACCTID','ACCTTYPE','BRANCHID','ACCTKEY','CURDEF','CODE','SEVERITY','MESSAGE','DTSERVER','LANGUAGE','ORG','FID','INTU.BID','TRNUID','CLTCOOKIE','DTSTART','DTEND','BALAMT','DTASOF']);
  function finishRow() {
    if (!current) return;
    const errors: string[] = []; let date = '', amountCents = 0;
    if (correction) errors.push('Correção OFX exige revisão explícita; importação automática bloqueada.');
    try { date = dateValue(current.get('DTPOSTED') ?? ''); } catch { errors.push('Data ou horário inválido.'); }
    try { amountCents = cents(current.get('TRNAMT') ?? '',true); } catch { errors.push('Valor inválido.'); }
    const description = [current.get('NAME'),current.get('MEMO')].filter(Boolean).join(' — '); if (!description) errors.push('Descrição ausente.');
    // OFX line is the logical 1-based transaction index, unique even in minified XML.
    rows.push({line:rows.length+1,bankId:current.get('FITID') || null,date,amountCents,description,typeHint:current.get('TRNTYPE') || null,errors}); current = null;
    if (rows.length > MAX_ROWS) failure('Limite de 10000 linhas excedido.');
  }
  for (let i = 0; i < tokens.length; i++) {
    if (i % 1000 === 0) await pause();
    const token = tokens[i][0], index = tokens[i].index!;
    if (index !== cursor) return failure('Marcação OFX inválida.'); cursor = index+token.length;
    if (!token.startsWith('<')) {
      const value = entities(token.trim());
      if (value) {
        if (!pending) return failure('Texto OFX fora de um campo.');
        if (current || ['CURDEF','BANKID','ACCTID'].includes(pending)) { const target = current ?? globals; if (target.has(pending)) return failure('Campo OFX duplicado.'); target.set(pending,value); }
      }
      continue;
    }
    const closing = token.startsWith('</'), name = token.replace(/[<>/\s]/g,'').toUpperCase();
    if (closing) {
      if (stack.pop() !== name) return failure('Fechamento OFX inválido.');
      if (name === 'STMTTRN') finishRow(); pending = null;
    } else {
      if (name === 'OFX' && index !== 0) return failure('Múltiplos documentos OFX.');
      if (name === 'STMTTRN') { if (current || !stack.includes('BANKTRANLIST')) return failure('Transação OFX fora da lista ou truncada.'); current = new Map(); correction = false; }
      if (current && (name === 'CORRECTFITID' || name === 'CORRECTACTION')) correction = true;
      if (name === 'BANKACCTFROM' || name === 'CCACCTFROM') { if (accountKind !== 'unknown') return failure('Múltiplas contas no OFX.'); accountKind = name === 'CCACCTFROM' ? 'card' : 'bank'; }
      const container = containers.has(name) || (!leaves.has(name) && /^\s*</.test(source.slice(index+token.length)) && !/^\s*<\//.test(source.slice(index+token.length)));
      if (explicit.has(name) || container) stack.push(name);
      pending = container ? null : name;
    }
  }
  if (cursor !== source.length || stack.length || current || !rows.length) return failure('OFX vazio ou incompleto.');
  const account = globals.get('ACCTID'), bank = globals.get('BANKID');
  return {format:'ofx',rows,currency:globals.get('CURDEF')?.toUpperCase() || null,accountKey:account ? `${accountKind}:${bank ?? ''}:${account}` : null,accountKind,warnings:[]};
}
