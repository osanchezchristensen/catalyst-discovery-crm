// Settings-screen data tools: CSV export, contact CSV import, interview attachments, and reset.
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { open, rename, rm } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  CONTACT_FIELDS,
  contactInput,
  WORKSPACE_TABLE_NAMES,
  workspaceTables,
  type Attachment,
  type ContactField,
  type ContactInput,
  type ContactMapping
} from '../shared/schema'
import { backupBeforeReset } from './backup'
import { toCsv } from './csv'
import { activeVentureId, getActiveVenture, listContacts, saveContact } from './db/repo'
import { exportWorkspace } from './workspace'

type DB = Database.Database

// ---- CSV export ----

/** Turns stored JSON text into something readable in a spreadsheet. */
function readable(value: unknown): string | number | null {
  if (typeof value !== 'string' || !/^[[{]/.test(value)) return value as string | number | null
  try {
    const v = JSON.parse(value)
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v.join('; ')
  } catch {
    // Not JSON after all: keep the text.
  }
  return value
}

const NOTE_KEYS = ['behavior', 'pains', 'solutions', 'budget'] as const

/**
 * Writes one CSV per workspace table into a new folder inside `dir` and returns its path.
 * Contact email and phone are blank unless asked for, matching the JSON export.
 */
export function exportCsv(db: DB, dir: string, opts: { includeContactDetails: boolean; date: string }): string {
  let folder = join(dir, `catalyst-export-${opts.date}`)
  for (let n = 2; existsSync(folder); n++) folder = join(dir, `catalyst-export-${opts.date}-${n}`)
  mkdirSync(folder)
  const { tables } = exportWorkspace(db, { appVersion: '', exportedBy: '', includeContactDetails: opts.includeContactDetails })
  for (const t of WORKSPACE_TABLE_NAMES) {
    let columns = Object.keys(workspaceTables[t].shape)
    let rows = (tables[t] as Record<string, unknown>[]).map((r) => columns.map((c) => readable(r[c])))
    if (t === 'interviews') {
      // Structured notes become one column per section.
      const at = columns.indexOf('notes')
      rows = (tables.interviews as Record<string, unknown>[]).map((r, k) => {
        let notes: Record<string, unknown> = {}
        try {
          notes = JSON.parse(String(r.notes))
        } catch {
          // Malformed notes export as blanks.
        }
        return [...rows[k].slice(0, at), ...NOTE_KEYS.map((key) => (typeof notes?.[key] === 'string' ? (notes[key] as string) : '')), ...rows[k].slice(at + 1)]
      })
      columns = [...columns.slice(0, at), ...NOTE_KEYS.map((k) => `notes_${k}`), ...columns.slice(at + 1)]
    }
    // flag wx never overwrites; the folder is new, so this only guards against a race.
    writeFileSync(join(folder, `${t}.csv`), toCsv(columns, rows), { encoding: 'utf8', flag: 'wx' })
  }
  return folder
}

// ---- Contact CSV import (F14) ----

const SYNONYMS: Record<ContactField, string[]> = {
  name: ['name', 'full name', 'contact', 'contact name', 'person'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  phone: ['phone', 'phone number', 'mobile', 'cell', 'telephone'],
  role: ['role', 'title', 'job title', 'position'],
  organization: ['organization', 'organisation', 'company', 'org', 'school', 'district', 'employer'],
  tags: ['tags', 'tag', 'labels', 'category'],
  notes: ['notes', 'note', 'comments', 'comment']
}

/** Guesses which column holds each field from the header names. */
export function suggestMapping(headers: string[]): Partial<Record<ContactField, number | null>> {
  // Compare letters and digits only, so 'E-mail', 'e_mail' and 'Email ' all match.
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const cols = headers.map(norm)
  return Object.fromEntries(
    CONTACT_FIELDS.map((f) => {
      const i = cols.findIndex((h) => SYNONYMS[f].some((syn) => norm(syn) === h))
      return [f, i >= 0 ? i : null]
    })
  )
}

export type ContactImportPlan = { add: ContactInput[]; duplicates: number; noName: number; invalid: { row: number; message: string }[] }

/**
 * Decides what an import would do. Duplicates are matched by email, case-insensitively,
 * against existing contacts and earlier rows. Every new row is validated like a hand-entered one.
 */
export function planContactImport(db: DB, rows: string[][], mapping: ContactMapping, segmentId: string | null): ContactImportPlan {
  const width = rows[0]?.length ?? 0
  for (const [field, col] of Object.entries(mapping)) {
    if (col !== null && col >= width) throw new Error(`The column picked for ${field} doesn't exist in this file.`)
  }
  const seen = new Set(
    listContacts(db)
      .map((c) => c.email.trim().toLowerCase())
      .filter(Boolean)
  )
  const cell = (row: string[], field: ContactField) => (mapping[field] === null ? '' : (row[mapping[field]!] ?? '').trim())
  const plan: ContactImportPlan = { add: [], duplicates: 0, noName: 0, invalid: [] }
  rows.forEach((row, k) => {
    const name = cell(row, 'name')
    if (!name) return void plan.noName++
    const email = cell(row, 'email').toLowerCase()
    if (email && seen.has(email)) return void plan.duplicates++
    const input: ContactInput = {
      segment_id: segmentId,
      name,
      email,
      phone: cell(row, 'phone'),
      role: cell(row, 'role'),
      organization: cell(row, 'organization'),
      source: null,
      stage: 'identified',
      tags: [...new Set(cell(row, 'tags').split(/[;,]/).map((t) => t.trim()).filter(Boolean))],
      consent_followup: false,
      notes: cell(row, 'notes')
    }
    const parsed = contactInput.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return void plan.invalid.push({ row: k + 2, message: `${issue.path.join('.') || 'row'}: ${issue.message}` })
    }
    if (email) seen.add(email)
    plan.add.push(input)
  })
  return plan
}

/** Inserts a plan's contacts in one transaction; nothing is added if any insert fails. */
export function applyContactImport(db: DB, plan: ContactImportPlan): number {
  db.transaction(() => {
    for (const c of plan.add) saveContact(db, contactInput.parse(c))
  })()
  return plan.add.length
}

// ---- Attachments (F15) ----

/** Photos, audio, video and PDFs only: nothing that runs when opened. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime'
}
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export class AttachmentError extends Error {}

const extOf = (file: string) => extname(file).slice(1).toLowerCase()

function assertInterview(db: DB, interviewId: string) {
  const v = activeVentureId(db)
  if (!v || !db.prepare('SELECT 1 FROM interviews WHERE id = ? AND venture_id = ?').get(interviewId, v)) {
    throw new AttachmentError('That interview no longer exists. Reload and try again.')
  }
}

/**
 * Copies a user-picked file into `root/<interviewId>/<uuid>.<ext>`. The type comes from the extension
 * (allowlist), the size is checked on the opened handle and again while copying, and the stored name
 * is our own, so the original name never becomes a path.
 */
export async function addAttachment(db: DB, root: string, interviewId: string, source: string): Promise<Attachment> {
  assertInterview(db, interviewId)
  const ext = extOf(source)
  const mime = ATTACHMENT_TYPES[ext]
  if (!mime) throw new AttachmentError('That file type isn’t allowed. Attach photos, audio, video or PDFs.')
  const handle = await open(source, 'r')
  const dir = join(root, interviewId)
  const name = `${randomUUID()}.${ext}`
  let bytes = 0
  try {
    const st = await handle.stat()
    if (!st.isFile()) throw new AttachmentError('That isn’t a regular file.')
    if (st.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('That file is larger than 25 MB.')
    mkdirSync(dir, { recursive: true })
    const limit = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length
        done(bytes > MAX_ATTACHMENT_BYTES ? new AttachmentError('That file is larger than 25 MB.') : null, chunk)
      }
    })
    await pipeline(handle.createReadStream({ autoClose: false }), limit, createWriteStream(join(dir, name), { flags: 'wx' }))
  } catch (err) {
    rmSync(join(dir, name), { force: true })
    throw err
  } finally {
    await handle.close()
  }
  const id = randomUUID()
  const t = new Date().toISOString()
  const fileName = source.split(/[\\/]/).pop()!.slice(0, 200)
  db.prepare(
    `INSERT INTO attachments (id, interview_id, file_name, stored_path, mime, bytes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, interviewId, fileName, `${interviewId}/${name}`, mime, bytes, t, t)
  return { id, interview_id: interviewId, file_name: fileName, mime, bytes, created_at: t }
}

export function listAttachments(db: DB, interviewId: string): Attachment[] {
  assertInterview(db, interviewId)
  return db
    .prepare('SELECT id, interview_id, file_name, mime, bytes, created_at FROM attachments WHERE interview_id = ? ORDER BY created_at, rowid')
    .all(interviewId) as Attachment[]
}

/** The file on disk for an attachment, only if it is inside `root` and an allowed type. */
export function attachmentPath(db: DB, root: string, id: string): string {
  const v = activeVentureId(db)
  const row = db
    .prepare(
      'SELECT a.stored_path FROM attachments a JOIN interviews i ON i.id = a.interview_id WHERE a.id = ? AND i.venture_id = ?'
    )
    .get(id, v) as { stored_path: string } | undefined
  if (!row) throw new AttachmentError('That attachment no longer exists.')
  const base = resolve(root)
  const full = resolve(base, row.stored_path)
  if (!full.startsWith(base + sep) || !ATTACHMENT_TYPES[extOf(full)]) {
    throw new AttachmentError('This attachment can’t be opened.')
  }
  return full
}

export async function deleteAttachment(db: DB, root: string, id: string): Promise<void> {
  const file = attachmentPath(db, root, id)
  db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
  await rm(file, { force: true })
}

/** Removes an interview's attachment files (rows go with the interview via ON DELETE CASCADE). */
export async function removeInterviewFiles(root: string, interviewId: string): Promise<void> {
  // interviewId is a validated UUID, so this stays inside root.
  await rm(join(root, interviewId), { recursive: true, force: true })
}

// ---- Reset workspace ----

/**
 * Deletes everything on this computer after a never-pruned backup. The typed venture name must
 * match, so it can't happen by accident. Keeps the workspace id and backups.
 */
export async function resetWorkspace(db: DB, root: string, backupsDir: string, confirmName: string): Promise<string> {
  const venture = getActiveVenture(db)?.venture
  if (!venture || confirmName.trim().toLowerCase() !== venture.name.trim().toLowerCase()) {
    throw new Error('Type your venture’s name exactly to confirm.')
  }
  const backup = backupBeforeReset(db, backupsDir)
  db.transaction(() => {
    db.prepare('DELETE FROM ventures').run() // cascades to every venture-owned table
    db.prepare('DELETE FROM cohorts').run()
    db.prepare('DELETE FROM profiles').run()
    db.prepare("DELETE FROM meta WHERE key = 'active_venture_id'").run()
  })()
  // The database backup can't hold files, so the attachments move next to it instead of being deleted.
  if (existsSync(root)) await rename(root, backup.replace(/\.sqlite$/, '-attachments'))
  return backup
}
