// Settings-screen data tools: CSV export, contact CSV import, interview attachments, and reset.
import type Database from 'better-sqlite3'
import type { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { open, rename, rm } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  CONTACT_FIELDS,
  contactInput,
  interviewInput,
  WORKSPACE_TABLE_NAMES,
  workspaceTables,
  type Attachment,
  type ContactField,
  type ContactInput,
  type ContactMapping,
  type SurveyMapping
} from '../shared/schema'
import { backupBeforeReset } from './backup'
import { escapeHtml, noteToPlain, plainToHtml } from '../shared/notes'
import { today } from '../shared/dates'
import { toCsv } from './csv'
import { activeVentureId, getActiveVenture, listContacts, saveContact, saveInterview } from './db/repo'
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
  // Rows in Trash travel in workspace files (so deletes sync) but stay out of spreadsheets.
  const trashed = new Set(tables.interviews.filter((i) => i.deleted_at).map((i) => i.id))
  tables.contacts = tables.contacts.filter((c) => !c.deleted_at)
  tables.interviews = tables.interviews.filter((i) => !i.deleted_at)
  tables.evidence = tables.evidence.filter((e) => !trashed.has(e.interview_id))
  for (const t of WORKSPACE_TABLE_NAMES) {
    let columns = Object.keys(workspaceTables[t].shape)
    let rows = (tables[t] as Record<string, unknown>[]).map((r) => columns.map((c) => readable(r[c])))
    if (t === 'interviews') {
      // Structured notes become one plain-text column per section (lists as "• " lines).
      const at = columns.indexOf('notes')
      rows = (tables.interviews as Record<string, unknown>[]).map((r, k) => {
        let notes: Record<string, unknown> = {}
        try {
          notes = JSON.parse(String(r.notes))
        } catch {
          // Malformed notes export as blanks.
        }
        const plain = (key: string) => (typeof notes?.[key] === 'string' ? noteToPlain(notes[key] as string) : '')
        return [...rows[k].slice(0, at), ...NOTE_KEYS.map(plain), ...rows[k].slice(at + 1)]
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

// ---- Survey CSV import (backlog #8) ----

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, '')
const SURVEY_IDENTITY = {
  name: [...SYNONYMS.name, 'your name', 'respondent', 'respondent name'],
  email: [...SYNONYMS.email, 'recipient email', 'your email'],
  date: ['timestamp', 'date', 'submitted', 'submitted at', 'recorded date', 'end date', 'start date', 'completion time']
}
// Columns Google Forms and Qualtrics add that are never answers.
const SURVEY_METADATA = new Set(
  ['response id', 'ip address', 'progress', 'duration (in seconds)', 'finished', 'status', 'recipient last name', 'recipient first name',
    'external reference', 'location latitude', 'location longitude', 'distribution channel', 'user language', 'score', 'id']
    .map(norm)
)

/** Guesses name, email and date columns; every other non-metadata column is offered as an answer. */
export function suggestSurveyMapping(headers: string[]): SurveyMapping {
  const cols = headers.map(norm)
  const find = (syns: string[]) => {
    const i = cols.findIndex((h) => syns.some((s) => norm(s) === h))
    return i >= 0 ? i : null
  }
  const name = find(SURVEY_IDENTITY.name)
  const email = find(SURVEY_IDENTITY.email)
  const date = find(SURVEY_IDENTITY.date)
  const taken = new Set([name, email, date])
  const isMeta = (h: string) => SURVEY_METADATA.has(h) || Object.values(SURVEY_IDENTITY).some((syns) => syns.some((s) => norm(s) === h))
  const answers = headers.flatMap((_, i) => (taken.has(i) || isMeta(cols[i]) ? [] : [{ col: i, section: 'behavior' as const }]))
  return { name, email, date, type: 'validation', answers }
}

/**
 * Qualtrics exports three header rows: short ids, the question text, then {"ImportId":…}. Use the question text
 * as the headers and drop the two extra rows. Any other file passes through unchanged.
 */
export function qualtricsHeaders(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  if (rows.length >= 2 && rows[1].some((c) => c.trim().startsWith('{"ImportId"'))) return { headers: rows[0], rows: rows.slice(2) }
  return { headers, rows }
}

/** ISO (2026-11-03, with or without a time) or US month/day/year as Google Forms writes it. */
function surveyDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text.trim())
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text.trim())
  const parts = iso ? [iso[1], iso[2], iso[3]] : us ? [us[3], us[1], us[2]] : null
  if (!parts) return null
  const [y, m, d] = parts
  const out = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const check = new Date(`${out}T00:00:00Z`)
  return !isNaN(check.getTime()) && check.toISOString().startsWith(out) ? out : null // rejects 2026-02-31
}

/** An existing contact id, a contact this import creates (index into `contacts`), or no contact. */
export type SurveyContact = string | { new: number } | null
export type SurveyImportPlan = {
  contacts: ContactInput[]
  rows: { contact: SurveyContact; interview: z.output<typeof interviewInput> }[]
  empty: number
  duplicates: number
  invalid: { row: number; message: string }[]
}

