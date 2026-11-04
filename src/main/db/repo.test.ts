import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  decodeSnapshots,
  deleteDecision,
  getDashboard,
  listDecisions,
  listHypothesisVersions,
  recordDecision,
  weekStart,
  addStarterHypotheses,
  deleteHypothesis,
  listEvidence,
  listHypotheses,
  saveHypothesis,
  createVenture,
  deleteContact,
  deleteInterview,
  getActiveVenture,
  getInterview,
  getProfile,
  listContacts,
  listInterviews,
  saveContact,
  saveInterview,
  saveProfile,
  saveVenture,
  setContactStage
} from './repo'
import { testDb } from '../test-helpers'
import { contactInput, decisionInput, hypothesisInput, interviewInput, ventureBundleInput } from '../../shared/schema'

const base = { name: 'Campus Eats', pitch: '', problem: '', stage: 1, semester: 'Fall 2026' }

describe('profile', () => {
  it('creates once, then updates the same row', () => {
    const db = testDb()
    expect(getProfile(db)).toBeNull()
    const a = saveProfile(db, { full_name: 'Sam', stage: 1, email: '' })
    expect(a.email).toBeNull()
    saveProfile(db, { full_name: 'Sam', stage: 1, email: 'sam@ku.edu' })
    const b = saveProfile(db, { full_name: 'Sam Lee', stage: 2 })
    expect(b.email).toBe('sam@ku.edu')
    expect(b.id).toBe(a.id)
    expect(b.full_name).toBe('Sam Lee')
  })
})

describe('venture', () => {
  it('creates a venture with its creator as owner and makes it active', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    expect(v.members).toEqual([{ id: expect.any(String), name: 'Sam', role: 'owner' }])
    expect(getActiveVenture(db)?.venture.id).toBe(v.venture.id)
  })

  it('save replaces members and segments as a set and keeps existing ids', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    const owner = v.members[0]
    const s1 = saveVenture(db, {
      venture: { ...v.venture, pitch: 'Cheap food fast' },
      members: [owner, { name: 'Ana', role: 'member' }],
      segments: [
        { name: 'Freshmen', description: '', is_beachhead: true },
        { name: 'Grad students', description: '', is_beachhead: false }
      ]
    })
    expect(s1.venture.pitch).toBe('Cheap food fast')
    expect(s1.members.map((m) => m.name)).toEqual(['Sam', 'Ana'])
    expect(s1.members[0].id).toBe(owner.id)
    expect(s1.segments.map((s) => [s.name, s.is_beachhead])).toEqual([
      ['Freshmen', true],
      ['Grad students', false]
    ])

    const s2 = saveVenture(db, { venture: s1.venture, members: [s1.members[1]], segments: [s1.segments[1]] })
    expect(s2.members.map((m) => m.id)).toEqual([s1.members[1].id])
    expect(s2.segments.map((s) => s.id)).toEqual([s1.segments[1].id])
  })

  it('rejects a save for a venture that does not exist', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    expect(() =>
      saveVenture(db, { venture: { ...v.venture, id: crypto.randomUUID() }, members: [], segments: [] })
    ).toThrow(/no longer exists/)
  })

  it('allows only one beachhead segment', () => {
    const seg = { name: 'A', description: '', is_beachhead: true }
    const result = ventureBundleInput.safeParse({
      venture: { id: crypto.randomUUID(), ...base },
      members: [],
      segments: [seg, { ...seg, name: 'B' }]
    })
    expect(result.success).toBe(false)
  })
})

const contact = (over: Record<string, unknown> = {}) =>
  contactInput.parse({
    segment_id: null, name: 'Pat', email: '', phone: '', role: '', organization: 'Dining Services', source: 'cold',
    stage: 'identified', tags: ['staff'], consent_followup: true, notes: '', ...over
  })
const interview = (over: Record<string, unknown> = {}) =>
  interviewInput.parse({
    contact_id: null, date: '2026-11-03', format: 'video', interviewers: ['Sam'], quotes: '', pain_score: 4,
    wtp_signal: '', next_step: '', follow_up_date: null,
    notes: { behavior: 'Orders late', pains: 'Cold food', solutions: 'Microwave', budget: '' }, ...over
  })

