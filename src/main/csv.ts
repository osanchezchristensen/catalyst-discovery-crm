// CSV writing (with a spreadsheet formula guard) and a small RFC 4180 parser for contact imports.

export const MAX_CSV_BYTES = 5 * 1024 * 1024
export const MAX_CSV_ROWS = 5000

export class CsvError extends Error {}

type Cell = string | number | null | undefined

/**
 * Spreadsheets run a cell that starts with = + - @ (or a tab/CR) as a formula, so an imported
 * contact named "=HYPERLINK(...)" could act when the CSV is opened. Prefix those with ' (OWASP).
 */
function guard(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return String(cell)
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
}

const quote = (s: string) => (/[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM so Excel reads accents correctly. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const line = (cells: Cell[]) => cells.map((c) => quote(guard(c))).join(',')
  return '\uFEFF' + [line(headers), ...rows.map(line)].join('\r\n') + '\r\n'
}

/** Decodes a CSV file: UTF-8 when valid, else Windows-1252 (Excel's default "CSV (Comma delimited)" on Windows). */
export function decodeCsv(bytes: Buffer): string {
  const utf8 = bytes.toString('utf8')
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(bytes) : utf8
}

/** Parses CSV text into headers and rows. Rows are padded or cut to the header width; blank lines are skipped. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  if (Buffer.byteLength(text) > MAX_CSV_BYTES) throw new CsvError('That file is larger than 5 MB.')
  const s = text.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const endField = () => {
    record.push(field)
    field = ''
  }
  const endRecord = () => {
    endField()
    if (record.some((f) => f.trim())) records.push(record)
    if (records.length > MAX_CSV_ROWS + 1) throw new CsvError(`That file has more than ${MAX_CSV_ROWS} rows.`)
    record = []
  }
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (ch === '"') quoted = false
      else field += ch
      i++
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === ',') endField()
    else if (ch === '\r' && s[i + 1] === '\n') {
      endRecord()
      i++
    } else if (ch === '\n' || ch === '\r') endRecord()
    else field += ch
    i++
  }
  if (quoted) throw new CsvError('That file has a quote that is never closed.')
  if (field !== '' || record.length) endRecord()
  if (!records.length) throw new CsvError('That file is empty.')
  const headers = records[0].map((h) => h.trim())
  const rows = records.slice(1).map((r) => headers.map((_, k) => (r[k] ?? '').trim()))
  return { headers, rows }
}
