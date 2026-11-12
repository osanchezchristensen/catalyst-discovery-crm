import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { z } from 'zod'
import { suggestStatus, type Tally } from '../../shared/evidence'
import { addDays, today, weekStart } from '../../shared/dates'
import { DEFAULT_THRESHOLDS, readiness } from '../../shared/readiness'
import { streak } from '../../shared/streak'
import { hypothesisSnapshot, thresholdsInput, type Thresholds } from '../../shared/schema'
import type {
  Contact,
  ContactStage,
  contactInput,
  Dashboard,
  Decision,
  Guide,
  guideInput,
  Home,
  Insight,
  insightInput,
  tagRenameInput,
  Task,
  taskInput,
  decisionInput,
  DecisionKind,
  EvidenceItem,
  EvidenceLink,
  Hypothesis,
  hypothesisInput,
  HypothesisSnapshot,
  Interview,
  interviewInput,
  Member,
  Profile,
  ProfileInput,
  Segment,
  Venture,
  VentureBundle,
  VentureBundleInput,
  VentureCreateInput
} from '../../shared/schema'

type DB = Database.Database
const now = () => new Date().toISOString()

export function getMeta(db: DB, key: string): string | null {
  return (db.prepare('SELECT value FROM meta WHERE key = ?').pluck().get(key) as string | undefined) ?? null
}

