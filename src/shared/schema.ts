// Zod schemas shared by main (the trust boundary) and renderer (types, and early field errors in forms).
// Table schemas mirror the SQL in src/main/db/migrations.ts; a test keeps them in sync.
import { z } from 'zod'
import type { HypothesisStatus, Tally } from './evidence'

const isJson = (s: string): boolean => {
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}

const id = z.uuid()
// Normalize so ISO strings compare correctly as text (used by the import merge rule).
const ts = z.iso.datetime().transform((s) => new Date(s).toISOString())
const date = z.iso.date()
const short = z.string().trim().max(200)
const long = z.string().max(20_000)
const name = short.min(1, 'Required')
const bool = z.union([z.literal(0), z.literal(1)])
const jsonText = z.string().max(100_000).refine(isJson, 'Must be valid JSON')
const stage = z.int().min(1).max(3)
const stamps = { created_at: ts, updated_at: ts }

export const MEMBER_ROLES = ['owner', 'member'] as const
export const VENTURE_STATUSES = ['active', 'paused', 'stopped'] as const
export const CONTACT_SOURCES = ['warm_intro', 'linkedin', 'event', 'cold'] as const
export const CONTACT_STAGES = ['identified', 'reached_out', 'scheduled', 'interviewed', 'follow_up', 'closed'] as const
export const INTERVIEW_FORMATS = ['in_person', 'video', 'phone'] as const
export const HYPOTHESIS_TYPES = ['customer', 'problem', 'solution', 'channel', 'revenue', 'feasibility'] as const
export const RISKS = ['low', 'medium', 'high'] as const
export const HYPOTHESIS_STATUSES = ['untested', 'testing', 'validated', 'invalidated', 'mixed'] as const
export const VERDICTS = ['supports', 'refutes', 'neutral'] as const
export const DECISIONS = ['persevere', 'pivot', 'pause', 'stop'] as const

export const profileRow = z.object({
  id,
  full_name: name,
  email: short.nullable(),
  stage,
  ...stamps
})

// Tables that travel in a workspace file, parents first (insert order for imports).
// shortcut: attachments are left out until Phase 6 copies the files themselves.
export const workspaceTables = {
  cohorts: z.object({
    id, name, semester: short, start_date: date.nullable(), end_date: date.nullable(), settings: jsonText, ...stamps
  }),
  ventures: z.object({
    id, cohort_id: id.nullable(), name, pitch: long, problem: long, stage, semester: short,
    status: z.enum(VENTURE_STATUSES), created_by: short, ...stamps
  }),
  venture_members: z.object({ id, venture_id: id, name, role: z.enum(MEMBER_ROLES), ...stamps }),
  segments: z.object({ id, venture_id: id, name, description: long, is_beachhead: bool, ...stamps }),
  contacts: z.object({
    id, venture_id: id, segment_id: id.nullable(), name, email: short, phone: short, role: short,
    organization: short, source: z.enum(CONTACT_SOURCES).nullable(), stage: z.enum(CONTACT_STAGES),
    tags: jsonText, consent_followup: bool, notes: long, ...stamps
  }),
  interviews: z.object({
    id, venture_id: id, contact_id: id.nullable(), date, format: z.enum(INTERVIEW_FORMATS), interviewers: jsonText,
    notes: jsonText, quotes: long, pain_score: z.int().min(1).max(5).nullable(), wtp_signal: short,
    next_step: long, follow_up_date: date.nullable(), ...stamps
  }),
  hypotheses: z.object({
    id, venture_id: id, version: z.int().min(1), type: z.enum(HYPOTHESIS_TYPES), statement: long.min(1),
    risk: z.enum(RISKS), status: z.enum(HYPOTHESIS_STATUSES), success_criteria: long, ...stamps
  }),
  evidence: z.object({ id, hypothesis_id: id, interview_id: id, verdict: z.enum(VERDICTS), note: long, ...stamps }),
  insights: z.object({
    id, venture_id: id, interview_id: id.nullable(), text: long.min(1), tags: jsonText, is_quote: bool, ...stamps
  }),
  decisions: z.object({
    id, venture_id: id, decision: z.enum(DECISIONS), rationale: long, decided_at: ts, evidence_ids: jsonText, ...stamps
  }),
  tasks: z.object({
    id, venture_id: id, assignee_name: short, title: name, due_date: date.nullable(), done: bool,
    interview_id: id.nullable(), ...stamps
  })
}
export type WorkspaceTable = keyof typeof workspaceTables
export const WORKSPACE_TABLE_NAMES = Object.keys(workspaceTables) as WorkspaceTable[]

export const WORKSPACE_FORMAT = 'catalyst-discovery-crm'
export const WORKSPACE_FORMAT_VERSION = 1
const MAX_ROWS = 100_000

