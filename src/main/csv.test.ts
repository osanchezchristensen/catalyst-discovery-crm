import { describe, expect, it } from 'vitest'
import { CsvError, decodeCsv, MAX_CSV_ROWS, parseCsv, toCsv } from './csv'

describe('toCsv', () => {
  it('guards cells that a spreadsheet would run as a formula', () => {
    const out = toCsv(['name'], [['=SUM(A1)'], ['+1'], ['-2'], ['@x'], ['\tTab'], ['=HYPERLINK("http://evil","Click")']])
    expect(out.split('\r\n').slice(1, 7)).toEqual([
      "'=SUM(A1)",
      "'+1",
      "'-2",
      "'@x",
      "'\tTab", // after the guard the cell no longer starts with whitespace, so no quotes needed
      '"\'=HYPERLINK(""http://evil"",""Click"")"'
    ])
  })

  it('quotes commas, quotes and line breaks, keeps numbers and blanks, adds a BOM and CRLF', () => {
    const out = toCsv(['a', 'b', 'c'], [['x, y', 'say "hi"', 'two\nlines'], [3, null, undefined]])
    expect(out).toBe('\uFEFFa,b,c\r\n"x, y","say ""hi""","two\nlines"\r\n3,,\r\n')
  })
})

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas and newlines, BOM and CRLF', () => {
    const text = '\uFEFFName,Notes\r\n"Lee, Pat","Said ""wow""\nthen left"\r\nKim,ok\r\n'
    expect(parseCsv(text)).toEqual({
      headers: ['Name', 'Notes'],
      rows: [
        ['Lee, Pat', 'Said "wow"\nthen left'],
        ['Kim', 'ok']
      ]
    })
  })

  it('pads short rows, cuts long ones, skips blank lines and trims', () => {
    expect(parseCsv('a,b\n1\n\n 2 ,3,4\n').rows).toEqual([
      ['1', ''],
      ['2', '3']
    ])
  })

  it('decodes UTF-8, and falls back to Windows-1252 for files saved by Excel', () => {
    expect(decodeCsv(Buffer.from('Name\nJosé\n', 'utf8'))).toBe('Name\nJosé\n')
    expect(decodeCsv(Buffer.from([0x4a, 0x6f, 0x73, 0xe9]))).toBe('José') // "José" in Windows-1252
  })

  it('rejects an empty file, an unclosed quote, too many rows and too many bytes', () => {
    expect(() => parseCsv('')).toThrow(CsvError)
    expect(() => parseCsv('a\n"oops')).toThrow(/never closed/)
    expect(() => parseCsv('a\n' + 'x\n'.repeat(MAX_CSV_ROWS + 1))).toThrow(/more than 5000 rows/)
    expect(() => parseCsv('a'.repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MB/)
  })
})
