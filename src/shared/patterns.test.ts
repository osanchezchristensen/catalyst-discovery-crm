import { describe, expect, it } from 'vitest'
import { compareByType, referralChains } from './patterns'

const person = (id: string, referred_by: string | null = null) => ({ id, name: id.toUpperCase(), organization: '', referred_by })
const names = (nodes: ReturnType<typeof referralChains>): unknown =>
  nodes.map((n) => (n.children.length ? { [n.contact.name]: names(n.children) } : n.contact.name))

describe('referralChains', () => {
  it('builds trees from people who referred someone, with interviewed flags', () => {
    const contacts = [person('pat'), person('maya', 'pat'), person('lee', 'maya'), person('kim', 'pat'), person('solo')]
    const chains = referralChains(contacts, [{ contact_id: 'pat' }, { contact_id: 'lee' }, { contact_id: null }])
    expect(names(chains)).toEqual([{ PAT: [{ MAYA: ['LEE'] }, 'KIM'] }])
    expect(chains[0].interviewed).toBe(true)
    expect(chains[0].children[0].interviewed).toBe(false)
    expect(chains[0].children[0].children[0].interviewed).toBe(true)
  })

  it('treats a missing referrer as a root and survives a loop from an imported file', () => {
    expect(names(referralChains([person('a', 'gone'), person('b', 'a')], []))).toEqual([{ A: ['B'] }])
    expect(names(referralChains([person('a', 'b'), person('b', 'a')], []))).toEqual([{ A: ['B'] }])
    expect(referralChains([person('a'), person('b')], [])).toEqual([])
  })
})

const interview = (id: string, type: string, pain_score: number | null, wtp_signal = '', date = '2026-11-0' + id.slice(-1)) => ({
  id, type, pain_score, wtp_signal, date, contact_name: `C${id}`
})
const quote = (id: string, interview_id: string, date: string, is_quote = true) => ({ id, interview_id, text: `q${id}`, is_quote, date, contact_name: null })

describe('compareByType', () => {
  it('summarizes Validation and Sales interviews and leaves Informational out', () => {
    const interviews = [
      interview('i1', 'validation', 4, 'Pre-order'),
      interview('i2', 'validation', 2),
      interview('i3', 'validation', null),
      interview('i4', 'sales', 5, 'Signed pilot'),
      interview('i5', 'informational', 5, 'Intro')
    ]
    const insights = [quote('n1', 'i1', '2026-11-01'), quote('n2', 'i2', '2026-11-02'), quote('n3', 'i2', '2026-11-02', false), quote('n4', 'i5', '2026-11-05')]
    const { validation, sales } = compareByType(interviews, insights)
    expect(validation).toMatchObject({ count: 3, rated: 2, avgPain: 3, pain: [0, 1, 0, 1, 0] })
    expect(validation.signals.map((s) => s.wtp_signal)).toEqual(['Pre-order'])
    expect(validation.quotes.map((q) => q.text)).toEqual(['qn2', 'qn1']) // newest first, quotes only
    expect(sales).toMatchObject({ count: 1, rated: 1, avgPain: 5, pain: [0, 0, 0, 0, 1], quotes: [] })
  })

  it('is empty, not broken, with no interviews', () => {
    expect(compareByType([], []).sales).toEqual({ count: 0, rated: 0, avgPain: null, pain: [0, 0, 0, 0, 0], signals: [], quotes: [] })
  })
})