export function setMeta(db: DB, key: string, value: string): void {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

/** The workspace id identifies this install's data in exports. */
export function ensureWorkspaceId(db: DB): string {
  const existing = getMeta(db, 'workspace_id')
  if (existing) return existing
  const id = randomUUID()
  setMeta(db, 'workspace_id', id)
  return id
}

// ---- Profile (single local user) ----
export function getProfile(db: DB): Profile | null {
  return (db.prepare('SELECT * FROM profiles ORDER BY created_at LIMIT 1').get() as Profile | undefined) ?? null
}

export function saveProfile(db: DB, input: ProfileInput): Profile {
  const existing = getProfile(db)
  const t = now()
  // Leaving email out keeps the stored one; an empty string clears it.
  const email = input.email === undefined ? (existing?.email ?? null) : input.email || null
  if (existing) {
    db.prepare('UPDATE profiles SET full_name = ?, email = ?, stage = ?, updated_at = ? WHERE id = ?').run(
      input.full_name, email, input.stage, t, existing.id
    )
  } else {
    db.prepare(
      "INSERT INTO profiles (id, full_name, email, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), input.full_name, email, input.stage, t, t)
  }
  return getProfile(db)!
}

// ---- Venture ----
function loadBundle(db: DB, ventureId: string): VentureBundle | null {
  const venture = db.prepare('SELECT * FROM ventures WHERE id = ?').get(ventureId) as Venture | undefined
  if (!venture) return null
  const members = db
    .prepare('SELECT id, name, role FROM venture_members WHERE venture_id = ? ORDER BY created_at, rowid')
    .all(ventureId) as Member[]
  const segments = (
    db
      .prepare('SELECT id, name, description, is_beachhead FROM segments WHERE venture_id = ? ORDER BY created_at, rowid')
      .all(ventureId) as (Omit<Segment, 'is_beachhead'> & { is_beachhead: number })[]
  ).map((s) => ({ ...s, is_beachhead: s.is_beachhead === 1 }))
  return { venture, members, segments }
}

/** The venture the app opens: the one marked active, else the oldest. */
export function activeVentureId(db: DB): string | null {
  const active = getMeta(db, 'active_venture_id')
  if (active && db.prepare('SELECT 1 FROM ventures WHERE id = ?').get(active)) return active
  return (db.prepare('SELECT id FROM ventures ORDER BY created_at LIMIT 1').pluck().get() as string | undefined) ?? null
}

export function getActiveVenture(db: DB): VentureBundle | null {
  const id = activeVentureId(db)
  return id ? loadBundle(db, id) : null
}

function requireVenture(db: DB): string {
  const id = activeVentureId(db)
  if (!id) throw new Error('Set up your venture first.')
  return id
}

export function createVenture(db: DB, input: Required<VentureCreateInput>, createdBy: string): VentureBundle {
  const id = randomUUID()
  const t = now()
  db.transaction(() => {
    db.prepare(
      `INSERT INTO ventures (id, cohort_id, name, pitch, problem, stage, semester, status, created_by, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(id, input.name, input.pitch, input.problem, input.stage, input.semester, createdBy, t, t)
    if (createdBy) {
      db.prepare(
        "INSERT INTO venture_members (id, venture_id, name, role, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?)"
      ).run(randomUUID(), id, createdBy, t, t)
    }
    setMeta(db, 'active_venture_id', id)
  })()
  return loadBundle(db, id)!
}

/**
 * Saves the venture and replaces its members and segments as a set.
 * Rows keep their ids (so contacts keep their segment); rows left out are deleted.
 */
export function saveVenture(db: DB, input: VentureBundleInput): VentureBundle {
  const { venture: v } = input
  const t = now()
  db.transaction(() => {
    // Like every other write, only the open venture may change.
    if (v.id !== activeVentureId(db)) throw new Error('That venture no longer exists. Reload and try again.')
    db.prepare('UPDATE ventures SET name = ?, pitch = ?, problem = ?, stage = ?, semester = ?, updated_at = ? WHERE id = ?').run(
      v.name,
      v.pitch,
      v.problem,
      v.stage,
      v.semester,
      t,
      v.id
    )

    replaceChildren(db, 'venture_members', v.id, input.members, ['name', 'role'], t)
    replaceChildren(
      db,
      'segments',
      v.id,
      input.segments.map((s) => ({ ...s, is_beachhead: s.is_beachhead ? 1 : 0 })),
      ['name', 'description', 'is_beachhead'],
      t
    )
  })()
  return loadBundle(db, v.id)!
}

// table and column names come from this file only, never from input.
function replaceChildren(
  db: DB,
  table: 'venture_members' | 'segments',
  ventureId: string,
  rows: ({ id?: string } & Record<string, unknown>)[],
  cols: string[],
  t: string
): void {
  const keepIds = rows.map((r) => r.id).filter((id): id is string => !!id)
  const existing = new Set(
    db.prepare(`SELECT id FROM ${table} WHERE venture_id = ?`).pluck().all(ventureId) as string[]
  )
  const del = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
  for (const id of existing) if (!keepIds.includes(id)) del.run(id)

  const update = db.prepare(
    `UPDATE ${table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @t WHERE id = @id AND venture_id = @ventureId`
  )
  const insert = db.prepare(
    `INSERT INTO ${table} (id, venture_id, ${cols.join(', ')}, created_at, updated_at)
     VALUES (@id, @ventureId, ${cols.map((c) => `@${c}`).join(', ')}, @t, @t)`
  )
  for (const row of rows) {
    const params = { ...Object.fromEntries(cols.map((c) => [c, row[c]])), t, ventureId }
    if (row.id && existing.has(row.id)) update.run({ ...params, id: row.id })
    else insert.run({ ...params, id: randomUUID() })
  }
}

// ---- Contacts (F3) and interviews (F4), always scoped to the active venture ----
type ContactSave = z.output<typeof contactInput>
type InterviewSave = z.output<typeof interviewInput>

/** Imported rows may hold any valid JSON, so decode defensively. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function decodeContact(row: Record<string, unknown>): Contact {
  return { ...(row as Contact), tags: strings(parseJson(row.tags as string)), consent_followup: row.consent_followup === 1 }
}

function decodeInterview(row: Record<string, unknown>, evidence: EvidenceItem[]): Interview {
  const n = parseJson(row.notes as string)
  const o = n && typeof n === 'object' ? (n as Record<string, unknown>) : {}
  const text = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    ...(row as Interview),
    interviewers: strings(parseJson(row.interviewers as string)),
    notes: { behavior: text('behavior'), pains: text('pains'), solutions: text('solutions'), budget: text('budget') },
    evidence
  }
}

function assertInVenture(db: DB, table: 'segments' | 'contacts' | 'interviews', id: string | null, ventureId: string, what: string) {
  if (id && !db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND venture_id = ?`).get(id, ventureId)) {
    throw new Error(`That ${what} no longer exists. Reload and try again.`)
  }
}

export function listContacts(db: DB): Contact[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db.prepare('SELECT * FROM contacts WHERE venture_id = ? ORDER BY created_at, rowid').all(v)
  return (rows as Record<string, unknown>[]).map(decodeContact)
}

export function saveContact(db: DB, input: ContactSave): Contact {
  const v = requireVenture(db)
  assertInVenture(db, 'segments', input.segment_id, v, 'segment')
  assertInVenture(db, 'contacts', input.referred_by, v, 'referrer')
  if (input.id && input.referred_by) {
    if (input.referred_by === input.id) throw new Error('A contact can’t refer themselves.')
    // Walk up from the new referrer; reaching this contact would make a loop. Bounded by the number of contacts.
    const up = db.prepare('SELECT referred_by FROM contacts WHERE id = ?').pluck()
    for (let at: string | null = input.referred_by, n = 0; at && n < 10_000; at = up.get(at) as string | null, n++) {
      if (at === input.id) throw new Error('That would make a referral loop. Pick someone they didn’t refer.')
    }
  }
  const t = now()
  const p = { ...input, tags: JSON.stringify(input.tags), consent_followup: input.consent_followup ? 1 : 0, v, t }
  let id = input.id
  if (id) {
    const changed = db
      .prepare(
        `UPDATE contacts SET segment_id = @segment_id, name = @name, email = @email, phone = @phone, role = @role,
         organization = @organization, source = @source, stage = @stage, tags = @tags,
         consent_followup = @consent_followup, notes = @notes, referred_by = @referred_by, updated_at = @t
         WHERE id = @id AND venture_id = @v`
      )
      .run(p).changes
    if (!changed) throw new Error('That contact no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare(
      `INSERT INTO contacts (id, venture_id, segment_id, name, email, phone, role, organization, source, stage, tags,
       consent_followup, notes, referred_by, created_at, updated_at)
       VALUES (@id, @v, @segment_id, @name, @email, @phone, @role, @organization, @source, @stage, @tags,
       @consent_followup, @notes, @referred_by, @t, @t)`
    ).run({ ...p, id })
  }
  return decodeContact(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown>)
}

export function setContactStage(db: DB, input: { id: string; stage: ContactStage }): void {
  const changed = db
    .prepare('UPDATE contacts SET stage = ?, updated_at = ? WHERE id = ? AND venture_id = ?')
    .run(input.stage, now(), input.id, requireVenture(db)).changes
  if (!changed) throw new Error('That contact no longer exists. Reload and try again.')
}

/** Deletes the contact (consent requests). Its interviews stay, with no contact (FK ON DELETE SET NULL). */
export function deleteContact(db: DB, id: string): void {
  db.prepare('DELETE FROM contacts WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

const INTERVIEW_SELECT = `SELECT i.*, c.name AS contact_name FROM interviews i LEFT JOIN contacts c ON c.id = i.contact_id`

export function listInterviews(db: DB): Interview[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db.prepare(`${INTERVIEW_SELECT} WHERE i.venture_id = ? ORDER BY i.date DESC, i.created_at DESC`).all(v)
  // One query for all evidence, grouped by interview, instead of one query per interview.
  const byInterview = new Map<string, EvidenceItem[]>()
  const links = db
    .prepare(
      `SELECT e.interview_id, e.hypothesis_id, e.verdict, e.note FROM evidence e
       JOIN interviews i ON i.id = e.interview_id WHERE i.venture_id = ? ORDER BY e.created_at, e.rowid`
    )
    .all(v) as (EvidenceItem & { interview_id: string })[]
  for (const { interview_id, ...item } of links) byInterview.set(interview_id, [...(byInterview.get(interview_id) ?? []), item])
  return (rows as Record<string, unknown>[]).map((r) => decodeInterview(r, byInterview.get(r.id as string) ?? []))
}

const evidenceOf = (db: DB, interviewId: string) =>
  db
    .prepare('SELECT hypothesis_id, verdict, note FROM evidence WHERE interview_id = ? ORDER BY created_at, rowid')
    .all(interviewId) as EvidenceItem[]

export function getInterview(db: DB, id: string): Interview | null {
  const row = db.prepare(`${INTERVIEW_SELECT} WHERE i.id = ? AND i.venture_id = ?`).get(id, requireVenture(db))
  return row ? decodeInterview(row as Record<string, unknown>, evidenceOf(db, id)) : null
}

/** Replaces one interview's evidence as a set: one row per hypothesis; unchanged rows keep their timestamps. */
function replaceEvidence(db: DB, interviewId: string, items: EvidenceItem[], ventureId: string, t: string) {
  const allowed = new Set(db.prepare('SELECT id FROM hypotheses WHERE venture_id = ?').pluck().all(ventureId) as string[])
  for (const e of items) {
    if (!allowed.has(e.hypothesis_id)) throw new Error('That hypothesis no longer exists. Reload and try again.')
  }
  const existing = new Map(
    (db.prepare('SELECT id, hypothesis_id, verdict, note FROM evidence WHERE interview_id = ?').all(interviewId) as (EvidenceItem & {
      id: string
    })[]).map((e) => [e.hypothesis_id, e])
  )
  const keep = new Set(items.map((e) => e.hypothesis_id))
  const del = db.prepare('DELETE FROM evidence WHERE id = ?')
  for (const [hyp, e] of existing) if (!keep.has(hyp)) del.run(e.id)
  const update = db.prepare('UPDATE evidence SET verdict = ?, note = ?, updated_at = ? WHERE id = ?')
  const insert = db.prepare(
    'INSERT INTO evidence (id, hypothesis_id, interview_id, verdict, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  for (const e of items) {
    const old = existing.get(e.hypothesis_id)
    if (!old) insert.run(randomUUID(), e.hypothesis_id, interviewId, e.verdict, e.note, t, t)
    else if (old.verdict !== e.verdict || old.note !== e.note) update.run(e.verdict, e.note, t, old.id)
  }
}

const BEFORE_INTERVIEWED: ContactStage[] = ['identified', 'reached_out', 'scheduled']

/** Creates or updates an interview. Logging one moves its contact to Interviewed (PRD flow 2). */
export function saveInterview(db: DB, input: InterviewSave): Interview {
  const v = requireVenture(db)
  assertInVenture(db, 'contacts', input.contact_id, v, 'contact')
  const t = now()
  const p = { ...input, interviewers: JSON.stringify(input.interviewers), notes: JSON.stringify(input.notes), v, t }
  let id = input.id
  db.transaction(() => {
    if (id) {
      const changed = db
        .prepare(
          `UPDATE interviews SET contact_id = @contact_id, date = @date, type = @type, format = @format, interviewers = @interviewers,
           notes = @notes, quotes = @quotes, pain_score = @pain_score, wtp_signal = @wtp_signal, next_step = @next_step,
           follow_up_date = @follow_up_date, updated_at = @t WHERE id = @id AND venture_id = @v`
        )
        .run(p).changes
      if (!changed) throw new Error('That interview no longer exists. Reload and try again.')
    } else {
      id = randomUUID()
      db.prepare(
        `INSERT INTO interviews (id, venture_id, contact_id, date, type, format, interviewers, notes, quotes, pain_score,
         wtp_signal, next_step, follow_up_date, created_at, updated_at)
         VALUES (@id, @v, @contact_id, @date, @type, @format, @interviewers, @notes, @quotes, @pain_score, @wtp_signal,
         @next_step, @follow_up_date, @t, @t)`
      ).run({ ...p, id })
    }
    if (input.contact_id) {
      db.prepare(
        `UPDATE contacts SET stage = 'interviewed', updated_at = ? WHERE id = ? AND stage IN (${BEFORE_INTERVIEWED.map(() => '?').join(', ')})`
      ).run(t, input.contact_id, ...BEFORE_INTERVIEWED)
    }
    replaceEvidence(db, id!, input.evidence, v, t)
  })()
  return getInterview(db, id!)!
}

export function deleteInterview(db: DB, id: string): void {
  db.prepare('DELETE FROM interviews WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

// ---- Hypotheses (F5) and evidence drill-down (F6) ----
type HypothesisSave = z.output<typeof hypothesisInput>

const currentVersion = (db: DB, ventureId: string) =>
  (db.prepare('SELECT MAX(version) FROM hypotheses WHERE venture_id = ?').pluck().get(ventureId) as number | null) ?? 1

/** One version's hypotheses (default: the current one), each with its evidence tally and suggested status. */
export function listHypotheses(db: DB, version?: number): Hypothesis[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db
    .prepare(
      `SELECT h.*,
         COALESCE(SUM(e.verdict = 'supports'), 0) AS supports,
         COALESCE(SUM(e.verdict = 'refutes'), 0) AS refutes,
         COALESCE(SUM(e.verdict = 'neutral'), 0) AS neutral
       FROM hypotheses h LEFT JOIN evidence e ON e.hypothesis_id = h.id
       WHERE h.venture_id = ? AND h.version = ?
       GROUP BY h.id ORDER BY h.created_at, h.rowid`
    )
    .all(v, version ?? currentVersion(db, v)) as (Omit<Hypothesis, 'tally' | 'suggested'> & Tally)[]
  return rows.map(({ supports, refutes, neutral, ...h }) => {
    const tally = { supports, refutes, neutral }
    return { ...h, tally, suggested: suggestStatus(tally) }
  })
}

export function saveHypothesis(db: DB, input: HypothesisSave): Hypothesis {
  const v = requireVenture(db)
  const t = now()
  let id = input.id
  if (id) {
    const changed = db
      .prepare(
        `UPDATE hypotheses SET type = @type, statement = @statement, risk = @risk, status = @status,
         success_criteria = @success_criteria, updated_at = @t WHERE id = @id AND venture_id = @v`
      )
      .run({ ...input, t, v }).changes
    if (!changed) throw new Error('That hypothesis no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare(
      `INSERT INTO hypotheses (id, venture_id, version, type, statement, risk, status, success_criteria, created_at, updated_at)
       VALUES (@id, @v, @version, @type, @statement, @risk, @status, @success_criteria, @t, @t)`
    ).run({ ...input, id, v, t, version: currentVersion(db, v) })
  }
  const version = db.prepare('SELECT version FROM hypotheses WHERE id = ?').pluck().get(id) as number
  return listHypotheses(db, version).find((h) => h.id === id)!
}

/** Hypothesis versions that exist (a pivot starts a new one), oldest first. */
export function listHypothesisVersions(db: DB): number[] {
  const v = activeVentureId(db)
  if (!v) return []
  return db.prepare('SELECT DISTINCT version FROM hypotheses WHERE venture_id = ? ORDER BY version').pluck().all(v) as number[]
}

/** Deletes a hypothesis; its evidence links go with it (FK ON DELETE CASCADE). */
export function deleteHypothesis(db: DB, id: string): void {
  db.prepare('DELETE FROM hypotheses WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

const STARTERS: Omit<HypothesisSave, 'id'>[] = [
  {
    type: 'customer',
    statement: '[Who] struggle with [problem] at least once a week.',
    risk: 'high',
    status: 'untested',
    success_criteria: '7 of 10 beachhead interviews describe this problem without prompting.'
  },
  {
    type: 'problem',
    statement: '[Who] handle [problem] today with [workaround], and it costs them time or money.',
    risk: 'high',
    status: 'untested',
    success_criteria: 'Most interviews name a workaround and what it costs them.'
  },
  {
    type: 'solution',
    statement: '[Who] would switch to [our solution] because it [main benefit].',
    risk: 'medium',
    status: 'untested',
    success_criteria: 'At least 3 interviews end with a pilot, pre-order or intro.'
  }
]

/** Adds three fill-in-the-blank hypotheses (PRD onboarding flow). */
export function addStarterHypotheses(db: DB): Hypothesis[] {
  db.transaction(() => {
    for (const s of STARTERS) saveHypothesis(db, s)
  })()
  return listHypotheses(db)
}

/** Every interview's verdict on one hypothesis, newest first. */
export function listEvidence(db: DB, hypothesisId: string): EvidenceLink[] {
  return db
    .prepare(
      `SELECT e.hypothesis_id, e.verdict, e.note, e.interview_id, i.date, c.name AS contact_name
       FROM evidence e JOIN interviews i ON i.id = e.interview_id LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE e.hypothesis_id = ? AND i.venture_id = ? ORDER BY i.date DESC, i.created_at DESC`
    )
    .all(hypothesisId, requireVenture(db)) as EvidenceLink[]
}

// ---- Decisions (F8) and the viability dashboard (F7) ----
type DecisionSave = z.output<typeof decisionInput>

const VENTURE_STATUS: Record<DecisionKind, 'active' | 'paused' | 'stopped'> = {
  persevere: 'active',
  pivot: 'active',
  pause: 'paused',
  stop: 'stopped'
}

/** Imported files may hold anything in evidence_ids; keep only snapshots that pass the schema. */
export function decodeSnapshots(text: string): HypothesisSnapshot[] {
  const raw = parseJson(text)
  if (!Array.isArray(raw)) return []
  return raw.flatMap((s) => {
    const r = hypothesisSnapshot.safeParse(s)
    return r.success ? [r.data] : []
  })
}

export function listDecisions(db: DB): Decision[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db
    .prepare('SELECT * FROM decisions WHERE venture_id = ? ORDER BY decided_at DESC, created_at DESC')
    .all(v) as (Omit<Decision, 'hypotheses'> & { evidence_ids: string })[]
  return rows.map(({ evidence_ids, id, decision, rationale, decided_at, created_at }) => ({
    id,
    decision,
    rationale,
    decided_at,
    created_at,
    hypotheses: decodeSnapshots(evidence_ids)
  }))
}

/**
 * Records a decision with snapshots of the hypotheses it cites, sets the venture status, and on a
 * pivot copies the current hypotheses into a new version (Untested; evidence stays with the old one).
 */
export function recordDecision(db: DB, input: DecisionSave): Decision {
  const v = requireVenture(db)
  const current = new Map(listHypotheses(db).map((h) => [h.id, h]))
  const snapshots: HypothesisSnapshot[] = input.hypothesis_ids.map((hid) => {
    const h = current.get(hid)
    if (!h) throw new Error('That hypothesis no longer exists. Reload and try again.')
    return { hypothesis_id: h.id, statement: h.statement, status: h.status, tally: h.tally, version: h.version }
  })
  const t = now()
  const id = randomUUID()
  db.transaction(() => {
    db.prepare(
      `INSERT INTO decisions (id, venture_id, decision, rationale, decided_at, evidence_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, v, input.decision, input.rationale, `${input.decided_at}T12:00:00.000Z`, JSON.stringify(snapshots), t, t)
    db.prepare('UPDATE ventures SET status = ?, updated_at = ? WHERE id = ?').run(VENTURE_STATUS[input.decision], t, v)
    if (input.decision === 'pivot' && current.size) {
      const next = currentVersion(db, v) + 1
      const copy = db.prepare(
        `INSERT INTO hypotheses (id, venture_id, version, type, statement, risk, status, success_criteria, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'untested', ?, ?, ?)`
      )
      for (const h of current.values()) copy.run(randomUUID(), v, next, h.type, h.statement, h.risk, h.success_criteria, t, t)
    }
  })()
  return listDecisions(db).find((d) => d.id === id)!
}

/** Removes a decision recorded by mistake. A pivot's hypothesis copies stay. */
export function deleteDecision(db: DB, id: string): void {
  db.prepare('DELETE FROM decisions WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

const MAX_WEEKS = 26

export function getDashboard(db: DB): Dashboard {
  const v = activeVentureId(db)
  const segments = v
    ? (db.prepare('SELECT id, name, is_beachhead FROM segments WHERE venture_id = ?').all(v) as {
        id: string
        name: string
        is_beachhead: number
      }[]).map((s) => ({ ...s, is_beachhead: s.is_beachhead === 1 }))
    : []
  const interviews = v
    ? (db
        .prepare(
          `SELECT i.date, i.type, i.pain_score, i.wtp_signal, c.segment_id FROM interviews i
           LEFT JOIN contacts c ON c.id = i.contact_id WHERE i.venture_id = ?`
        )
        .all(v) as { date: string; type: string; pain_score: number | null; wtp_signal: string; segment_id: string | null }[])
    : []
  const beachhead = segments.find((s) => s.is_beachhead)

  // Every week up to the latest interview, empty ones included so gaps show. Capped at
  // MAX_WEEKS and never past this week, so a mistyped year (2062) can't create thousands of bars.
  const thisWeek = weekStart(today())
  const counts = new Map<string, number>()
  for (const i of interviews) counts.set(weekStart(i.date), (counts.get(weekStart(i.date)) ?? 0) + 1)
  const weeks = [...counts.keys()].filter((w) => w <= thisWeek).sort()
  const last = weeks[weeks.length - 1]
  const earliest = last && addDays(last, -7 * (MAX_WEEKS - 1))
  const perWeek: Dashboard['perWeek'] = []
  for (let w = last && (weeks[0] > earliest ? weeks[0] : earliest); w && w <= last; w = addDays(w, 7)) {
    perWeek.push({ week: w, count: counts.get(w) ?? 0 })
  }

  const segmentName = new Map(segments.map((s) => [s.id, s.name]))
  const bySegmentMap = new Map<string, number>()
  for (const i of interviews) {
    const name = (i.segment_id && segmentName.get(i.segment_id)) || 'No segment'
    bySegmentMap.set(name, (bySegmentMap.get(name) ?? 0) + 1)
  }
  const bySegment = [...bySegmentMap].map(([segment, count]) => ({ segment, count })).sort((a, b) => b.count - a.count)

  const pain = [1, 2, 3, 4, 5].map((score) => ({
    score,
    all: interviews.filter((i) => i.pain_score === score).length,
    beachhead: interviews.filter((i) => i.pain_score === score && !!beachhead && i.segment_id === beachhead.id).length
  }))

  const hypotheses = listHypotheses(db)
  const decisions = listDecisions(db)
  // Readiness doesn't count Informational interviews (backlog #3); the charts above and the board's tallies do.
  const counted = new Map(
    (db
      .prepare(
        `SELECT e.hypothesis_id, COUNT(*) AS n FROM evidence e JOIN interviews i ON i.id = e.interview_id
         WHERE i.venture_id = ? AND i.type != 'informational' GROUP BY e.hypothesis_id`
      )
      .all(v ?? '') as { hypothesis_id: string; n: number }[]).map((r) => [r.hypothesis_id, r.n])
  )
  const readinessInput = {
    segments,
    interviews: interviews.filter((i) => i.type !== 'informational'),
    // readiness only reads the tally's total, so the counted links go in one bucket.
    hypotheses: hypotheses.map((h) => ({ ...h, tally: { supports: counted.get(h.id) ?? 0, refutes: 0, neutral: 0 } })),
    decisions
  }
  return {
    perWeek,
    bySegment,
    pain,
    hasBeachhead: !!beachhead,
    hypotheses,
    decisions,
    readiness: readiness(readinessInput, getThresholds(db)),
    topTags: v ? topTags(db, v) : []
  }
}

// ---- Follow-ups and the weekly goal (F12) ----
type TaskSave = z.output<typeof taskInput>

const decodeTask = (r: Record<string, unknown>): Task => ({
  id: r.id as string,
  title: r.title as string,
  due_date: r.due_date as string | null,
  done: r.done === 1,
  interview_id: r.interview_id as string | null,
  created_at: r.created_at as string
})

/** Open tasks first, then by due date (undated last). */
export function listTasks(db: DB): Task[] {
  const v = activeVentureId(db)
  if (!v) return []
  return (
    db
      .prepare('SELECT * FROM tasks WHERE venture_id = ? ORDER BY done, due_date IS NULL, due_date, created_at')
      .all(v) as Record<string, unknown>[]
  ).map(decodeTask)
}

export function saveTask(db: DB, input: TaskSave): Task {
  const v = requireVenture(db)
  assertInVenture(db, 'interviews', input.interview_id, v, 'interview')
  const t = now()
  const p = { ...input, done: input.done ? 1 : 0, v, t }
  let id = input.id
  if (id) {
    const changed = db
      .prepare(
        'UPDATE tasks SET title = @title, due_date = @due_date, done = @done, interview_id = @interview_id, updated_at = @t WHERE id = @id AND venture_id = @v'
      )
      .run(p).changes
    if (!changed) throw new Error('That follow-up no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare(
      `INSERT INTO tasks (id, venture_id, assignee_name, title, due_date, done, interview_id, created_at, updated_at)
       VALUES (@id, @v, '', @title, @due_date, @done, @interview_id, @t, @t)`
    ).run({ ...p, id })
  }
  return decodeTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown>)
}

export function deleteTask(db: DB, id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

export function setWeeklyGoal(db: DB, goal: number): void {
  db.prepare('UPDATE ventures SET weekly_goal = ?, updated_at = ? WHERE id = ?').run(goal, now(), requireVenture(db))
}

/** What the Home screen needs: this week's interviews against the goal, the streak, and open follow-ups. */
export function getHome(db: DB): Home {
  const v = activeVentureId(db)
  if (!v) return { goal: 3, thisWeek: 0, streak: 0, tasks: [] }
  const goal = db.prepare('SELECT weekly_goal FROM ventures WHERE id = ?').pluck().get(v) as number
  const perWeek = new Map<string, number>()
  for (const d of db.prepare('SELECT date FROM interviews WHERE venture_id = ?').pluck().all(v) as string[]) {
    perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) ?? 0) + 1)
  }
  const thisWeek = weekStart(today())
  return {
    goal,
    thisWeek: perWeek.get(thisWeek) ?? 0,
    streak: streak(perWeek, goal, thisWeek),
    tasks: listTasks(db).filter((t) => !t.done)
  }
}

// ---- Insights and tags (F10) ----
type InsightSave = z.output<typeof insightInput>

export function listInsights(db: DB): Insight[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db
    .prepare(
      `SELECT n.*, i.date, c.name AS contact_name FROM insights n
       LEFT JOIN interviews i ON i.id = n.interview_id LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE n.venture_id = ? ORDER BY n.created_at DESC, n.rowid DESC`
    )
    .all(v) as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    interview_id: r.interview_id as string | null,
    text: r.text as string,
    tags: strings(parseJson(r.tags as string)),
    is_quote: r.is_quote === 1,
    date: (r.date as string | null) ?? null,
    contact_name: (r.contact_name as string | null) ?? null,
    created_at: r.created_at as string
  }))
}

export function saveInsight(db: DB, input: InsightSave): Insight {
  const v = requireVenture(db)
  assertInVenture(db, 'interviews', input.interview_id, v, 'interview')
  const t = now()
  const p = { ...input, tags: JSON.stringify(input.tags), is_quote: input.is_quote ? 1 : 0, v, t }
  let id = input.id
  if (id) {
    const changed = db
      .prepare(
        'UPDATE insights SET interview_id = @interview_id, text = @text, tags = @tags, is_quote = @is_quote, updated_at = @t WHERE id = @id AND venture_id = @v'
      )
      .run(p).changes
    if (!changed) throw new Error('That insight no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare(
      `INSERT INTO insights (id, venture_id, interview_id, text, tags, is_quote, created_at, updated_at)
       VALUES (@id, @v, @interview_id, @text, @tags, @is_quote, @t, @t)`
    ).run({ ...p, id })
  }
  return listInsights(db).find((n) => n.id === id)!
}

export function deleteInsight(db: DB, id: string): void {
  db.prepare('DELETE FROM insights WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

/** Renames, merges or deletes an insight tag across the venture. Returns how many insights changed. */
export function renameTag(db: DB, { from, to }: z.output<typeof tagRenameInput>): number {
  const v = requireVenture(db)
  const t = now()
  const update = db.prepare('UPDATE insights SET tags = ?, updated_at = ? WHERE id = ?')
  let changed = 0
  db.transaction(() => {
    for (const r of db.prepare('SELECT id, tags FROM insights WHERE venture_id = ?').all(v) as { id: string; tags: string }[]) {
      const tags = strings(parseJson(r.tags))
      if (!tags.includes(from)) continue
      const next = [...new Set(tags.map((x) => (x === from ? to : x)).filter((x): x is string => x !== null))]
      update.run(JSON.stringify(next), t, r.id) // updated_at moves so a teammate's import picks the change up
      changed++
    }
  })()
  return changed
}

/** Most-used insight tags with the average pain score of the interviews they came from. */
function topTags(db: DB, ventureId: string): Dashboard['topTags'] {
  const rows = db
    .prepare('SELECT n.tags, i.pain_score FROM insights n LEFT JOIN interviews i ON i.id = n.interview_id WHERE n.venture_id = ?')
    .all(ventureId) as { tags: string; pain_score: number | null }[]
  const byTag = new Map<string, { count: number; painSum: number; painN: number }>()
  for (const r of rows) {
    for (const tag of new Set(strings(parseJson(r.tags)))) {
      const e = byTag.get(tag) ?? { count: 0, painSum: 0, painN: 0 }
      e.count++
      if (r.pain_score !== null) {
        e.painSum += r.pain_score
        e.painN++
      }
      byTag.set(tag, e)
    }
  }
  return [...byTag]
    .map(([tag, e]) => ({ tag, count: e.count, avgPain: e.painN ? Math.round((e.painSum / e.painN) * 10) / 10 : null }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 10)
}

// ---- Interview guides (F9) ----
type GuideSave = z.output<typeof guideInput>

export function listGuides(db: DB): Guide[] {
  const v = activeVentureId(db)
  if (!v) return []
  const rows = db
    .prepare('SELECT id, name, questions, updated_at FROM guides WHERE venture_id = ? ORDER BY created_at, rowid')
    .all(v) as (Omit<Guide, 'questions'> & { questions: string })[]
  return rows.map((g) => ({ ...g, questions: strings(parseJson(g.questions)) }))
}

export function saveGuide(db: DB, input: GuideSave): Guide {
  const v = requireVenture(db)
  const t = now()
  const questions = JSON.stringify(input.questions)
  let id = input.id
  if (id) {
    const changed = db
      .prepare('UPDATE guides SET name = ?, questions = ?, updated_at = ? WHERE id = ? AND venture_id = ?')
      .run(input.name, questions, t, id, v).changes
    if (!changed) throw new Error('That guide no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare('INSERT INTO guides (id, venture_id, name, questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      v,
      input.name,
      questions,
      t,
      t
    )
  }
  return listGuides(db).find((g) => g.id === id)!
}

export function deleteGuide(db: DB, id: string): void {
  db.prepare('DELETE FROM guides WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}

// ---- Readiness thresholds, stored in the venture's cohort so they travel with exports ----
const settingsOf = (text: string): Record<string, unknown> => {
  const raw = parseJson(text)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

/** The cohort's thresholds, or the PRD defaults. Malformed imported settings fall back to the defaults. */
export function getThresholds(db: DB): Thresholds {
  const v = activeVentureId(db)
  const text = v
    ? (db.prepare('SELECT c.settings FROM ventures v JOIN cohorts c ON c.id = v.cohort_id WHERE v.id = ?').pluck().get(v) as
        | string
        | undefined)
    : undefined
  const saved = text ? settingsOf(text).readiness : undefined
  const parsed = thresholdsInput.safeParse({ ...DEFAULT_THRESHOLDS, ...(saved && typeof saved === 'object' ? saved : {}) })
  return parsed.success ? parsed.data : DEFAULT_THRESHOLDS
}

/** Saves thresholds into the venture's cohort, creating one if the venture has none. Other settings keys are kept. */
export function saveThresholds(db: DB, thresholds: Thresholds): Thresholds {
  const v = requireVenture(db)
  const t = now()
  db.transaction(() => {
    let cohortId = db.prepare('SELECT cohort_id FROM ventures WHERE id = ?').pluck().get(v) as string | null
    if (!cohortId) {
      cohortId = randomUUID()
      const semester = db.prepare('SELECT semester FROM ventures WHERE id = ?').pluck().get(v) as string
      db.prepare(
        "INSERT INTO cohorts (id, name, semester, settings, created_at, updated_at) VALUES (?, ?, ?, '{}', ?, ?)"
      ).run(cohortId, semester || 'My cohort', semester, t, t)
      db.prepare('UPDATE ventures SET cohort_id = ?, updated_at = ? WHERE id = ?').run(cohortId, t, v)
    }
    const settings = settingsOf(db.prepare('SELECT settings FROM cohorts WHERE id = ?').pluck().get(cohortId) as string)
    db.prepare('UPDATE cohorts SET settings = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify({ ...settings, readiness: thresholds }),
      t,
      cohortId
    )
  })()
  return getThresholds(db)
}
