import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { z } from 'zod'
import type {
  Contact,
  ContactStage,
  contactInput,
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
    const changed = db
      .prepare('UPDATE ventures SET name = ?, pitch = ?, problem = ?, stage = ?, semester = ?, updated_at = ? WHERE id = ?')
      .run(v.name, v.pitch, v.problem, v.stage, v.semester, t, v.id).changes
    if (!changed) throw new Error('That venture no longer exists. Reload and try again.')

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

function decodeInterview(row: Record<string, unknown>): Interview {
  const n = parseJson(row.notes as string)
  const o = n && typeof n === 'object' ? (n as Record<string, unknown>) : {}
  const text = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    ...(row as Interview),
    interviewers: strings(parseJson(row.interviewers as string)),
    notes: { behavior: text('behavior'), pains: text('pains'), solutions: text('solutions'), budget: text('budget') }
  }
}

function assertInVenture(db: DB, table: 'segments' | 'contacts', id: string | null, ventureId: string, what: string) {
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
  const t = now()
  const p = { ...input, tags: JSON.stringify(input.tags), consent_followup: input.consent_followup ? 1 : 0, v, t }
  let id = input.id
  if (id) {
    const changed = db
      .prepare(
        `UPDATE contacts SET segment_id = @segment_id, name = @name, email = @email, phone = @phone, role = @role,
         organization = @organization, source = @source, stage = @stage, tags = @tags,
         consent_followup = @consent_followup, notes = @notes, updated_at = @t
         WHERE id = @id AND venture_id = @v`
      )
      .run(p).changes
    if (!changed) throw new Error('That contact no longer exists. Reload and try again.')
  } else {
    id = randomUUID()
    db.prepare(
      `INSERT INTO contacts (id, venture_id, segment_id, name, email, phone, role, organization, source, stage, tags,
       consent_followup, notes, created_at, updated_at)
       VALUES (@id, @v, @segment_id, @name, @email, @phone, @role, @organization, @source, @stage, @tags,
       @consent_followup, @notes, @t, @t)`
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
  return (rows as Record<string, unknown>[]).map(decodeInterview)
}

export function getInterview(db: DB, id: string): Interview | null {
  const row = db.prepare(`${INTERVIEW_SELECT} WHERE i.id = ? AND i.venture_id = ?`).get(id, requireVenture(db))
  return row ? decodeInterview(row as Record<string, unknown>) : null
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
          `UPDATE interviews SET contact_id = @contact_id, date = @date, format = @format, interviewers = @interviewers,
           notes = @notes, quotes = @quotes, pain_score = @pain_score, wtp_signal = @wtp_signal, next_step = @next_step,
           follow_up_date = @follow_up_date, updated_at = @t WHERE id = @id AND venture_id = @v`
        )
        .run(p).changes
      if (!changed) throw new Error('That interview no longer exists. Reload and try again.')
    } else {
      id = randomUUID()
      db.prepare(
        `INSERT INTO interviews (id, venture_id, contact_id, date, format, interviewers, notes, quotes, pain_score,
         wtp_signal, next_step, follow_up_date, created_at, updated_at)
         VALUES (@id, @v, @contact_id, @date, @format, @interviewers, @notes, @quotes, @pain_score, @wtp_signal,
         @next_step, @follow_up_date, @t, @t)`
      ).run({ ...p, id })
    }
    if (input.contact_id) {
      db.prepare(
        `UPDATE contacts SET stage = 'interviewed', updated_at = ? WHERE id = ? AND stage IN (${BEFORE_INTERVIEWED.map(() => '?').join(', ')})`
      ).run(t, input.contact_id, ...BEFORE_INTERVIEWED)
    }
  })()
  return getInterview(db, id!)!
}

export function deleteInterview(db: DB, id: string): void {
  db.prepare('DELETE FROM interviews WHERE id = ? AND venture_id = ?').run(id, requireVenture(db))
}
