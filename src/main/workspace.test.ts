import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createVenture, getActiveVenture, listContacts, listInterviews, saveContact, saveHypothesis, saveInterview, saveProfile, saveVenture, listHypotheses, listDecisions, recordDecision, saveTask, saveInsight, saveGuide, listTasks, listInsights, listGuides, getThresholds, saveThresholds } from './db/repo'
import { contactInput, decisionInput, guideInput, hypothesisInput, insightInput, interviewInput, taskInput } from '../shared/schema'
import { migrations } from './db/migrations'
import { testDb } from './test-helpers'
import { ImportError, applyImport, exportWorkspace, parseWorkspace, previewImport } from './workspace'

const opts = { appVersion: '0.1.0', exportedBy: 'Sam' }

function seeded() {
  const db = testDb()
  saveProfile(db, { full_name: 'Sam', stage: 1, email: 'sam@ku.edu' })
  const v = createVenture(db, { name: 'Campus Eats', pitch: '', problem: '', stage: 1, semester: '' }, 'Sam')
  const saved = saveVenture(db, {
    venture: v.venture,
    members: v.members,
    segments: [{ name: 'Freshmen', description: '', is_beachhead: true }]
  })
  const t = new Date().toISOString()
  db.prepare(
    `INSERT INTO contacts (id, venture_id, segment_id, name, email, phone, source, stage, created_at, updated_at)
     VALUES (?, ?, ?, 'Pat', 'pat@x.com', '555-1234', 'cold', 'identified', ?, ?)`
  ).run(randomUUID(), v.venture.id, saved.segments[0].id, t, t)
  return { db, ventureId: v.venture.id }
}

const roundTrip = (file: object) => parseWorkspace(JSON.stringify(file))

describe('export', () => {
  it('leaves out contact email and phone and the local profile by default', () => {
    const { db } = seeded()
    const file = exportWorkspace(db, opts)
    expect(file.tables.contacts[0]).toMatchObject({ name: 'Pat', email: '', phone: '' })
    expect(JSON.stringify(file)).not.toContain('sam@ku.edu')
    expect(file.schema_version).toBe(migrations.length)
  })

  it('includes contact details when asked', () => {
    const { db } = seeded()
    expect(exportWorkspace(db, { ...opts, includeContactDetails: true }).tables.contacts[0].email).toBe('pat@x.com')
  })
})

describe('import validation', () => {
  it('rejects non-JSON, a foreign format, and bad enum values', () => {
    expect(() => parseWorkspace('nope')).toThrow(ImportError)
    expect(() => parseWorkspace('{"format":"other"}')).toThrow(/not a Catalyst/)
    const file = exportWorkspace(seeded().db, opts)
    file.tables.contacts[0].stage = 'hacked' as never
    expect(() => roundTrip(file)).toThrow(/tables\.contacts\.0\.stage/)
  })

  it('rejects files over 50 MB', () => {
    expect(() => parseWorkspace(' '.repeat(50 * 1024 * 1024 + 1))).toThrow(/50 MB/)
  })
})

