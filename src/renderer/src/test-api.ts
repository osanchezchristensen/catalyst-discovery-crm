// An in-memory stand-in for window.api, for screen tests only.
import { vi } from 'vitest'
import type { Hypothesis, Interview, InterviewInput, VentureBundle } from '../../shared/schema'

const T = '2026-11-03T12:00:00.000Z'

export const ventureBundle: VentureBundle = {
  venture: {
    id: 'v1', cohort_id: null, name: 'Campus Eats', pitch: '', problem: '', stage: 1, semester: '',
    status: 'active', created_by: 'Sam', created_at: T, updated_at: T
  },
  members: [{ id: 'm1', name: 'Sam', role: 'owner' }],
  segments: []
}

export const hypothesis: Hypothesis = {
  id: '00000000-0000-4000-8000-000000000001', venture_id: 'v1', version: 1, type: 'problem', statement: 'Late-night food arrives cold', risk: 'high',
  status: 'testing', success_criteria: '', created_at: T, updated_at: T,
  tally: { supports: 0, refutes: 0, neutral: 0 }, suggested: 'untested'
}

/**
 * Fills window.api with fresh fakes and returns them so tests can inspect calls.
 * App.tsx reads window.api when its module loads, so tests create the object first (vi.hoisted)
 * and this function replaces its methods in place.
 */
export function installFakeApi(opts: { hypotheses?: Hypothesis[] } = {}) {
  const saved: Interview[] = []
  const api = {
    getProfile: vi.fn(async () => ({ id: 'p1', full_name: 'Sam', email: null, stage: 1, created_at: T, updated_at: T })),
    getActiveVenture: vi.fn(async () => ventureBundle),
    getAppInfo: vi.fn(async () => ({ version: '0.0.0', dataDir: '/tmp', lastBackupAt: null })),
    onEvent: vi.fn(() => () => {}),
    listContacts: vi.fn(async () => []),
    listInterviews: vi.fn(async () => saved),
    listHypotheses: vi.fn(async () => opts.hypotheses ?? []),
    getInterview: vi.fn(async (id: string) => saved.find((i) => i.id === id) ?? null),
    saveInterview: vi.fn(async (input: InterviewInput): Promise<Interview> => {
      const row: Interview = {
        id: input.id ?? `i${saved.length + 1}`, venture_id: 'v1', contact_id: input.contact_id, date: input.date,
        format: input.format, interviewers: input.interviewers, notes: input.notes, quotes: input.quotes ?? '',
        pain_score: input.pain_score ?? null, wtp_signal: input.wtp_signal ?? '', next_step: input.next_step ?? '',
        follow_up_date: input.follow_up_date ?? null, created_at: T, updated_at: T, contact_name: null,
        evidence: input.evidence ?? []
      }
      saved.push(row)
      return row
    })
  }
  Object.assign(window.api as unknown as Record<string, unknown>, api)
  return api
}
