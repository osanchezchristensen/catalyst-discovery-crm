import { describe, expect, it } from 'vitest'
import { createVenture, getActiveVenture, getProfile, saveProfile, saveVenture } from './repo'
import { testDb } from '../test-helpers'
import { ventureBundleInput } from '../../shared/schema'

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
