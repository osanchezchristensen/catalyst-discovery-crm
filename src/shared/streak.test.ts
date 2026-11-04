import { describe, expect, it } from 'vitest'
import { addDays, weekStart } from './dates'
import { streak } from './streak'

const weeks = (entries: [string, number][]) => new Map(entries)

describe('dates', () => {
  it('weeks start on Monday, across month and year boundaries', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-02') // Monday
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
    expect(addDays('2026-03-28', 7)).toBe('2026-04-04') // across a DST change in many zones
  })
})

describe('streak', () => {
  const thisWeek = '2026-11-02'
  it('counts past weeks while this week is still in progress', () => {
    expect(streak(weeks([['2026-10-26', 3], ['2026-10-19', 4], ['2026-11-02', 1]]), 3, thisWeek)).toBe(2)
  })

  it('adds this week once the goal is met', () => {
    expect(streak(weeks([['2026-10-26', 3], ['2026-11-02', 3]]), 3, thisWeek)).toBe(2)
  })

  it('stops at a gap week and is 0 with no history', () => {
    expect(streak(weeks([['2026-10-26', 3], ['2026-10-12', 5]]), 3, thisWeek)).toBe(1)
    expect(streak(weeks([]), 3, thisWeek)).toBe(0)
  })

  it('judges past weeks against the current goal', () => {
    const w = weeks([['2026-10-26', 3], ['2026-10-19', 3]])
    expect(streak(w, 3, thisWeek)).toBe(2)
    expect(streak(w, 4, thisWeek)).toBe(0)
  })
})
