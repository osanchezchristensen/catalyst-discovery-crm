import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contactInput, interviewInput, type ContactMapping } from '../shared/schema'
import {
  addAttachment,
  applySurveyImport,
  planSurveyImport,
  qualtricsHeaders,
  suggestSurveyMapping,
  applyContactImport,
  attachmentPath,
  deleteAttachment,
  exportCsv,
  listAttachments,
  MAX_ATTACHMENT_BYTES,
  planContactImport,
  removeInterviewFiles,
  resetWorkspace,
  suggestMapping
} from './data-tools'
import { createVenture, getMeta, getProfile, listContacts, saveContact, saveInterview, saveProfile } from './db/repo'
import { parseCsv } from './csv'
import { testDb } from './test-helpers'

const tmp = () => mkdtempSync(join(tmpdir(), 'crm-tools-'))
const base = { name: 'Campus Eats', pitch: '', problem: '', stage: 1, semester: 'Fall 2026' }
const contact = (over: Record<string, unknown> = {}) =>
  contactInput.parse({
    segment_id: null, name: 'Pat', email: 'pat@x.com', phone: '555', role: '', organization: '', source: null,
    stage: 'identified', tags: [], consent_followup: false, notes: '', ...over
  })
const interview = () =>
  interviewInput.parse({
    contact_id: null, date: '2026-11-03', type: 'validation', format: 'video', interviewers: [], quotes: '', pain_score: 4, wtp_signal: '',
    next_step: '', follow_up_date: null, notes: { behavior: '<ul><li><p>Orders late</p></li><li><p>Eats cold</p></li></ul>', pains: '<p>=cmd|calc</p>', solutions: '', budget: '' }
  })

function seeded() {
  const db = testDb()
  saveProfile(db, { full_name: 'Sam', stage: 1 })
  createVenture(db, base, 'Sam')
  return db
}

describe('CSV export', () => {
  it('writes one guarded CSV per table into a new folder, blanking contact details by default', () => {
    const db = seeded()
    saveContact(db, contact({ name: '=HYPERLINK("http://x")', tags: ['a', 'b'] }))
    saveInterview(db, interview())
    const dir = tmp()
    const folder = exportCsv(db, dir, { includeContactDetails: false, date: '2026-11-03' })
    expect(folder).toBe(join(dir, 'catalyst-export-2026-11-03'))
    expect(readdirSync(folder)).toContain('contacts.csv')
    const contacts = parseCsv(readFileSync(join(folder, 'contacts.csv'), 'utf8'))
    const row = Object.fromEntries(contacts.headers.map((h, i) => [h, contacts.rows[0][i]]))
    expect(row).toMatchObject({ name: '\'=HYPERLINK("http://x")', email: '', phone: '', tags: 'a; b' })
    const interviews = parseCsv(readFileSync(join(folder, 'interviews.csv'), 'utf8'))
    expect(interviews.headers).toEqual(expect.arrayContaining(['notes_behavior', 'notes_pains']))
    expect(interviews.headers).not.toContain('notes')
    expect(interviews.rows[0][interviews.headers.indexOf('notes_pains')]).toBe("'=cmd|calc") // plain text, still guarded
    expect(interviews.rows[0][interviews.headers.indexOf('notes_behavior')]).toBe('• Orders late\n• Eats cold')
    // A second export the same day goes to a new folder instead of overwriting.
    expect(exportCsv(db, dir, { includeContactDetails: true, date: '2026-11-03' })).toBe(join(dir, 'catalyst-export-2026-11-03-2'))
  })
})

