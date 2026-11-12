// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readiness } from '../../../shared/readiness'
import type { Dashboard } from '../../../shared/schema'
import { hypothesis, insight, ventureBundle } from '../test-api'
import { SummaryDialog } from '@/components/SummaryDialog'
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
  topTags: [],
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
    render(<Viability onSummary={() => {}} onNotify={() => {}} onError={(e) => { throw e }} />)
    expect(await screen.findByText('1 of 6 ready')).toBeTruthy()
    expect(screen.getByText('2 of 10 beachhead interviews')).toBeTruthy()
    expect(screen.getAllByText('Not yet:')).toHaveLength(5)
    // Each chart has a table view for screen readers.
    expect(screen.getByRole('table', { name: 'Pain scores' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Freshmen' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /Late-night food arrives cold/ })).toBeTruthy()
  })
})

describe('summary PDF', () => {
  it('shows the venture, riskiest hypotheses, up to three quotes and the latest decision, then saves', async () => {
    const quotes = ['a', 'b', 'c', 'd'].map((t) => ({ ...insight(t, `Quote ${t}`, []), is_quote: true }))
    const low = { ...hypothesis, id: 'h-low', risk: 'low' as const, statement: 'Low risk one' }
    const saveSummaryPdf = vi.fn(async () => ({ path: '/docs/summary.pdf' }))
    Object.defineProperty(window, 'api', {
      value: {
        getDashboard: vi.fn(async () => ({ ...dashboard, hypotheses: [low, hypothesis] })),
        listInsights: vi.fn(async () => [insight('n', 'Not a quote', []), ...quotes]),
        saveSummaryPdf
      },
      configurable: true
    })
    const onNotify = vi.fn()
    render(<SummaryDialog bundle={ventureBundle} onClose={() => {}} onNotify={onNotify} onError={(e) => { throw e }} />)
    // The preview and the print-only copy both render the sheet.
    expect((await screen.findAllByRole('heading', { name: ventureBundle.venture.name, level: 1 })).length).toBe(2)
    expect(screen.getAllByText(/Quote [abcd]/).map((q) => q.textContent)).toEqual(['“Quote a”', '“Quote b”', '“Quote c”', '“Quote a”', '“Quote b”', '“Quote c”'])
    expect(screen.queryByText(/Not a quote/)).toBeNull()
    const statements = screen.getAllByText(/Late-night food arrives cold|Low risk one/).slice(0, 2).map((e) => e.textContent)
    expect(statements[1]).toBe('Low risk one') // high risk first
    expect(screen.getAllByText('No decision recorded yet.')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }))
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('Summary saved to /docs/summary.pdf'))
  })
})
