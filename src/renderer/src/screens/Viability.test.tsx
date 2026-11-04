// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readiness } from '../../../shared/readiness'
import type { Dashboard } from '../../../shared/schema'
import { hypothesis } from '../test-api'
import { Viability } from './Viability'

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(cleanup)

const dashboard: Dashboard = {
  perWeek: [{ week: '2026-10-26', count: 2 }],
  bySegment: [{ segment: 'Freshmen', count: 2 }],
  pain: [1, 2, 3, 4, 5].map((score) => ({ score, all: score === 5 ? 2 : 0, beachhead: score === 5 ? 2 : 0 })),
  hasBeachhead: true,
  hypotheses: [hypothesis],
  decisions: [],
  readiness: readiness({
    segments: [{ id: 's', is_beachhead: true }],
    interviews: [
      { segment_id: 's', pain_score: 5, wtp_signal: '' },
      { segment_id: 's', pain_score: 5, wtp_signal: '' }
    ],
    hypotheses: [],
    decisions: []
  })
}

describe('viability dashboard', () => {
  it('shows checklist progress in words, chart tables, and the scorecard', async () => {
    Object.defineProperty(window, 'api', { value: { getDashboard: vi.fn(async () => dashboard) }, configurable: true })
    render(<Viability onNotify={() => {}} onError={(e) => { throw e }} />)
    expect(await screen.findByText('1 of 6 ready')).toBeTruthy()
    expect(screen.getByText('2 of 10 beachhead interviews')).toBeTruthy()
    expect(screen.getAllByText('Not yet:')).toHaveLength(5)
    // Each chart has a table view for screen readers.
    expect(screen.getByRole('table', { name: 'Pain scores' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Freshmen' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /Late-night food arrives cold/ })).toBeTruthy()
  })
})