describe('contacts', () => {
  it('creates, updates, moves and deletes within the active venture', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    const seg = saveVenture(db, { venture: v.venture, members: [], segments: [{ name: 'Freshmen', description: '', is_beachhead: true }] }).segments[0]
    const c = saveContact(db, contact({ segment_id: seg.id }))
    expect(c).toMatchObject({ name: 'Pat', tags: ['staff'], consent_followup: true, segment_id: seg.id })
    expect(saveContact(db, contact({ id: c.id, name: 'Pat Lee', tags: [] }))).toMatchObject({ id: c.id, name: 'Pat Lee', tags: [] })
    setContactStage(db, { id: c.id, stage: 'scheduled' })
    expect(listContacts(db)[0].stage).toBe('scheduled')
    deleteContact(db, c.id)
    expect(listContacts(db)).toEqual([])
  })

  it('refuses a segment or contact id that is not in the active venture', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    expect(() => saveContact(db, contact({ segment_id: randomUUID() }))).toThrow(/segment no longer exists/)
    expect(() => saveContact(db, contact({ id: randomUUID() }))).toThrow(/contact no longer exists/)
    expect(() => setContactStage(db, { id: randomUUID(), stage: 'closed' })).toThrow(/no longer exists/)
  })

  it('rejects a bad stage, a bad email and a pain score outside 1–5', () => {
    expect(() => contact({ stage: 'won' })).toThrow()
    expect(() => contact({ email: 'not-an-email' })).toThrow()
    expect(() => interview({ pain_score: 6 })).toThrow()
  })
})

describe('interviews', () => {
  it('logging an interview moves the contact to Interviewed but never backwards', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const c = saveContact(db, contact())
    const i = saveInterview(db, interview({ contact_id: c.id }))
    expect(i).toMatchObject({ contact_name: 'Pat', interviewers: ['Sam'], notes: { pains: 'Cold food' } })
    expect(listContacts(db)[0].stage).toBe('interviewed')
    setContactStage(db, { id: c.id, stage: 'follow_up' })
    saveInterview(db, interview({ id: i.id, contact_id: c.id, quotes: 'It is always cold' }))
    expect(listContacts(db)[0].stage).toBe('follow_up')
    expect(getInterview(db, i.id)?.quotes).toBe('It is always cold')
  })

  it('keeps interviews when their contact is deleted', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const c = saveContact(db, contact())
    const i = saveInterview(db, interview({ contact_id: c.id }))
    deleteContact(db, c.id)
    expect(getInterview(db, i.id)).toMatchObject({ contact_id: null, contact_name: null })
    deleteInterview(db, i.id)
    expect(listInterviews(db)).toEqual([])
  })

  it('lists newest first and decodes notes that imports left in another shape', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    saveInterview(db, interview({ date: '2026-10-01' }))
    const newer = saveInterview(db, interview({ date: '2026-11-01' }))
    db.prepare("UPDATE interviews SET notes = '[1,2]', interviewers = '{\"a\":1}' WHERE id = ?").run(newer.id)
    const [first, second] = listInterviews(db)
    expect(first).toMatchObject({ id: newer.id, interviewers: [], notes: { behavior: '', pains: '' } })
    expect(second.date).toBe('2026-10-01')
  })
})

const hypothesis = (over: Record<string, unknown> = {}) =>
  hypothesisInput.parse({ type: 'problem', statement: 'Students eat late', risk: 'high', status: 'untested', success_criteria: '', ...over })

