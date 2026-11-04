import type { ContactInput, ContactStage, InterviewInput } from '../../../shared/schema'
import type { CONTACT_SOURCES, INTERVIEW_FORMATS } from '../../../shared/schema'

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
  phone: 'Phone'
}

export const NOTE_FIELDS = [
  { key: 'behavior', label: 'Current behavior', hint: 'What do they do today? Ask about the last time it happened.' },
  { key: 'pains', label: 'Pains', hint: 'What is hard, slow or costly about it?' },
  { key: 'solutions', label: 'Current solutions', hint: 'What have they tried? What do they use now?' },
  { key: 'budget', label: 'Budget and willingness to pay', hint: 'Do they spend money or time on it now?' }
] as const

const pad = (n: number) => String(n).padStart(2, '0')
/** Today's date in the user's time zone, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

export const blankInterview = (): InterviewInput => ({
  contact_id: null,
  date: today(),
  format: 'video',
  interviewers: [],
  notes: { behavior: '', pains: '', solutions: '', budget: '' },
  quotes: '',
  pain_score: null,
  wtp_signal: '',
  next_step: '',
  follow_up_date: null
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
