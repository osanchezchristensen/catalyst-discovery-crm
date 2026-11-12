// Interview notes are HTML limited to what the toolbar makes (ADR 0006). The HTML is only ever parsed by the
// editor or turned into text, never inserted into the page, so this allowlist cleaner is defense in depth.

export const NOTE_TAGS = ['p', 'strong', 'u', 'ul', 'ol', 'li'] as const
const ALLOWED = new Set<string>(NOTE_TAGS)
// Like a browser: a tag name must follow < or </ directly, so "a < b" stays text.
const TAG = /<(\/?)([a-zA-Z][\w:-]*)[^>]*>/g

const escapeText = (s: string) => s.replace(/&(?!(#\d+|#x[\da-f]+|[a-z]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Keeps the allowlisted tags without attributes, drops every other tag, and escapes the text between them. */
export function cleanNoteHtml(html: string): string {
  let out = ''
  let last = 0
  for (const m of html.matchAll(TAG)) {
    out += escapeText(html.slice(last, m.index))
    const name = m[2].toLowerCase()
    if (ALLOWED.has(name)) out += `<${m[1]}${name}>`
    last = m.index + m[0].length
  }
  return out + escapeText(html.slice(last))
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Plain text (notes before v0.11.0) to one paragraph per line. */
export function plainToHtml(text: string): string {
  if (!text) return ''
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) =>
  s.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? whole
    const hex = e[1] === 'x' || e[1] === 'X'
    const code = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10)
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole // fromCodePoint throws past the Unicode range
  }
  )

/** Note HTML to plain text for CSV and emptiness checks: lists become "• " and "1. " lines ("- " would trip the CSV formula guard). */
export function noteToPlain(html: string): string {
  const lines: string[] = []
  const lists: { ordered: boolean; n: number }[] = []
  let line = ''
  let prefix = '' // marker for the list item being written; later paragraphs in it are indented instead
  const push = () => {
    lines.push(prefix + line)
    line = ''
    prefix = ' '.repeat(prefix.length)
  }
  let last = 0
  for (const m of html.matchAll(TAG)) {
    line += decode(html.slice(last, m.index))
    last = m.index + m[0].length
    const close = m[1] === '/'
    const name = m[2].toLowerCase()
    if (name === 'p' && close) push()
    else if (name === 'ul' || name === 'ol' || name === 'li') {
      if (line.trim()) push() // text outside a paragraph
      if (close) prefix = ''
      if (name === 'li' && !close) {
        const list = lists[lists.length - 1]
        prefix = list ? '  '.repeat(lists.length - 1) + (list.ordered ? `${++list.n}. ` : '• ') : ''
      } else if (name !== 'li') {
        if (close) lists.pop()
        else lists.push({ ordered: name === 'ol', n: 0 })
      }
    }
  }
  line += decode(html.slice(last))
  if (line) push()
  return lines.map((l) => l.trimEnd()).join('\n')
}