describe('hypotheses and evidence', () => {
  it('creates, edits and deletes hypotheses, with starters', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    expect(addStarterHypotheses(db).map((h) => h.type)).toEqual(['customer', 'problem', 'solution'])
    const h = saveHypothesis(db, hypothesis())
    expect(h).toMatchObject({ version: 1, tally: { supports: 0, refutes: 0, neutral: 0 }, suggested: 'untested' })
    expect(saveHypothesis(db, hypothesis({ id: h.id, status: 'testing' })).status).toBe('testing')
    deleteHypothesis(db, h.id)
    expect(listHypotheses(db)).toHaveLength(3)
    expect(() => saveHypothesis(db, hypothesis({ id: randomUUID() }))).toThrow(/no longer exists/)
  })

  it('saves evidence with the interview as a set, tallies it and suggests a status', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const h = saveHypothesis(db, hypothesis())
    const ids = [0, 1, 2, 3, 4].map(
      (n) => saveInterview(db, interview({ evidence: [{ hypothesis_id: h.id, verdict: n < 4 ? 'supports' : 'refutes', note: '' }] })).id
    )
    expect(listHypotheses(db)[0]).toMatchObject({ tally: { supports: 4, refutes: 1, neutral: 0 }, suggested: 'validated' })

    // Changing the verdict updates the one row; removing it deletes the link.
    saveInterview(db, interview({ id: ids[0], evidence: [{ hypothesis_id: h.id, verdict: 'neutral', note: 'unclear' }] }))
    expect(getInterview(db, ids[0])?.evidence).toEqual([{ hypothesis_id: h.id, verdict: 'neutral', note: 'unclear' }])
    saveInterview(db, interview({ id: ids[1], evidence: [] }))
    expect(listHypotheses(db)[0].tally).toEqual({ supports: 2, refutes: 1, neutral: 1 })
    expect(listEvidence(db, h.id)).toHaveLength(4)
    expect(listInterviews(db).find((i) => i.id === ids[2])?.evidence).toHaveLength(1)

    deleteInterview(db, ids[2])
    expect(listEvidence(db, h.id)).toHaveLength(3)
    deleteHypothesis(db, h.id)
    expect(getInterview(db, ids[3])?.evidence).toEqual([])
  })

  it('rejects evidence for an unknown hypothesis or the same hypothesis twice', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const h = saveHypothesis(db, hypothesis())
    expect(() => saveInterview(db, interview({ evidence: [{ hypothesis_id: randomUUID(), verdict: 'supports', note: '' }] }))).toThrow(
      /hypothesis no longer exists/
    )
    expect(() =>
      interview({
        evidence: [
          { hypothesis_id: h.id, verdict: 'supports', note: '' },
          { hypothesis_id: h.id, verdict: 'refutes', note: '' }
        ]
      })
    ).toThrow(/linked once/)
  })

  it('lists only the current version', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    saveHypothesis(db, hypothesis({ statement: 'old' }))
    const t = new Date().toISOString()
    db.prepare(
      `INSERT INTO hypotheses (id, venture_id, version, type, statement, risk, status, success_criteria, created_at, updated_at)
       VALUES (?, ?, 2, 'problem', 'new', 'high', 'untested', '', ?, ?)`
    ).run(randomUUID(), v.venture.id, t, t)
    expect(listHypotheses(db).map((h) => h.statement)).toEqual(['new'])
    expect(saveHypothesis(db, hypothesis({ statement: 'added' })).version).toBe(2)
  })
})

const decision = (over: Record<string, unknown> = {}) =>
  decisionInput.parse({ decision: 'persevere', rationale: 'Strong pain', decided_at: '2026-11-03', hypothesis_ids: [], ...over })

describe('decisions', () => {
  it('stores hypothesis snapshots and sets the venture status', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const h = saveHypothesis(db, hypothesis())
    saveInterview(db, interview({ evidence: [{ hypothesis_id: h.id, verdict: 'supports', note: '' }] }))
    const d = recordDecision(db, decision({ decision: 'pause', hypothesis_ids: [h.id] }))
    expect(d).toMatchObject({ decision: 'pause', decided_at: '2026-11-03T12:00:00.000Z' })
    expect(d.hypotheses).toEqual([
      { hypothesis_id: h.id, statement: 'Students eat late', status: 'untested', tally: { supports: 1, refutes: 0, neutral: 0 }, version: 1 }
    ])
    expect(getActiveVenture(db)?.venture.status).toBe('paused')
    // The snapshot does not change when the hypothesis does later.
    saveHypothesis(db, hypothesis({ id: h.id, statement: 'Changed', status: 'validated' }))
    expect(listDecisions(db)[0].hypotheses[0]).toMatchObject({ statement: 'Students eat late', status: 'untested' })
    recordDecision(db, decision())
    expect(getActiveVenture(db)?.venture.status).toBe('active')
    deleteDecision(db, d.id)
    expect(listDecisions(db)).toHaveLength(1)
  })

  it('a pivot copies current hypotheses into a new version and leaves evidence on the old one', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const a = saveHypothesis(db, hypothesis({ statement: 'A', status: 'invalidated' }))
    saveHypothesis(db, hypothesis({ statement: 'B' }))
    saveInterview(db, interview({ evidence: [{ hypothesis_id: a.id, verdict: 'refutes', note: '' }] }))
    recordDecision(db, decision({ decision: 'pivot', hypothesis_ids: [a.id] }))
    expect(listHypothesisVersions(db)).toEqual([1, 2])
    const v2 = listHypotheses(db)
    expect(v2.map((h) => [h.statement, h.status, h.version, h.tally.refutes])).toEqual([
      ['A', 'untested', 2, 0],
      ['B', 'untested', 2, 0]
    ])
    expect(listHypotheses(db, 1).find((h) => h.statement === 'A')?.tally.refutes).toBe(1)
    // New hypotheses join the current version; old ones can still be edited and come back from their own version.
    expect(saveHypothesis(db, hypothesis({ statement: 'C' })).version).toBe(2)
    expect(saveHypothesis(db, hypothesis({ id: a.id, statement: 'A old' })).version).toBe(1)
  })

  it('rejects a hypothesis from another version or venture, and rolls back on error', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    const old = saveHypothesis(db, hypothesis())
    recordDecision(db, decision({ decision: 'pivot' }))
    expect(() => recordDecision(db, decision({ hypothesis_ids: [old.id] }))).toThrow(/no longer exists/)
    expect(() => recordDecision(db, decision({ hypothesis_ids: [randomUUID()] }))).toThrow(/no longer exists/)
    expect(listDecisions(db)).toHaveLength(1)
    expect(() => decision({ rationale: '  ' })).toThrow(/Explain why/)
  })
})

