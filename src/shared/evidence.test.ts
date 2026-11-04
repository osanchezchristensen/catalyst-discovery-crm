import { describe, expect, it } from 'vitest'
import { suggestStatus } from './evidence'

const t = (supports: number, refutes: number, neutral = 0) => suggestStatus({ supports, refutes, neutral })

describe('suggestStatus', () => {
  it('is untested with no evidence and testing below 5 decisive interviews', () => {
    expect(t(0, 0)).toBe('untested')
    expect(t(4, 0)).toBe('testing')
    expect(t(1, 1, 2)).toBe('testing')
  })

  it('never lets neutral verdicts count toward the 5', () => {
    expect(t(1, 0, 4)).toBe('testing') // one real data point is not validation
    expect(t(0, 0, 5)).toBe('testing')
    expect(t(4, 0, 9)).toBe('testing')
  })

  it('validates or invalidates at exactly 70% once 5 decisive interviews exist', () => {
    expect(t(7, 3)).toBe('validated')
    expect(t(3, 7)).toBe('invalidated')
    expect(t(5, 0)).toBe('validated')
    expect(t(4, 1, 3)).toBe('validated') // 80%, neutral ignored
  })

  it('is mixed between the thresholds', () => {
    expect(t(6, 4)).toBe('mixed') // 60%
    expect(t(3, 2, 1)).toBe('mixed')
  })
})