describe('contact CSV import', () => {
  const csv = parseCsv(
    'Full Name,E-mail,Company,Tags\nLee,LEE@x.com,Dining,staff; nights\nKim,,School,\n,nobody@x.com,,\nLee again,lee@X.com,,\nPat Dup,pat@x.com,,\nBad,not-an-email,,\n'
  )
  const mapping = { ...suggestMapping(csv.headers) } as ContactMapping

  it('suggests a mapping from header names', () => {
    expect(mapping).toEqual({ name: 0, email: 1, phone: null, role: null, organization: 2, tags: 3, notes: null })
  })

  it('counts new, duplicate-by-email (case-insensitive), nameless and invalid rows, then inserts the new ones', () => {
    const db = seeded()
    saveContact(db, contact()) // pat@x.com already exists
    const plan = planContactImport(db, csv.rows, mapping, null)
    expect(plan.add.map((c) => c.name)).toEqual(['Lee', 'Kim'])
    expect(plan.add[0]).toMatchObject({ email: 'lee@x.com', organization: 'Dining', tags: ['staff', 'nights'], stage: 'identified' })
    expect(plan).toMatchObject({ duplicates: 2, noName: 1 })
    expect(plan.invalid).toEqual([{ row: 7, message: expect.stringMatching(/^email:/) }])
    expect(applyContactImport(db, plan)).toBe(2)
    expect(listContacts(db).map((c) => c.name)).toEqual(['Pat', 'Lee', 'Kim'])
  })

  it('refuses a column index past the end of the file', () => {
    expect(() => planContactImport(seeded(), csv.rows, { ...mapping, notes: 9 }, null)).toThrow(/doesn't exist/)
  })
})

describe('survey CSV import', () => {
  const csv = parseCsv(
    [
      'Timestamp,Email Address,Your name,How do you get to campus?,What is hardest about it?',
      '11/3/2026 14:22:01,PAT@x.com,,I drive,Parking takes 20 minutes',
      '2026-11-04 09:00:00,,Kim,Bus,"Late buses\nand no shelter"',
      '2026-11-05,,,,',
      'yesterday,,Lee,Walk,Rain',
      '2026-11-06,new@x.com,New Person,Bike,Theft',
      '2026-11-06,,Kim,Bus again,'
    ].join('\n')
  )
  const mapping = suggestSurveyMapping(csv.headers)

  it('suggests identity columns, skips survey-tool metadata, and offers every other column as an answer', () => {
    expect(mapping).toEqual({
      name: 2, email: 1, date: 0, type: 'validation',
      answers: [{ col: 3, section: 'behavior' }, { col: 4, section: 'behavior' }]
    })
    expect(suggestSurveyMapping(['StartDate', 'ResponseId', 'IPAddress', 'RecipientEmail', 'Q1']).answers).toEqual([{ col: 4, section: 'behavior' }])
  })

  it('uses the question-text row of a Qualtrics export as the headers', () => {
    const q = parseCsv('StartDate,Q1\nStart Date,How do you get to campus?\n"{""ImportId"":""startDate""}","{""ImportId"":""QID1""}"\n2026-11-03,Bus\n')
    expect(qualtricsHeaders(q.headers, q.rows)).toEqual({ headers: ['Start Date', 'How do you get to campus?'], rows: [['2026-11-03', 'Bus']] })
    expect(qualtricsHeaders(csv.headers, csv.rows).rows).toBe(csv.rows) // other files pass through
  })

  it('matches contacts, reads dates, keeps questions in bold, and skips empty rows', () => {
    const db = seeded()
    const pat = saveContact(db, contact()) // pat@x.com
    const kim = saveContact(db, contact({ name: 'Kim', email: '' }))
    const plan = planSurveyImport(db, csv, { ...mapping, answers: [{ col: 3, section: 'behavior' }, { col: 4, section: 'pains' }] })
    expect(plan.rows.map((r) => [r.contact, r.interview.date])).toEqual([
      [pat.id, '2026-11-03'],
      [kim.id, '2026-11-04'],
      [{ new: 0 }, '2026-11-06'],
      [kim.id, '2026-11-06']
    ])
    expect(plan.contacts).toEqual([expect.objectContaining({ name: 'New Person', email: 'new@x.com' })])
    expect(plan.rows[1].interview.notes.pains).toBe('<p><strong>What is hardest about it?</strong></p><p>Late buses</p><p>and no shelter</p>')
    expect(plan.rows[0].interview).toMatchObject({ format: 'written', type: 'validation', notes: { solutions: '' } })
    expect(plan).toMatchObject({ empty: 1, duplicates: 0, invalid: [{ row: 5, message: expect.stringMatching(/date/i) }] })
  })

  it('adds the interviews and new contacts, and skips them when the same file is imported again', () => {
    const db = seeded()
    const plan = planSurveyImport(db, csv, { ...mapping, date: 0 })
    expect(applySurveyImport(db, plan)).toEqual({ interviews: 4, contacts: 3 })
    const people = listContacts(db)
    expect(people.map((c) => c.name)).toEqual(['pat@x.com', 'Kim', 'New Person'])
    expect(people.every((c) => c.stage === 'interviewed')).toBe(true)
    const again = planSurveyImport(db, csv, mapping)
    expect(again).toMatchObject({ rows: [], duplicates: 4 })
  })

  it('puts answers mapped to quotes in the quotes field and refuses a column past the end', () => {
    const plan = planSurveyImport(seeded(), csv, { ...mapping, answers: [{ col: 4, section: 'quotes' }] })
    expect(plan.rows[1].interview.quotes).toBe('Late buses\nand no shelter')
    expect(() => planSurveyImport(seeded(), csv, { ...mapping, answers: [{ col: 9, section: 'pains' }] })).toThrow(/doesn't exist/)
  })
})

describe('attachments', () => {
  it('copies allowed files under the attachments folder and refuses other types', async () => {
    const db = seeded()
    const i = saveInterview(db, interview())
    const root = join(tmp(), 'attachments')
    const src = join(tmp(), 'Whiteboard photo.PNG')
    writeFileSync(src, 'png bytes')
    const a = await addAttachment(db, root, i.id, src)
    expect(a).toMatchObject({ file_name: 'Whiteboard photo.PNG', mime: 'image/png', bytes: 9 })
    const file = attachmentPath(db, root, a.id)
    expect(file.startsWith(join(root, i.id))).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('png bytes')
    expect(listAttachments(db, i.id)).toHaveLength(1)

    for (const bad of ['run.exe', 'script.js', 'notes.bat', 'noext']) {
      const p = join(tmp(), bad)
      writeFileSync(p, 'x')
      await expect(addAttachment(db, root, i.id, p)).rejects.toThrow(/isn’t allowed/)
    }

    await deleteAttachment(db, root, a.id)
    expect(existsSync(file)).toBe(false)
    expect(listAttachments(db, i.id)).toEqual([])
  })

  it('refuses files over the size limit', async () => {
    const db = seeded()
    const i = saveInterview(db, interview())
    const big = join(tmp(), 'huge.mp4')
    writeFileSync(big, '')
    truncateSync(big, MAX_ATTACHMENT_BYTES + 1) // sparse, so the test stays fast
    await expect(addAttachment(db, join(tmp(), 'a'), i.id, big)).rejects.toThrow(/25 MB/)
  })

  it('refuses to open a stored path that points outside the attachments folder', async () => {
    const db = seeded()
    const i = saveInterview(db, interview())
    const root = join(tmp(), 'attachments')
    const src = join(tmp(), 'a.png')
    writeFileSync(src, 'x')
    const a = await addAttachment(db, root, i.id, src)
    db.prepare("UPDATE attachments SET stored_path = '../../evil.png' WHERE id = ?").run(a.id)
    expect(() => attachmentPath(db, root, a.id)).toThrow(/can’t be opened/)
    db.prepare("UPDATE attachments SET stored_path = ? WHERE id = ?").run(`${i.id}/x.exe`, a.id)
    expect(() => attachmentPath(db, root, a.id)).toThrow(/can’t be opened/)
  })

  it('removes an interview’s files', async () => {
    const db = seeded()
    const i = saveInterview(db, interview())
    const root = join(tmp(), 'attachments')
    const src = join(tmp(), 'a.png')
    writeFileSync(src, 'x')
    await addAttachment(db, root, i.id, src)
    await removeInterviewFiles(root, i.id)
    expect(existsSync(join(root, i.id))).toBe(false)
  })
})

describe('reset workspace', () => {
  it('needs the venture name, backs up first, then removes all data but keeps the workspace id', async () => {
    const db = seeded()
    saveContact(db, contact())
    const id = getMeta(db, 'workspace_id')
    const dir = tmp()
    const root = join(dir, 'attachments')
    mkdirSync(join(root, 'some-interview'), { recursive: true })
    writeFileSync(join(root, 'some-interview', 'photo.png'), 'x')
    await expect(resetWorkspace(db, root, join(dir, 'backups'), 'Wrong')).rejects.toThrow(/exactly/)
    const backup = await resetWorkspace(db, root, join(dir, 'backups'), '  campus eats ')
    expect(existsSync(backup)).toBe(true)
    expect(backup).toMatch(/pre-reset-.+\.sqlite$/)
    expect(existsSync(root)).toBe(false)
    expect(readFileSync(join(backup.replace(/\.sqlite$/, '-attachments'), 'some-interview', 'photo.png'), 'utf8')).toBe('x')
    expect(getProfile(db)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) FROM contacts').pluck().get()).toBe(0)
    expect(db.prepare('SELECT COUNT(*) FROM ventures').pluck().get()).toBe(0)
    expect(getMeta(db, 'workspace_id')).toBe(id)
  })
})
