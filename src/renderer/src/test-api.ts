// An in-memory stand-in for window.api, for screen tests only.
import { vi } from 'vitest'
import type { Contact, ContactInput, Hypothesis, Insight, InsightInput, Interview, InterviewInput, VentureBundle } from '../../shared/schema'

const T = '2026-11-03T12:00:00.000Z'

export const ventureBundle: VentureBundle = {
  venture: {
    id: 'v1', cohort_id: null, name: 'Campus Eats', pitch: '', problem: '', stage: 1, semester: '',
    status: 'active', created_by: 'Sam', weekly_goal: 3, created_at: T, updated_at: T
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
export const contact = (id: string, name: string): Contact => ({
  id, venture_id: 'v1', segment_id: null, name, email: '', phone: '', role: '', organization: '', source: null, stage: 'identified',
  tags: [], consent_followup: false, notes: '', referred_by: null, deleted_at: null, created_at: T, updated_at: T
})

export const insight = (id: string, text: string, tags: string[]): Insight => ({
  id, interview_id: null, text, tags, is_quote: false, date: null, contact_name: null, created_at: T
})

export function installFakeApi(opts: { hypotheses?: Hypothesis[]; contacts?: Contact[]; insights?: Insight[] } = {}) {
  const saved: Interview[] = []
  const api = {
    getProfile: vi.fn(async () => ({ id: 'p1', full_name: 'Sam', email: null, stage: 1, created_at: T, updated_at: T })),
    getActiveVenture: vi.fn(async () => ventureBundle),
    getAppInfo: vi.fn(async () => ({ version: '0.0.0', dataDir: '/tmp', lastBackupAt: null })),
    onEvent: vi.fn(() => () => {}),
    listContacts: vi.fn(async () => opts.contacts ?? []),
    saveContact: vi.fn(async (input: ContactInput): Promise<Contact> => ({ ...contact(`c-${input.name}`, input.name), referred_by: input.referred_by ?? null })),
    renameTag: vi.fn(async () => 1),
    listInterviews: vi.fn(async () => saved),
    listHypotheses: vi.fn(async () => opts.hypotheses ?? []),
    getHome: vi.fn(async () => ({ goal: 3, thisWeek: 0, streak: 0, tasks: [] })),
    listGuides: vi.fn(async () => []),
    listInsights: vi.fn(async () => opts.insights ?? []),
    saveInsight: vi.fn(async (input: InsightInput): Promise<Insight> => ({
      id: 'n1', interview_id: input.interview_id ?? null, text: input.text, tags: input.tags, is_quote: input.is_quote,
      date: null, contact_name: null, created_at: T
    })),
    getInterview: vi.fn(async (id: string) => saved.find((i) => i.id === id) ?? null),
    saveInterview: vi.fn(async (input: InterviewInput): Promise<Interview> => {
      const row: Interview = {
        id: input.id ?? `00000000-0000-4000-8000-${String(saved.length + 1).padStart(12, '0')}`, venture_id: 'v1', contact_id: input.contact_id, date: input.date,
        type: input.type, format: input.format, interviewers: input.interviewers, notes: input.notes, quotes: input.quotes ?? '',
        pain_score: input.pain_score ?? null, wtp_signal: input.wtp_signal ?? '', next_step: input.next_step ?? '',
        follow_up_date: input.follow_up_date ?? null, deleted_at: null, created_at: T, updated_at: T, contact_name: null,
        evidence: input.evidence ?? []
      }
      saved.push(row)
      return row
    })
  }
  Object.assign(window.api as unknown as Record<string, unknown>, api)
  return api
}
