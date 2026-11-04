import Database from 'better-sqlite3'
import { migrate } from './db/migrations'

export function testDb(file = ':memory:'): Database.Database {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
