import type Database from 'better-sqlite3'
import type { TableCounts } from '../shared/api'
import {
  WORKSPACE_FORMAT,
  WORKSPACE_FORMAT_VERSION,
  WORKSPACE_TABLE_NAMES,
  workspaceFile,
  workspaceTables,
  type WorkspaceFile,
  type WorkspaceTable
} from '../shared/schema'
import { cleanNoteHtml, plainToHtml } from '../shared/notes'
import { convertNotes } from './db/migrations'
import { ensureWorkspaceId, getActiveVenture, getMeta, setMeta } from './db/repo'

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024
type DB = Database.Database
type Counts = Partial<Record<WorkspaceTable, TableCounts>>
type Row = { id: string; updated_at: string } & Record<string, unknown>

const columns = (t: WorkspaceTable) => Object.keys(workspaceTables[t].shape)

export function exportWorkspace(
  db: DB,
  opts: { appVersion: string; exportedBy: string; includeContactDetails?: boolean }
): WorkspaceFile {
  const tables = Object.fromEntries(
    WORKSPACE_TABLE_NAMES.map((t) => [t, db.prepare(`SELECT ${columns(t).join(', ')} FROM ${t} ORDER BY rowid`).all()])
  ) as WorkspaceFile['tables']
  if (!opts.includeContactDetails) {
    // PRD: exports leave out interviewee emails and phone numbers by default.
    tables.contacts = tables.contacts.map((c) => ({ ...c, email: '', phone: '' }))
  }
  return {
    format: WORKSPACE_FORMAT,
    format_version: WORKSPACE_FORMAT_VERSION,
    schema_version: Number(getMeta(db, 'schema_version')),
    workspace_id: ensureWorkspaceId(db),
    app_version: opts.appVersion,
    exported_at: new Date().toISOString(),
    exported_by: opts.exportedBy,
    tables
  }
}

export class ImportError extends Error {}

/** Parses and validates an untrusted workspace file. Throws ImportError with a message a student can act on. */
export function parseWorkspace(text: string): WorkspaceFile {
  if (Buffer.byteLength(text) > MAX_IMPORT_BYTES) throw new ImportError('That file is larger than 50 MB.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('That file is not a valid workspace file (it is not JSON).')
  }
  const result = workspaceFile.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue.path.length ? ` (at ${issue.path.join('.')})` : ''
    throw new ImportError(`That workspace file has a problem: ${issue.message}${where}.`)
  }
  // A future timestamp would win every later merge and hide teammates' real edits, so cap it at now.
  const nowIso = new Date().toISOString()
  for (const rows of Object.values(result.data.tables) as Row[][]) {
    for (const row of rows) {
      if (row.updated_at > nowIso) row.updated_at = nowIso
      if ((row.created_at as string) > nowIso) row.created_at = nowIso
    }
  }
  return result.data
}

/** One prepared lookup per table, reused for every row. */
function classifier(db: DB, t: WorkspaceTable): (row: Row) => keyof TableCounts {
  const find = db.prepare(`SELECT updated_at FROM ${t} WHERE id = ?`).pluck()
  return (row) => {
    const local = find.get(row.id) as string | undefined
    if (local === undefined) return 'added'
    return row.updated_at > local ? 'updated' : 'unchanged'
  }
}

function assertImportable(db: DB, file: WorkspaceFile): void {
  // zod drops columns it doesn't know, so merging a newer file would silently lose its new fields.
  if (file.schema_version > Number(getMeta(db, 'schema_version'))) {
    throw new ImportError('That file was made by a newer version of Catalyst Discovery CRM. Install the latest version first.')
  }
  // The app shows one venture, so a file holding a different one would import into a place nobody can see.
  const active = getActiveVenture(db)?.venture.id
  const other = file.tables.ventures.find((v) => v.id !== active)
  if (active && other) {
    throw new ImportError(
      `That file holds a different venture (${other.name}). You can only import files of the venture you already have open.`
    )
  }
}

export function previewImport(db: DB, file: WorkspaceFile): Counts {
  assertImportable(db, file)
  const counts: Counts = {}
  for (const t of WORKSPACE_TABLE_NAMES) {
    const rows = file.tables[t] as Row[]
    if (!rows.length) continue
    const c = { added: 0, updated: 0, unchanged: 0 }
    const classify = classifier(db, t)
    for (const row of rows) c[classify(row)]++
    counts[t] = c
  }
  return counts
}

/**
 * Merges a workspace into the local database in one transaction.
 * New ids are inserted; existing ids are replaced only when the incoming row is newer.
 */
export function applyImport(db: DB, file: WorkspaceFile): Counts {
  assertImportable(db, file)
  const counts: Counts = {}
  try {
    db.transaction(() => {
      // Rows of one table can point at each other (a contact's referrer), in any order; check at commit instead.
      db.pragma('defer_foreign_keys = ON')
      for (const t of WORKSPACE_TABLE_NAMES) {
        const rows = file.tables[t] as Row[]
        if (!rows.length) continue
        const cols = columns(t)
        // Interviews from files older than v5 have no type (null): new rows become Validation, existing rows keep theirs.
        const untyped = (c: string) => t === 'interviews' && c === 'type'
        const value = (c: string) => (untyped(c) ? `COALESCE(@${c}, 'validation')` : `@${c}`)
        const insert = db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(value).join(', ')})`)
        // Exports blank contact email/phone by default; a blank incoming value must not wipe the local one.
        const set = (c: string) =>
          t === 'contacts' && (c === 'email' || c === 'phone')
            ? `${c} = CASE WHEN @${c} = '' THEN ${c} ELSE @${c} END`
            : untyped(c)
              ? `${c} = COALESCE(@${c}, ${c})`
              : t === 'contacts' && c === 'referred_by' && file.schema_version < 7
                ? `${c} = ${c}` // files before v7 can't know referrers; null there is "missing", not "removed"
                : `${c} = @${c}`
        const update = db.prepare(`UPDATE ${t} SET ${cols.map(set).join(', ')} WHERE id = @id`)
        const classify = classifier(db, t)
        const c = { added: 0, updated: 0, unchanged: 0 }
        for (const raw of rows) {
          // Notes are HTML from v6 on: clean what a file carries, and turn older plain-text notes into paragraphs.
          const row = t === 'interviews' ? { ...raw, notes: convertNotes(raw.notes as string, file.schema_version < 6 ? plainToHtml : cleanNoteHtml) } : raw
          const kind = classify(row)
          if (kind === 'added') insert.run(row)
          else if (kind === 'updated') update.run(row)
          c[kind]++
        }
        counts[t] = c
      }
      if (!getMeta(db, 'active_venture_id') && file.tables.ventures[0]) {
        setMeta(db, 'active_venture_id', file.tables.ventures[0].id)
      }
    })()
  } catch (err) {
    if (err instanceof Error && 'code' in err && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      throw new ImportError(
        'That workspace file refers to records that are missing, so nothing was imported. Ask for a fresh export.'
      )
    }
    throw err
  }
  return counts
}