export const workspaceFile = z.object({
  format: z.literal(WORKSPACE_FORMAT, 'This is not a Catalyst Discovery CRM workspace file.'),
  format_version: z.literal(WORKSPACE_FORMAT_VERSION, 'This workspace file was made by a newer version of the app.'),
  schema_version: z.int().min(1),
  workspace_id: id,
  app_version: short,
  exported_at: ts,
  exported_by: short,
  tables: z.object(
    Object.fromEntries(
      WORKSPACE_TABLE_NAMES.map((t) => [t, z.array(workspaceTables[t]).max(MAX_ROWS).default([])])
    ) as { [K in WorkspaceTable]: z.ZodDefault<z.ZodArray<(typeof workspaceTables)[K]>> }
  )
})
export type WorkspaceFile = z.infer<typeof workspaceFile>

// ---- IPC inputs ----
export const profileInput = z.object({
  full_name: name,
  email: z.union([z.email('Enter a valid email or leave it blank'), z.literal('')]).optional(),
  stage
})

export const ventureCreateInput = z.object({
  name,
  pitch: long.default(''),
  problem: long.default(''),
  stage,
  semester: short.default('')
})

export const ventureBundleInput = z
  .object({
    venture: z.object({ id, name, pitch: long, problem: long, stage, semester: short }),
    members: z.array(z.object({ id: id.optional(), name, role: z.enum(MEMBER_ROLES) })).max(50),
    segments: z
      .array(z.object({ id: id.optional(), name, description: long, is_beachhead: z.boolean() }))
      .max(50)
  })
  .refine((b) => b.segments.filter((s) => s.is_beachhead).length <= 1, {
    message: 'Pick only one beachhead segment',
    path: ['segments']
  })

export const importToken = z.uuid()
export const idInput = id

const optionalEmail = z.union([z.email('Enter a valid email or leave it blank'), z.literal('')])
const tagList = z.array(short.min(1)).max(30)

export const contactInput = workspaceTables.contacts
  .pick({ segment_id: true, name: true, phone: true, role: true, organization: true, source: true, stage: true, notes: true })
  .extend({ id: id.optional(), email: optionalEmail, tags: tagList, consent_followup: z.boolean() })

export const contactStageInput = z.object({ id, stage: z.enum(CONTACT_STAGES) })

export const interviewNotes = z.object({ behavior: long, pains: long, solutions: long, budget: long })

export const evidenceItem = workspaceTables.evidence.pick({ hypothesis_id: true, verdict: true, note: true })

export const interviewInput = workspaceTables.interviews
  .pick({ contact_id: true, date: true, format: true, quotes: true, pain_score: true, wtp_signal: true, next_step: true, follow_up_date: true })
  .extend({
    id: id.optional(),
    interviewers: z.array(short.min(1)).max(20),
    notes: interviewNotes,
    evidence: z
      .array(evidenceItem)
      .max(200)
      .refine((e) => new Set(e.map((x) => x.hypothesis_id)).size === e.length, 'Each hypothesis can be linked once')
      .default([])
  })

export const hypothesisInput = workspaceTables.hypotheses
  .pick({ type: true, statement: true, risk: true, status: true, success_criteria: true })
  .extend({ id: id.optional() })

// ---- Types ----
export type Profile = z.infer<typeof profileRow>
export type ProfileInput = z.input<typeof profileInput>
export type VentureCreateInput = z.input<typeof ventureCreateInput>
export type VentureBundleInput = z.input<typeof ventureBundleInput>
export type Venture = z.infer<(typeof workspaceTables)['ventures']>
export type Member = { id: string; name: string; role: (typeof MEMBER_ROLES)[number] }
export type Segment = { id: string; name: string; description: string; is_beachhead: boolean }
export type VentureBundle = { venture: Venture; members: Member[]; segments: Segment[] }

export type ContactStage = (typeof CONTACT_STAGES)[number]
export type ContactInput = z.input<typeof contactInput>
type ContactRow = z.infer<(typeof workspaceTables)['contacts']>
/** A contact as the app uses it: JSON and 0/1 columns decoded. */
export type Contact = Omit<ContactRow, 'tags' | 'consent_followup'> & { tags: string[]; consent_followup: boolean }

export type InterviewNotes = z.infer<typeof interviewNotes>
export type InterviewInput = z.input<typeof interviewInput>
type InterviewRow = z.infer<(typeof workspaceTables)['interviews']>
export type EvidenceItem = z.infer<typeof evidenceItem>
export type Interview = Omit<InterviewRow, 'interviewers' | 'notes'> & {
  interviewers: string[]
  notes: InterviewNotes
  contact_name: string | null
  evidence: EvidenceItem[]
}

export type HypothesisType = (typeof HYPOTHESIS_TYPES)[number]
export type HypothesisInput = z.input<typeof hypothesisInput>
type HypothesisRow = z.infer<(typeof workspaceTables)['hypotheses']>
/** A current-version hypothesis with its evidence tally and the status the evidence suggests. */
export type Hypothesis = HypothesisRow & { tally: Tally; suggested: HypothesisStatus }
/** One interview's verdict on a hypothesis, for the drill-down. */
export type EvidenceLink = EvidenceItem & { interview_id: string; date: string; contact_name: string | null }
