import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import type Database from 'better-sqlite3'
import { getMeta, setMeta } from './db/repo'

export const KEEP_BACKUPS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// 2026-11-01T17-02-37-123Z: sortable and safe in file names on every OS.
const stamp = (d: Date) => d.toISOString().replace(/[:.]/g, '-')

/**
 * auto: launch and daily backups. Only the newest per (UTC) day is kept, so the 14 cover 14 days.
 * manual (Back Up Now) and pre-import backups rotate separately, so they never push out daily ones.
 */
export type BackupKind = 'auto' | 'manual' | 'pre-import'
const PREFIX: Record<BackupKind, string> = { auto: 'catalyst', manual: 'manual', 'pre-import': 'pre-import' }

/** Writes a consistent snapshot of the open database to `file` (VACUUM INTO is synchronous and WAL-safe). */
export function snapshot(db: Database.Database, file: string): void {
  db.prepare('VACUUM INTO ?').run(file)
}

/** Backs up to `dir`, records the time, and prunes backups of the same kind to KEEP_BACKUPS. */
export function backupNow(db: Database.Database, dir: string, at = new Date(), kind: BackupKind = 'auto'): string {
  mkdirSync(dir, { recursive: true })
  const prefix = `${PREFIX[kind]}-`
  const file = join(dir, `${prefix}${stamp(at)}.sqlite`)
  snapshot(db, file)
  setMeta(db, 'last_backup_at', at.toISOString())

  const mine = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && /^\d{4}-\d\d-\d\dT.+\.sqlite$/.test(f.slice(prefix.length)))
    .sort()
  const day = prefix + stamp(at).slice(0, 10)
  const sameDay = kind === 'auto' ? mine.filter((f) => f !== basename(file) && f.startsWith(day)) : []
  const old = mine.filter((f) => !sameDay.includes(f)).slice(0, -KEEP_BACKUPS)
  for (const f of [...sameDay, ...old]) rmSync(join(dir, f), { force: true })
  return file
}

/** Pre-migration backups are kept separately and never pruned. */
export function backupBeforeMigration(db: Database.Database, dir: string, from: number, to: number): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `pre-migration-v${from}-to-v${to}-${stamp(new Date())}.sqlite`)
  snapshot(db, file)
  return file
}

/** A restore point before "Reset workspace". Never pruned, like pre-migration backups. */
export function backupBeforeReset(db: Database.Database, dir: string): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `pre-reset-${stamp(new Date())}.sqlite`)
  snapshot(db, file)
  return file
}

export function isBackupDue(db: Database.Database, at = new Date()): boolean {
  const last = getMeta(db, 'last_backup_at')
  return !last || at.getTime() - new Date(last).getTime() >= DAY_MS
}