/**
 * Turns survey rows into Written response interviews. Contacts are matched by email, then by name; unknown people
 * become new contacts. A row is skipped as already imported when that person already has a Written response on that
 * date, so importing the same file twice adds nothing the second time.
 */
export function planSurveyImport(db: DB, { headers, rows }: { headers: string[]; rows: string[][] }, mapping: SurveyMapping): SurveyImportPlan {
  const width = rows[0]?.length ?? 0
  for (const c of [mapping.name, mapping.email, mapping.date, ...mapping.answers.map((a) => a.col)]) {
    if (c !== null && c >= width) throw new Error("A column picked for the survey doesn't exist in this file.")
  }
  const v = activeVentureId(db)
  const existing = listContacts(db)
  const byEmail = new Map<string, SurveyContact>(existing.filter((c) => c.email.trim()).map((c) => [c.email.trim().toLowerCase(), c.id]))
  const byName = new Map<string, SurveyContact>(existing.map((c) => [c.name.trim().toLowerCase(), c.id]))
  const done = new Set(
    (db.prepare("SELECT contact_id, date FROM interviews WHERE venture_id = ? AND format = 'written' AND contact_id IS NOT NULL AND deleted_at IS NULL").all(v) as {
      contact_id: string
      date: string
    }[]).map((r) => `${r.contact_id}|${r.date}`)
  )
  const plan: SurveyImportPlan = { contacts: [], rows: [], empty: 0, duplicates: 0, invalid: [] }
  const cell = (row: string[], c: number | null) => (c === null ? '' : (row[c] ?? '').trim())

  rows.forEach((row, k) => {
    const answers = mapping.answers.map((a) => ({ ...a, text: cell(row, a.col) })).filter((a) => a.text)
    if (!answers.length) return void plan.empty++
    const date = mapping.date === null ? today() : surveyDate(cell(row, mapping.date))
    if (!date) return void plan.invalid.push({ row: k + 2, message: `The date “${cell(row, mapping.date)}” wasn’t understood. Use 2026-11-03 or 11/3/2026.` })

    const notes = { behavior: '', pains: '', solutions: '', budget: '' }
    const quotes: string[] = []
    for (const a of answers) {
      if (a.section === 'quotes') quotes.push(a.text)
      else notes[a.section] += `<p><strong>${escapeHtml(headers[a.col] ?? '')}</strong></p>${plainToHtml(a.text)}`
    }
    const parsed = interviewInput.safeParse({
      contact_id: null, date, type: mapping.type, format: 'written', interviewers: [], notes, quotes: quotes.join('\n'),
      pain_score: null, wtp_signal: '', next_step: '', follow_up_date: null, evidence: []
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return void plan.invalid.push({ row: k + 2, message: `${issue.path.join('.')}: ${issue.message}` })
    }

    // The contact comes last, so a row that is skipped never leaves a new contact behind.
    const name = cell(row, mapping.name)
    const email = cell(row, mapping.email).toLowerCase()
    let contact: SurveyContact = (email && byEmail.get(email)) || (name && byName.get(name.toLowerCase())) || null
    const dupKey = (c: SurveyContact) => `${typeof c === 'string' ? c : c ? `new:${c.new}` : ''}|${date}`
    if (contact && done.has(dupKey(contact))) return void plan.duplicates++
    if (!contact && (name || email)) {
      const input: ContactInput = {
        segment_id: null, name: name || email, email, phone: '', role: '', organization: '', source: null, stage: 'identified',
        tags: [], consent_followup: false, notes: ''
      }
      const checked = contactInput.safeParse(input)
      if (!checked.success) return void plan.invalid.push({ row: k + 2, message: `${checked.error.issues[0].path.join('.')}: ${checked.error.issues[0].message}` })
      contact = { new: plan.contacts.push(input) - 1 }
      // Later rows from the same person reuse this new contact.
      if (email) byEmail.set(email, contact)
      if (name) byName.set(name.toLowerCase(), contact)
    }
    if (contact) done.add(dupKey(contact))
    plan.rows.push({ contact, interview: parsed.data })
  })
  return plan
}

/** Adds a plan's new contacts and interviews in one transaction; logging an interview moves its contact to Interviewed. */
export function applySurveyImport(db: DB, plan: SurveyImportPlan): { interviews: number; contacts: number } {
  db.transaction(() => {
    const ids = plan.contacts.map((c) => saveContact(db, contactInput.parse(c)).id)
    for (const { contact, interview } of plan.rows) {
      const contact_id = contact === null ? null : typeof contact === 'string' ? contact : ids[contact.new]
      saveInterview(db, { ...interview, contact_id })
    }
  })()
  return { interviews: plan.rows.length, contacts: plan.contacts.length }
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
  if (!v || !db.prepare('SELECT 1 FROM interviews WHERE id = ? AND venture_id = ? AND deleted_at IS NULL').get(interviewId, v)) {
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
