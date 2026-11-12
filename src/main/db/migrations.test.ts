import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import { migrate, migrations } from './migrations'
import { WORKSPACE_TABLE_NAMES, workspaceTables, profileRow } from '../../shared/schema'

const fresh = () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  return db
}
const version = (db: Database.Database) => db.pragma('user_version', { simple: true })

describe('migrate', () => {
  it('brings a fresh database to the latest version without a backup', () => {
    const db = fresh()
    const before = vi.fn()
    migrate(db, migrations, before)
    expect(version(db)).toBe(migrations.length)
    expect(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").pluck().get()).toBe(
      String(migrations.length)
    )
    expect(before).not.toHaveBeenCalled()
  })

  it('does nothing when already current', () => {
    const db = fresh()
    migrate(db)
    const before = vi.fn()
    migrate(db, migrations, before)
    expect(before).not.toHaveBeenCalled()
    expect(version(db)).toBe(migrations.length)
  })

  it('backs up before migrating an existing database and keeps its rows', () => {
    const db = fresh()
    migrate(db)
    db.prepare("INSERT INTO meta (key, value) VALUES ('keep', 'me')").run()
    const next = [...migrations, 'ALTER TABLE ventures ADD COLUMN extra TEXT']
    const before = vi.fn()
    migrate(db, next, before)
    expect(before).toHaveBeenCalledWith(migrations.length, next.length)
    expect(version(db)).toBe(next.length)
    expect(db.prepare("SELECT value FROM meta WHERE key = 'keep'").pluck().get()).toBe('me')
  })

  it('rolls back a failing migration and leaves the version unchanged', () => {
    const db = fresh()
    migrate(db)
    expect(() => migrate(db, [...migrations, 'CREATE TABLE x (a); NOT SQL'])).toThrow()
    expect(version(db)).toBe(migrations.length)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'x'").get()).toBeUndefined()
  })

  it('v2 drops view_mode and keeps existing profile data', () => {
    const db = fresh()
    migrate(db, migrations.slice(0, 1))
    db.prepare("INSERT INTO profiles (id, full_name, email, stage, view_mode, created_at, updated_at) VALUES ('p1', 'Sam', 'sam@ku.edu', 2, 'guide', 't', 't')").run()
    const before = vi.fn()
    migrate(db, migrations.slice(0, 2), before)
    expect(before).toHaveBeenCalledWith(1, 2)
    expect(db.prepare('SELECT * FROM profiles').get()).toEqual({
      id: 'p1', full_name: 'Sam', email: 'sam@ku.edu', stage: 2, created_at: 't', updated_at: 't'
    })
  })

  it('v3 drops the Guide tables and keeps everything else', () => {
    const db = fresh()
    migrate(db, migrations.slice(0, 2))
    db.prepare("INSERT INTO meta (key, value) VALUES ('keep', 'me')").run()
    migrate(db, migrations.slice(0, 3))
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all()
    expect(tables).not.toContain('guide_assignments')
    expect(tables).not.toContain('comments')
    expect(db.prepare("SELECT value FROM meta WHERE key = 'keep'").pluck().get()).toBe('me')
  })

  it('v4 adds the weekly goal (default 3) and guides, keeping ventures', () => {
    const db = fresh()
    migrate(db, migrations.slice(0, 3))
    db.prepare(
      "INSERT INTO ventures (id, name, stage, created_at, updated_at) VALUES ('v1', 'Campus Eats', 1, 't', 't')"
    ).run()
    migrate(db, migrations.slice(0, 4))
    expect(db.prepare('SELECT name, weekly_goal FROM ventures').get()).toEqual({ name: 'Campus Eats', weekly_goal: 3 })
    expect(() => db.prepare("UPDATE ventures SET weekly_goal = 0").run()).toThrow(/CHECK/)
    db.prepare("INSERT INTO guides (id, venture_id, name, created_at, updated_at) VALUES ('g1', 'v1', 'First calls', 't', 't')").run()
    expect(db.prepare('SELECT questions FROM guides').pluck().get()).toBe('[]')
  })

  it('v5 sets existing interviews to Validation and keeps their data', () => {
    const db = fresh()
    migrate(db, migrations.slice(0, 4))
    db.prepare("INSERT INTO ventures (id, name, stage, created_at, updated_at) VALUES ('v1', 'Campus Eats', 1, 't', 't')").run()
    db.prepare(
      "INSERT INTO interviews (id, venture_id, date, format, quotes, created_at, updated_at) VALUES ('i1', 'v1', '2026-11-03', 'phone', 'Too slow', 't', 't')"
    ).run()
    migrate(db, migrations.slice(0, 5))
    expect(db.prepare('SELECT type, format, quotes FROM interviews').get()).toEqual({ type: 'validation', format: 'phone', quotes: 'Too slow' })
  })

  it('v6 turns plain-text notes into escaped paragraphs and keeps everything else', () => {
    const db = fresh()
    migrate(db, migrations.slice(0, 5))
    db.prepare("INSERT INTO ventures (id, name, stage, created_at, updated_at) VALUES ('v1', 'Campus Eats', 1, 't', 't')").run()
    const insert = db.prepare(
      "INSERT INTO interviews (id, venture_id, date, format, notes, quotes, created_at, updated_at) VALUES (?, 'v1', '2026-11-03', 'phone', ?, 'Too slow', 't', 't')"
    )
    insert.run('i1', JSON.stringify({ behavior: 'line1\nline2 <b> & co', pains: '', solutions: 'x', budget: 7 }))
    insert.run('i2', '[1,2]')
    const before = vi.fn()
    migrate(db, migrations.slice(0, 6), before)
    expect(before).toHaveBeenCalledWith(5, 6)
    const row = (id: string) => db.prepare('SELECT notes, quotes, type FROM interviews WHERE id = ?').get(id) as Record<string, string>
    expect(JSON.parse(row('i1').notes)).toEqual({ behavior: '<p>line1</p><p>line2 &lt;b&gt; &amp; co</p>', pains: '', solutions: '<p>x</p>', budget: 7 })
    expect(row('i1')).toMatchObject({ quotes: 'Too slow', type: 'validation' })
    expect(row('i2').notes).toBe('[1,2]')
  })

  it('rolls back a failing function step and leaves the version unchanged', () => {
    const db = fresh()
    migrate(db)
    const step = (d: Database.Database) => {
      d.exec('CREATE TABLE y (a)')
      throw new Error('boom')
    }
    expect(() => migrate(db, [...migrations, step])).toThrow('boom')
    expect(version(db)).toBe(migrations.length)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'y'").get()).toBeUndefined()
  })

  it('refuses a database from a newer app version', () => {
    const db = fresh()
    db.pragma(`user_version = ${migrations.length + 1}`)
    expect(() => migrate(db)).toThrow(/newer version/)
  })

  it('has SQL columns that match the shared zod schemas', () => {
    const db = fresh()
    migrate(db)
    const cols = (t: string) =>
      (db.prepare(`SELECT name FROM pragma_table_info(?)`).pluck().all(t) as string[]).sort()
    for (const t of WORKSPACE_TABLE_NAMES) {
      expect(cols(t), t).toEqual(Object.keys(workspaceTables[t].shape).sort())
    }
    expect(cols('profiles')).toEqual(Object.keys(profileRow.shape).sort())
  })
})
