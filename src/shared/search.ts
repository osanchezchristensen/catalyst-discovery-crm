// Search everything (backlog #7). In memory: one student's workspace is small, so this is instant without an index.
import { noteToPlain } from './notes'

export type Searchable = {
  contacts: { id: string; name: string; organization: string; role: string; email: string; tags: string[]; notes: string }[]
  interviews: {
    id: string
    contact_name: string | null
    date: string
    notes: Record<string, string>
    quotes: string
    next_step: string
    wtp_signal: string
  }[]
  insights: { id: string; interview_id: string | null; text: string; tags: string[] }[]
  hypotheses: { id: string; statement: string; success_criteria: string }[]
}

export type SearchKind = 'contacts' | 'interviews' | 'insights' | 'hypotheses'
/** `date` (YYYY-MM-DD) is for interviews, so the screen can format it for the reader's locale. */
export type SearchHit = { kind: SearchKind; id: string; title: string; detail: string; interviewId: string | null; date?: string }
export type SearchGroup = { kind: SearchKind; total: number; hits: SearchHit[] }

const MAX_PER_GROUP = 8
const SNIPPET = 60

/** Lowercase without accents, so "jose" finds "José". NFD keeps one character per code unit for Latin text. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** About 60 characters around the first word's match, with … where it was cut. */
function snippet(text: string, word: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  // Folding can change length ("é" may be two code units in the source), so map folded positions back.
  let folded = ''
  const source: number[] = []
  for (let i = 0; i < flat.length; i++) {
    const f = fold(flat[i])
    folded += f
    for (let k = 0; k < f.length; k++) source.push(i)
  }
  const found = folded.indexOf(word)
  const at = found < 0 ? -1 : source[found]
  if (at < 0) return flat.length > SNIPPET ? `${flat.slice(0, SNIPPET)}…` : flat
  const start = Math.max(0, at - 20)
  const end = Math.min(flat.length, start + SNIPPET)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

export function search(query: string, data: Searchable): SearchGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const group = <T>(kind: SearchKind, items: T[], fields: (item: T) => string[], hit: (item: T) => Omit<SearchHit, 'kind' | 'detail'>) => {
    const hits: SearchHit[] = []
    let total = 0
    for (const item of items) {
      const texts = fields(item)
      const all = fold(texts.join('\n'))
      if (!words.every((w) => all.includes(w))) continue
      total++
      if (hits.length < MAX_PER_GROUP) {
        // Show the field where the first word appears, so the student sees why it matched.
        const where = texts.find((t) => fold(t).includes(words[0])) ?? texts[0]
        hits.push({ kind, detail: snippet(where, words[0]), ...hit(item) })
      }
    }
    return { kind, total, hits }
  }

  return [
    group('contacts', data.contacts, (c) => [c.name, c.organization, c.role, c.email, c.tags.join(' '), c.notes], (c) => ({
      id: c.id,
      title: c.name,
      interviewId: null
    })),
    group(
      'interviews',
      data.interviews,
      (i) => [...Object.values(i.notes).map(noteToPlain), i.quotes, i.next_step, i.wtp_signal, i.contact_name ?? ''],
      (i) => ({ id: i.id, title: i.contact_name ?? 'No contact', date: i.date, interviewId: i.id })
    ),
    group('insights', data.insights, (n) => [n.text, n.tags.join(' ')], (n) => ({ id: n.id, title: n.text, interviewId: n.interview_id })),
    group('hypotheses', data.hypotheses, (h) => [h.statement, h.success_criteria], (h) => ({ id: h.id, title: h.statement, interviewId: null }))
  ].filter((g) => g.total > 0)
}
