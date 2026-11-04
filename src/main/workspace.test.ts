import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createVenture, getActiveVenture, saveProfile, saveVenture } from './db/repo'
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
    file.tables.ventures[0].updated_at = '2030-01-01T00:00:00Z'
    expect(roundTrip(file).tables.ventures[0].updated_at).toBe('2030-01-01T00:00:00.000Z')
  })
})
