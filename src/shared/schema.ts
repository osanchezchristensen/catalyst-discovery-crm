// Zod schemas shared by main (the trust boundary) and renderer (types, and early field errors in forms).
// Table schemas mirror the SQL in src/main/db/migrations.ts; a test keeps them in sync.
import { z } from 'zod'
import type { HypothesisStatus, Tally } from './evidence'
import { cleanNoteHtml } from './notes'
import type { ReadinessItem } from './readiness'

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
const NOTE_MAX = 50_000 // per interview note, in HTML; tags add length, so it is above `long`
const stage = z.int().min(1).max(3)
const stamps = { created_at: ts, updated_at: ts }

export const MEMBER_ROLES = ['owner', 'member'] as const
export const VENTURE_STATUSES = ['active', 'paused', 'stopped'] as const
export const CONTACT_SOURCES = ['warm_intro', 'linkedin', 'event', 'cold'] as const
export const CONTACT_STAGES = ['identified', 'reached_out', 'scheduled', 'interviewed', 'follow_up', 'closed'] as const
export const INTERVIEW_FORMATS = ['in_person', 'video', 'phone', 'written'] as const
export const INTERVIEW_TYPES = ['informational', 'validation', 'sales'] as const
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
    status: z.enum(VENTURE_STATUSES), created_by: short,
    // Files exported before migration v4 have no weekly_goal.
    weekly_goal: z.int().min(1).max(20).default(3), ...stamps
  }),
  guides: z.object({ id, venture_id: id, name, questions: jsonText, ...stamps }),
  venture_members: z.object({ id, venture_id: id, name, role: z.enum(MEMBER_ROLES), ...stamps }),
  segments: z.object({ id, venture_id: id, name, description: long, is_beachhead: bool, ...stamps }),
  contacts: z.object({
    id, venture_id: id, segment_id: id.nullable(), name, email: short, phone: short, role: short,
    organization: short, source: z.enum(CONTACT_SOURCES).nullable(), stage: z.enum(CONTACT_STAGES),
    tags: jsonText, consent_followup: bool, notes: long,
    // Files exported before migration v7 have no referrer.
    referred_by: id.nullable().default(null), ...stamps
  }),
  interviews: z.object({
    id, venture_id: id, contact_id: id.nullable(), date,
    // Files exported before migration v5 have no type: null here; import keeps the local type or falls back to Validation.
    type: z.enum(INTERVIEW_TYPES).nullable().default(null), format: z.enum(INTERVIEW_FORMATS), interviewers: jsonText,
    // Four HTML notes of up to NOTE_MAX each, plus JSON keys and escaping.
    notes: z.string().max(4 * NOTE_MAX + 10_000).refine(isJson, 'Must be valid JSON'), quotes: long, pain_score: z.int().min(1).max(5).nullable(), wtp_signal: short,
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
  .extend({ id: id.optional(), email: optionalEmail, tags: tagList, consent_followup: z.boolean(), referred_by: id.nullable().default(null) })

export const contactStageInput = z.object({ id, stage: z.enum(CONTACT_STAGES) })

// Notes are HTML (ADR 0006), cleaned at this trust boundary.
const noteHtml = z.string().max(NOTE_MAX, 'This note is too long. Split it or move some of it to an attachment.').transform(cleanNoteHtml)
export const interviewNotes = z.object({ behavior: noteHtml, pains: noteHtml, solutions: noteHtml, budget: noteHtml })

export const evidenceItem = workspaceTables.evidence.pick({ hypothesis_id: true, verdict: true, note: true })

export const interviewInput = workspaceTables.interviews
  .pick({ contact_id: true, date: true, format: true, quotes: true, pain_score: true, wtp_signal: true, next_step: true, follow_up_date: true })
  .extend({
    id: id.optional(),
    type: z.enum(INTERVIEW_TYPES, 'Choose an interview type'), // required for new interviews, unlike imports
    interviewers: z.array(short.min(1)).max(20),
    notes: interviewNotes,
    evidence: z
      .array(evidenceItem)
      .max(200)
      .refine((e) => new Set(e.map((x) => x.hypothesis_id)).size === e.length, 'Each hypothesis can be linked once')
      .default([])
  })

export const decisionInput = z.object({
  decision: z.enum(DECISIONS),
  rationale: long.trim().min(1, 'Explain why you decided this'),
  decided_at: date,
  hypothesis_ids: z
    .array(id)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Each hypothesis can be cited once')
})

export const versionInput = z.int().min(1).optional()

export const CONTACT_FIELDS = ['name', 'email', 'phone', 'role', 'organization', 'tags', 'notes'] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]
/** Column index for each contact field (name required). Checked against the file's width when used. */
export const contactMapping = z.object({
  name: z.int().min(0),
  email: z.int().min(0).nullable(),
  phone: z.int().min(0).nullable(),
  role: z.int().min(0).nullable(),
  organization: z.int().min(0).nullable(),
  tags: z.int().min(0).nullable(),
  notes: z.int().min(0).nullable()
})
export type ContactMapping = z.infer<typeof contactMapping>
export const contactImportRequest = z.object({ token: z.uuid(), mapping: contactMapping, segment_id: id.nullable() })
export type ContactImportRequest = z.infer<typeof contactImportRequest>

/** Where each survey answer column goes: one of the four note sections, or the key quotes. */
export const SURVEY_SECTIONS = ['behavior', 'pains', 'solutions', 'budget', 'quotes'] as const
const col = z.int().min(0)
export const surveyMapping = z.object({
  name: col.nullable(),
  email: col.nullable(),
  date: col.nullable(),
  type: z.enum(INTERVIEW_TYPES),
  answers: z.array(z.object({ col, section: z.enum(SURVEY_SECTIONS) })).max(500)
})
export type SurveyMapping = z.infer<typeof surveyMapping>
export const surveyImportRequest = z.object({ token: z.uuid(), mapping: surveyMapping })
export type SurveyImportRequest = z.infer<typeof surveyImportRequest>

export const exportOptions = z.object({ includeContactDetails: z.boolean() }).optional()
export const confirmNameInput = z.string().max(200)

export type Attachment = { id: string; interview_id: string; file_name: string; mime: string; bytes: number; created_at: string }

export const thresholdsInput = z.object({
  segments: z.int().min(1).max(10),
  beachheadInterviews: z.int().min(1).max(100),
  riskiest: z.int().min(1).max(10),
  interviewsPerHypothesis: z.int().min(1).max(50),
  painScore: z.int().min(1).max(5),
  painShare: z.number().min(0.05).max(1),
  wtpSignals: z.int().min(0).max(50)
})
export type Thresholds = z.infer<typeof thresholdsInput>

export const weeklyGoalInput = z.int('Use a whole number').min(1, 'Aim for at least 1 interview a week').max(20, 'Keep it to 20 or fewer')

export const taskInput = workspaceTables.tasks
  .pick({ title: true, due_date: true, interview_id: true })
  .extend({ id: id.optional(), done: z.boolean() })

/**
 * Rename, merge (rename onto an existing tag) or delete (`to: null`) an insight tag across the venture.
 * `from` matches the tag as stored (imports can carry capitals); the new name is lowercased like splitTags.
 */
export const tagRenameInput = z.object({ from: short.min(1), to: short.min(1).transform((t) => t.toLowerCase()).nullable() })
export type TagRenameInput = z.input<typeof tagRenameInput>

export const insightInput = workspaceTables.insights
  .pick({ interview_id: true, text: true })
  .extend({ id: id.optional(), tags: tagList, is_quote: z.boolean() })

export const guideInput = z.object({
  id: id.optional(),
  name,
  questions: z.array(z.string().trim().min(1).max(500)).max(50)
})

/** A hypothesis as it stood when a decision cited it (stored as JSON in decisions.evidence_ids; imports are untrusted). */
export const hypothesisSnapshot = z.object({
  hypothesis_id: z.string().max(100),
  statement: long,
  status: z.enum(HYPOTHESIS_STATUSES),
  tally: z.object({ supports: z.int().min(0), refutes: z.int().min(0), neutral: z.int().min(0) }),
  version: z.int().min(1)
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

export type InterviewType = (typeof INTERVIEW_TYPES)[number]
export type InterviewNotes = z.infer<typeof interviewNotes>
export type InterviewInput = z.input<typeof interviewInput>
type InterviewRow = z.infer<(typeof workspaceTables)['interviews']>
export type EvidenceItem = z.infer<typeof evidenceItem>
export type Interview = Omit<InterviewRow, 'type' | 'interviewers' | 'notes'> & {
  type: InterviewType
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
export type DecisionKind = (typeof DECISIONS)[number]
export type DecisionInput = z.input<typeof decisionInput>
export type HypothesisSnapshot = z.infer<typeof hypothesisSnapshot>
export type Decision = {
  id: string
  decision: DecisionKind
  rationale: string
  decided_at: string
  hypotheses: HypothesisSnapshot[]
  created_at: string
}

export type TaskInput = z.input<typeof taskInput>
export type Task = { id: string; title: string; due_date: string | null; done: boolean; interview_id: string | null; created_at: string }
export type Home = { goal: number; thisWeek: number; streak: number; tasks: Task[] }

export type InsightInput = z.input<typeof insightInput>
export type Insight = {
  id: string
  interview_id: string | null
  text: string
  tags: string[]
  is_quote: boolean
  date: string | null
  contact_name: string | null
  created_at: string
}

export type GuideInput = z.input<typeof guideInput>
export type Guide = { id: string; name: string; questions: string[]; updated_at: string }

export type Dashboard = {
  topTags: { tag: string; count: number; avgPain: number | null }[]
  perWeek: { week: string; count: number }[]
  bySegment: { segment: string; count: number }[]
  pain: { score: number; all: number; beachhead: number }[]
  hasBeachhead: boolean
  hypotheses: Hypothesis[]
  decisions: Decision[]
  readiness: ReadinessItem[]
}

/** One interview's verdict on a hypothesis, for the drill-down. */
export type EvidenceLink = EvidenceItem & { interview_id: string; date: string; contact_name: string | null }
