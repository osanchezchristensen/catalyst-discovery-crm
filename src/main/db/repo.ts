import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type {
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
export function getActiveVenture(db: DB): VentureBundle | null {
  const active = getMeta(db, 'active_venture_id')
  const bundle = active ? loadBundle(db, active) : null
  if (bundle) return bundle
  const first = db.prepare('SELECT id FROM ventures ORDER BY created_at LIMIT 1').pluck().get() as string | undefined
  return first ? loadBundle(db, first) : null
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
