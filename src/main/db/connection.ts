import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { backupBeforeMigration } from '../backup'
import { migrate, migrations } from './migrations'
import { ensureWorkspaceId } from './repo'

export function openDatabase(dataDir: string, backupsDir: string): Database.Database {
  mkdirSync(dataDir, { recursive: true })
  const db = new Database(join(dataDir, 'catalyst.sqlite'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db, migrations, (from, to) => backupBeforeMigration(db, backupsDir, from, to))
  ensureWorkspaceId(db)
  return db
}