describe('dashboard', () => {
  it('weeks start on Monday, across a month boundary', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-02') // Monday
    expect(weekStart('2026-12-31')).toBe('2026-12-28')
  })

  it('aggregates interviews by week, segment and pain, and fills empty weeks', () => {
    const db = testDb()
    const v = createVenture(db, base, 'Sam')
    const segs = saveVenture(db, {
      venture: v.venture,
      members: [],
      segments: [
        { name: 'Freshmen', description: '', is_beachhead: true },
        { name: 'Staff', description: '', is_beachhead: false }
      ]
    }).segments
    const fresh = saveContact(db, contact({ segment_id: segs[0].id }))
    saveInterview(db, interview({ contact_id: fresh.id, date: '2026-10-07', pain_score: 5 }))
    saveInterview(db, interview({ contact_id: fresh.id, date: '2026-10-08', pain_score: 4 }))
    saveInterview(db, interview({ date: '2026-10-21', pain_score: 4 }))
    const d = getDashboard(db)
    expect(d.perWeek).toEqual([
      { week: '2026-10-05', count: 2 },
      { week: '2026-10-12', count: 0 },
      { week: '2026-10-19', count: 1 }
    ])
    expect(d.bySegment).toEqual([
      { segment: 'Freshmen', count: 2 },
      { segment: 'No segment', count: 1 }
    ])
    expect(d.pain.find((p) => p.score === 4)).toEqual({ score: 4, all: 2, beachhead: 1 })
    expect(d.readiness.find((r) => r.key === 'pain')?.done).toBe(true)
    expect(d.hasBeachhead).toBe(true)
  })

  it('shows at most 26 weeks and ignores mistyped future dates', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    saveInterview(db, interview({ date: '2020-01-06' }))
    saveInterview(db, interview({ date: '2025-01-06' }))
    saveInterview(db, interview({ date: '2062-01-02' }))
    const { perWeek } = getDashboard(db)
    expect(perWeek).toHaveLength(26)
    expect(perWeek[25]).toEqual({ week: '2025-01-06', count: 1 })
  })

  it('drops malformed decision snapshots from imported files', () => {
    const good = { hypothesis_id: 'h', statement: 'S', status: 'mixed', tally: { supports: 1, refutes: 1, neutral: 0 }, version: 1 }
    const text = JSON.stringify([good, { ...good, status: 'bogus' }, { ...good, tally: {} }, 'h2', null])
    expect(decodeSnapshots(text)).toEqual([good])
    expect(decodeSnapshots('{"not":"an array"}')).toEqual([])
    expect(decodeSnapshots('not json')).toEqual([])
  })

  it('is empty, not broken, with no interviews', () => {
    const db = testDb()
    createVenture(db, base, 'Sam')
    expect(getDashboard(db)).toMatchObject({ perWeek: [], bySegment: [], hasBeachhead: false })
  })
})