describe('import merge', () => {
  it('adds everything into an empty workspace and makes the venture active', () => {
    const { db, ventureId } = seeded()
    const file = roundTrip(exportWorkspace(db, opts))
    const target = testDb()
    expect(previewImport(target, file).ventures).toEqual({ added: 1, updated: 0, unchanged: 0 })
    applyImport(target, file)
    expect(getActiveVenture(target)?.venture.id).toBe(ventureId)
    expect(target.prepare('SELECT COUNT(*) FROM contacts').pluck().get()).toBe(1)
  })

  it('round-trips contacts and interviews with decoded fields intact', () => {
    const { db } = seeded()
    const [pat] = listContacts(db)
    const h = saveHypothesis(db, hypothesisInput.parse({ type: 'problem', statement: 'Food arrives cold', risk: 'high', status: 'testing', success_criteria: '' }))
    saveInterview(db, interviewInput.parse({
      contact_id: pat.id, date: '2026-11-03', type: 'sales', format: 'phone', interviewers: ['Sam'], quotes: 'Too slow', pain_score: 5,
      wtp_signal: 'Would pilot', next_step: '', follow_up_date: '2026-11-10',
      notes: { behavior: 'a', pains: 'b', solutions: 'c', budget: 'd' },
      evidence: [{ hypothesis_id: h.id, verdict: 'supports', note: 'Said it twice' }]
    }))
    const i = listInterviews(db)[0]
    saveTask(db, taskInput.parse({ title: 'Call back', due_date: '2026-11-10', interview_id: i.id, done: false }))
    saveInsight(db, insightInput.parse({ interview_id: i.id, text: 'Too slow', tags: ['speed'], is_quote: true }))
    saveGuide(db, guideInput.parse({ name: 'First calls', questions: ['Why was that hard?'] }))
    saveThresholds(db, { ...getThresholds(db), wtpSignals: 5 })
    recordDecision(db, decisionInput.parse({ decision: 'persevere', rationale: 'Clear pain', decided_at: '2026-11-03', hypothesis_ids: [h.id] }))
    const target = testDb()
    applyImport(target, roundTrip(exportWorkspace(db, { ...opts, includeContactDetails: true })))
    expect(listInterviews(target)).toEqual(listInterviews(db))
    expect(listHypotheses(target)).toEqual(listHypotheses(db))
    expect(listDecisions(target)).toEqual(listDecisions(db))
    expect(listTasks(target)).toEqual(listTasks(db))
    expect(listInsights(target)).toEqual(listInsights(db))
    expect(listGuides(target)).toEqual(listGuides(db))
    expect(getThresholds(target).wtpSignals).toBe(5)
    expect(listContacts(target)).toEqual(listContacts(db))
  })

  it('replaces a row only when the incoming copy is newer', () => {
    const { db } = seeded()
    const file = roundTrip(exportWorkspace(db, opts))
    const target = testDb()
    applyImport(target, file)

    const newer = structuredClone(file)
    newer.tables.ventures[0].name = 'Renamed'
    newer.tables.ventures[0].updated_at = new Date(Date.now() + 60_000).toISOString()
    const older = structuredClone(file)
    older.tables.ventures[0].name = 'Stale'
    older.tables.ventures[0].updated_at = '2000-01-01T00:00:00.000Z'

    expect(applyImport(target, older).ventures).toEqual({ added: 0, updated: 0, unchanged: 1 })
    expect(getActiveVenture(target)?.venture.name).toBe('Campus Eats')
    expect(previewImport(target, newer).ventures).toEqual({ added: 0, updated: 1, unchanged: 0 })
    applyImport(target, newer)
    expect(getActiveVenture(target)?.venture.name).toBe('Renamed')
  })

  it('keeps local contact email and phone when a newer import has them blanked', () => {
    const { db } = seeded()
    const full = roundTrip(exportWorkspace(db, { ...opts, includeContactDetails: true }))
    const target = testDb()
    applyImport(target, full)
    const teammate = roundTrip(exportWorkspace(db, opts)) // default export blanks email and phone
    teammate.tables.contacts[0].role = 'Chef'
    teammate.tables.contacts[0].updated_at = new Date(Date.now() + 60_000).toISOString()
    applyImport(target, teammate)
    expect(target.prepare('SELECT email, phone, role FROM contacts').get()).toEqual({
      email: 'pat@x.com',
      phone: '555-1234',
      role: 'Chef'
    })
  })

  it('refuses a file from a newer schema version', () => {
    const file = roundTrip(exportWorkspace(seeded().db, opts))
    file.schema_version = migrations.length + 1
    expect(() => previewImport(testDb(), file)).toThrow(/newer version/)
  })

  it('refuses a file that holds a different venture', () => {
    const file = roundTrip(exportWorkspace(seeded().db, opts))
    const { db: target } = seeded()
    expect(() => previewImport(target, file)).toThrow('different venture (Campus Eats)')
    expect(() => applyImport(target, file)).toThrow(ImportError)
    expect(target.prepare('SELECT COUNT(*) FROM ventures').pluck().get()).toBe(1)
  })

  it('imports a file exported before v4 (no weekly goal, no guides)', () => {
    const { db } = seeded()
    const file = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    for (const v of file.tables.ventures) delete v.weekly_goal
    delete file.tables.guides
    file.schema_version = 3
    const target = testDb()
    applyImport(target, roundTrip(file))
    expect(getActiveVenture(target)?.venture.weekly_goal).toBe(3)
  })

  it('imports interviews from a file exported before v5 as Validation', () => {
    const { db } = seeded()
    saveInterview(db, interviewInput.parse({
      contact_id: null, date: '2026-11-03', type: 'sales', format: 'video', interviewers: [], quotes: '', pain_score: null,
      wtp_signal: '', next_step: '', follow_up_date: null, notes: { behavior: '', pains: '', solutions: '', budget: '' }
    }))
    const file = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    for (const i of file.tables.interviews) delete i.type
    file.schema_version = 4
    const target = testDb()
    applyImport(target, roundTrip(file))
    expect(listInterviews(target)[0].type).toBe('validation')
  })

  it('turns plain notes from files before v6 into paragraphs, and cleans HTML from newer files', () => {
    const { db } = seeded()
    saveInterview(db, interviewInput.parse({
      contact_id: null, date: '2026-11-03', type: 'sales', format: 'video', interviewers: [], quotes: '', pain_score: null,
      wtp_signal: '', next_step: '', follow_up_date: null, notes: { behavior: '', pains: '', solutions: '', budget: '' }
    }))
    const file = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    const legacy = structuredClone(file)
    legacy.schema_version = 5
    legacy.tables.interviews[0].notes = JSON.stringify({ behavior: 'a < b\nnext', pains: '', solutions: '', budget: '' })
    const t1 = testDb()
    applyImport(t1, roundTrip(legacy))
    expect(listInterviews(t1)[0].notes.behavior).toBe('<p>a &lt; b</p><p>next</p>')

    file.tables.interviews[0].notes = JSON.stringify({ behavior: '<p>ok<script>steal()</script></p><a href="x">l</a>', pains: '', solutions: '', budget: '' })
    const t2 = testDb()
    applyImport(t2, roundTrip(file))
    expect(listInterviews(t2)[0].notes.behavior).toBe('<p>oksteal()</p>l')
  })

  it('imports a referred contact listed before the person who referred them', () => {
    const { db } = seeded()
    const [pat] = listContacts(db)
    const maya = saveContact(db, contactInput.parse({ ...pat, id: undefined, name: 'Maya', referred_by: pat.id }))
    const file = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    file.tables.contacts.sort((a: { id: string }) => (a.id === maya.id ? -1 : 1)) // Maya first
    expect(file.tables.contacts[0].id).toBe(maya.id)
    const target = testDb()
    applyImport(target, roundTrip(file))
    expect(listContacts(target).find((c) => c.name === 'Maya')?.referred_by).toBe(pat.id)
  })

  it('keeps the local referrer when a newer file from before v7 updates the contact', () => {
    const { db } = seeded()
    const [pat] = listContacts(db)
    const maya = saveContact(db, contactInput.parse({ ...pat, id: undefined, name: 'Maya', referred_by: pat.id }))
    const target = testDb()
    applyImport(target, roundTrip(exportWorkspace(db, opts)))
    const old = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    for (const c of old.tables.contacts) delete c.referred_by
    const row = old.tables.contacts.find((c: { id: string }) => c.id === maya.id)
    row.role = 'Chef'
    row.updated_at = new Date(Date.now() + 60_000).toISOString()
    old.schema_version = 6
    applyImport(target, roundTrip(old))
    expect(listContacts(target).find((c) => c.id === maya.id)).toMatchObject({ role: 'Chef', referred_by: pat.id })
  })

  it('imports contacts from a file exported before v7 with no referrer', () => {
    const { db } = seeded()
    const file = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    for (const c of file.tables.contacts) delete c.referred_by
    file.schema_version = 6
    const target = testDb()
    applyImport(target, roundTrip(file))
    expect(listContacts(target)[0].referred_by).toBeNull()
  })

  it('round-trips an interview whose four notes are each near the size limit', () => {
    const { db } = seeded()
    const long = `<p>${'x'.repeat(45_000)}</p>`
    saveInterview(db, interviewInput.parse({
      contact_id: null, date: '2026-11-03', type: 'sales', format: 'video', interviewers: [], quotes: '', pain_score: null,
      wtp_signal: '', next_step: '', follow_up_date: null, notes: { behavior: long, pains: long, solutions: long, budget: long }
    }))
    const target = testDb()
    applyImport(target, roundTrip(exportWorkspace(db, opts)))
    expect(listInterviews(target)[0].notes.budget).toBe(long)
  })

  it('keeps the local interview type when a newer file from v0.9 updates the interview', () => {
    const { db } = seeded()
    saveInterview(db, interviewInput.parse({
      contact_id: null, date: '2026-11-03', type: 'informational', format: 'video', interviewers: [], quotes: '', pain_score: null,
      wtp_signal: '', next_step: '', follow_up_date: null, notes: { behavior: '', pains: '', solutions: '', budget: '' }
    }))
    const target = testDb()
    applyImport(target, roundTrip(exportWorkspace(db, opts)))
    const old = JSON.parse(JSON.stringify(exportWorkspace(db, opts)))
    delete old.tables.interviews[0].type
    old.tables.interviews[0].quotes = 'Edited on v0.9'
    old.tables.interviews[0].updated_at = new Date(Date.now() + 60_000).toISOString()
    old.schema_version = 4
    applyImport(target, roundTrip(old))
    expect(listInterviews(target)[0]).toMatchObject({ type: 'informational', quotes: 'Edited on v0.9' })
  })

  it('rolls back everything when a row points at a missing parent', () => {
    const { db } = seeded()
    const file = roundTrip(exportWorkspace(db, opts))
    file.tables.contacts[0].venture_id = randomUUID()
    const target = testDb()
    expect(() => applyImport(target, file)).toThrow(/nothing was imported/)
    expect(target.prepare('SELECT COUNT(*) FROM ventures').pluck().get()).toBe(0)
  })

  it('normalizes timestamps so text comparison is safe', () => {
    const { db } = seeded()
    const file = exportWorkspace(db, opts)
    file.tables.ventures[0].updated_at = '2020-01-01T00:00:00Z'
    expect(roundTrip(file).tables.ventures[0].updated_at).toBe('2020-01-01T00:00:00.000Z')
  })

  it('caps timestamps from the future at the import time', () => {
    const { db } = seeded()
    const file = exportWorkspace(db, opts)
    file.tables.ventures[0].created_at = '9999-12-31T00:00:00Z'
    file.tables.ventures[0].updated_at = '9999-12-31T00:00:00Z'
    const before = new Date().toISOString()
    const venture = roundTrip(file).tables.ventures[0]
    const after = new Date().toISOString()
    for (const t of [venture.created_at, venture.updated_at]) {
      expect(t >= before && t <= after).toBe(true)
    }
  })
})
