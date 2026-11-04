import { describe, expect, it } from 'vitest'
import { readiness, type ReadinessInput } from './readiness'

const seg = (id: string, is_beachhead = false) => ({ id, is_beachhead })
const iv = (segment_id: string | null, pain_score: number | null = null, wtp_signal = '') => ({ segment_id, pain_score, wtp_signal })
const hyp = (risk: 'low' | 'medium' | 'high', linked: number, created_at = '2026-01-01') => ({
  risk,
  created_at,
  tally: { supports: linked, refutes: 0, neutral: 0 }
})
const empty: ReadinessInput = { segments: [], interviews: [], hypotheses: [], decisions: [] }
const item = (input: Partial<ReadinessInput>, key: string) => readiness({ ...empty, ...input }).find((i) => i.key === key)!

describe('readiness checklist', () => {
  it('needs 3 segments and a beachhead', () => {
    expect(item({ segments: [seg('a', true), seg('b')] }, 'segments').done).toBe(false)
    expect(item({ segments: [seg('a'), seg('b'), seg('c')] }, 'segments')).toMatchObject({ done: false, progress: '3 segments, no beachhead yet' })
    expect(item({ segments: [seg('a', true), seg('b'), seg('c')] }, 'segments').done).toBe(true)
  })

  it('counts only beachhead interviews, 9 vs 10', () => {
    const segments = [seg('a', true), seg('b')]
    const nine = [...Array(9)].map(() => iv('a'))
    expect(item({ segments, interviews: [...nine, iv('b'), iv(null)] }, 'beachhead-interviews')).toMatchObject({
      done: false,
      progress: '9 of 10 beachhead interviews'
    })
    expect(item({ segments, interviews: [...nine, iv('a'), iv('a')] }, 'beachhead-interviews')).toMatchObject({
      done: true,
      progress: '11 (goal: 10) beachhead interviews'
    })
    expect(item({ segments: [seg('a')] }, 'beachhead-interviews').progress).toBe('Choose a beachhead segment first')
  })

  it('takes the 3 riskiest hypotheses, oldest first on ties', () => {
    const hypotheses = [hyp('low', 0), hyp('high', 5, '2026-01-02'), hyp('high', 5, '2026-01-01'), hyp('medium', 5), hyp('medium', 0, '2026-02-01')]
    expect(item({ hypotheses }, 'riskiest')).toMatchObject({ done: true, progress: '3 of 3 have 5+ interviews' })
    expect(item({ hypotheses: [hyp('high', 5), hyp('high', 4), hyp('low', 9)] }, 'riskiest').done).toBe(false)
    expect(item({ hypotheses: [hyp('high', 9)] }, 'riskiest')).toMatchObject({ done: false, progress: 'Only 1 hypothesis so far' })
  })

  it('needs 60% of beachhead interviews at pain 4+ (exact boundary)', () => {
    const segments = [seg('a', true)]
    const at = (high: number, low: number) => [...Array(high)].map(() => iv('a', 4)).concat([...Array(low)].map(() => iv('a', 2)))
    expect(item({ segments, interviews: at(3, 2) }, 'pain')).toMatchObject({ done: true, progress: '60% of beachhead interviews scored 4+' })
    expect(item({ segments, interviews: at(59, 41) }, 'pain').done).toBe(false)
    expect(item({ segments, interviews: [] }, 'pain')).toMatchObject({ done: false, progress: 'No beachhead interviews yet' })
  })

  it('counts willingness-to-pay signals and a decision with a rationale', () => {
    expect(item({ interviews: [iv(null, null, 'pilot'), iv(null, null, ' '), iv(null, null, 'pre-order')] }, 'wtp').done).toBe(false)
    expect(item({ interviews: [iv(null, null, 'a'), iv(null, null, 'b'), iv(null, null, 'c')] }, 'wtp').done).toBe(true)
    expect(item({ decisions: [{ rationale: '  ' }] }, 'decision').done).toBe(false)
    expect(item({ decisions: [{ rationale: 'Strong pain' }] }, 'decision').done).toBe(true)
  })
})
