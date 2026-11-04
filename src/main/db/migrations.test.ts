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
