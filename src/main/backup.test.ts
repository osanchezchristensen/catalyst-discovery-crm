import Database from 'better-sqlite3'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KEEP_BACKUPS, backupBeforeMigration, backupNow, isBackupDue } from './backup'
import { getMeta, setMeta } from './db/repo'
import { testDb } from './test-helpers'

const tmp = () => mkdtempSync(join(tmpdir(), 'crm-backup-'))

describe('backups', () => {
  it('writes a readable copy and records the time', () => {
    const dir = tmp()
    const db = testDb()
    setMeta(db, 'marker', 'hello')
    const at = new Date('2026-11-01T10:00:00.000Z')
    const file = backupNow(db, dir, at)
    expect(getMeta(db, 'last_backup_at')).toBe(at.toISOString())
    const copy = new Database(file, { readonly: true })
    expect(copy.prepare("SELECT value FROM meta WHERE key = 'marker'").pluck().get()).toBe('hello')
    copy.close()
  })

  it(`keeps only the newest ${KEEP_BACKUPS} automatic backups and leaves other files alone`, () => {
    const dir = tmp()
    const db = testDb()
    writeFileSync(join(dir, 'pre-migration-v1-to-v2-x.sqlite'), '')
    writeFileSync(join(dir, 'notes.txt'), '')
    for (let i = 0; i < KEEP_BACKUPS + 3; i++) backupNow(db, dir, new Date(Date.UTC(2026, 0, i + 1)))
    const files = readdirSync(dir)
    const auto = files.filter((f) => f.startsWith('catalyst-')).sort()
    expect(auto).toHaveLength(KEEP_BACKUPS)
    expect(auto[0]).toContain('2026-01-04') // the three oldest were removed
    expect(files).toContain('pre-migration-v1-to-v2-x.sqlite')
    expect(files).toContain('notes.txt')
  })

  it('keeps one automatic backup per day, and manual and pre-import backups never push daily ones out', () => {
    const dir = tmp()
    const db = testDb()
    for (let d = 1; d <= KEEP_BACKUPS; d++) backupNow(db, dir, new Date(Date.UTC(2026, 0, d, 9)))
    for (let i = 0; i < 5; i++) backupNow(db, dir, new Date(Date.UTC(2026, 0, KEEP_BACKUPS, 10 + i))) // relaunches that day
    for (let i = 0; i < KEEP_BACKUPS + 2; i++) {
      backupNow(db, dir, new Date(Date.UTC(2026, 1, 1, 0, i)), 'manual')
      backupNow(db, dir, new Date(Date.UTC(2026, 1, 1, 1, i)), 'pre-import')
    }
    const files = readdirSync(dir).sort()
    const auto = files.filter((f) => f.startsWith('catalyst-'))
    expect(auto).toHaveLength(KEEP_BACKUPS)
    expect(auto[0]).toContain('2026-01-01')
    expect(auto.at(-1)).toContain('2026-01-14T14') // the newest of that day's relaunches
    expect(files.filter((f) => f.startsWith('manual-'))).toHaveLength(KEEP_BACKUPS)
    expect(files.filter((f) => f.startsWith('pre-import-'))).toHaveLength(KEEP_BACKUPS)
  })

  it('is due when never run or after 24 hours', () => {
    const db = testDb()
    const t = new Date('2026-11-01T10:00:00.000Z')
    expect(isBackupDue(db, t)).toBe(true)
    setMeta(db, 'last_backup_at', t.toISOString())
    expect(isBackupDue(db, new Date(t.getTime() + 23 * 3600_000))).toBe(false)
    expect(isBackupDue(db, new Date(t.getTime() + 24 * 3600_000))).toBe(true)
  })

  it('writes pre-migration backups with their own name', () => {
    const dir = tmp()
    const file = backupBeforeMigration(testDb(), dir, 1, 2)
    expect(file).toMatch(/pre-migration-v1-to-v2-.+\.sqlite$/)
  })
})
