import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
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
import { contactInput, interviewInput, ventureBundleInput } from '../../shared/schema'

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
