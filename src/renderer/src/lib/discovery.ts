import { today } from '../../../shared/dates'
import type { HypothesisStatus, Tally } from '../../../shared/evidence'
import type { ContactInput, ContactStage, DecisionKind, HypothesisType, InterviewInput, InterviewType } from '../../../shared/schema'
import type { CONTACT_SOURCES, INTERVIEW_FORMATS, RISKS, VERDICTS } from '../../../shared/schema'

export const STAGE_LABELS: Record<ContactStage, string> = {
  identified: 'Identified',
  reached_out: 'Reached out',
  scheduled: 'Scheduled',
  interviewed: 'Interviewed',
  follow_up: 'Follow-up',
  closed: 'Closed'
}

export const SOURCE_LABELS: Record<(typeof CONTACT_SOURCES)[number], string> = {
  warm_intro: 'Warm intro',
  linkedin: 'LinkedIn',
  event: 'Event',
  cold: 'Cold'
}

export const FORMAT_LABELS: Record<(typeof INTERVIEW_FORMATS)[number], string> = {
  in_person: 'In person',
  video: 'Video',
  phone: 'Phone',
  written: 'Written response'
}

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, { label: string; hint: string }> = {
  informational: { label: 'Informational', hint: 'Researching the problem. Not counted toward readiness.' },
  validation: { label: 'Validation', hint: 'Finding out whether they would buy it.' },
  sales: { label: 'Sales', hint: 'Trying to sell to them.' }
}

/** An interview being edited: the type starts blank because new interviews must pick one. */
export type InterviewDraft = Omit<InterviewInput, 'type'> & { type: InterviewType | '' }

export const NOTE_FIELDS = [
  { key: 'behavior', label: 'Current behavior', hint: 'What do they do today? Ask about the last time it happened.' },
  { key: 'pains', label: 'Pains', hint: 'What is hard, slow or costly about it?' },
  { key: 'solutions', label: 'Current solutions', hint: 'What have they tried? What do they use now?' },
  { key: 'budget', label: 'Budget and willingness to pay', hint: 'Do they spend money or time on it now?' }
] as const



/** Formats a YYYY-MM-DD date for display (parsed as a local date, so it never shifts a day). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(y, m - 1, d))
}

export const blankContact = (name: string, segment_id: string | null = null): ContactInput => ({
  segment_id,
  name,
  email: '',
  phone: '',
  role: '',
  organization: '',
  source: null,
  stage: 'identified',
  tags: [],
  consent_followup: false,
  notes: ''
})

export const blankInterview = (): InterviewDraft => ({
  contact_id: null,
  date: today(),
  type: '',
  format: 'video',
  interviewers: [],
  notes: { behavior: '', pains: '', solutions: '', budget: '' },
  quotes: '',
  pain_score: null,
  wtp_signal: '',
  next_step: '',
  follow_up_date: null,
  evidence: []
})

/** Zod issues to a field-name → message map (first message per field). */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.map(String).join('.')
    out[key] ??= i.message
  }
  return out
}

export const TYPE_LABELS: Record<HypothesisType, string> = {
  customer: 'Customer',
  problem: 'Problem',
  solution: 'Solution/Value',
  channel: 'Channel',
  revenue: 'Revenue/WTP',
  feasibility: 'Feasibility'
}

export const RISK_LABELS: Record<(typeof RISKS)[number], string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' }

export const STATUS_LABELS: Record<HypothesisStatus, string> = {
  untested: 'Untested',
  testing: 'Testing',
  validated: 'Validated',
  invalidated: 'Invalidated',
  mixed: 'Mixed'
}

export const VERDICT_LABELS: Record<(typeof VERDICTS)[number], string> = {
  supports: 'Supports',
  refutes: 'Refutes',
  neutral: 'Neutral'
}

export const tallyText = ({ supports, refutes, neutral }: Tally) =>
  `${supports} support · ${refutes} refute · ${neutral} neutral`

export const DECISION_LABELS: Record<DecisionKind, string> = {
  persevere: 'Persevere',
  pivot: 'Pivot',
  pause: 'Pause',
  stop: 'Stop'
}

export const DECISION_HELP: Record<DecisionKind, string> = {
  persevere: 'The evidence holds. Keep going.',
  pivot: 'Change a key assumption and test again.',
  pause: 'Step back for now.',
  stop: 'The evidence says no. End this venture.'
}

export { today }
