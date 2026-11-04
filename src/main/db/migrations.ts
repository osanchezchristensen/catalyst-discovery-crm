import type Database from 'better-sqlite3'

// Append-only. Never edit a shipped migration and never drop data people entered; add a new entry instead.
// (v2 drops profiles.view_mode, a UI setting for the removed Guide view; see ADR 0002.)
// Enums that may grow are checked in zod (src/shared/schema.ts), not with SQL CHECKs,
// so adding a value never needs a table rebuild.
export const migrations: string[] = [
  /* v1: full PRD data model */ `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
    view_mode TEXT NOT NULL DEFAULT 'founder' CHECK (view_mode IN ('founder', 'guide')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE cohorts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT '',
    start_date TEXT,
    end_date TEXT,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE ventures (
    id TEXT PRIMARY KEY,
    cohort_id TEXT REFERENCES cohorts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    pitch TEXT NOT NULL DEFAULT '',
    problem TEXT NOT NULL DEFAULT '',
    stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
    semester TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE venture_members (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE guide_assignments (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    guide_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE segments (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_beachhead INTEGER NOT NULL DEFAULT 0 CHECK (is_beachhead IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    organization TEXT NOT NULL DEFAULT '',
    source TEXT,
    stage TEXT NOT NULL DEFAULT 'identified',
    tags TEXT NOT NULL DEFAULT '[]',
    consent_followup INTEGER NOT NULL DEFAULT 0 CHECK (consent_followup IN (0, 1)),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE interviews (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    -- SET NULL: deleting a contact on request keeps the anonymized learning.
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    format TEXT NOT NULL,
    interviewers TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '{}',
    quotes TEXT NOT NULL DEFAULT '',
    pain_score INTEGER CHECK (pain_score BETWEEN 1 AND 5),
    wtp_signal TEXT NOT NULL DEFAULT '',
    next_step TEXT NOT NULL DEFAULT '',
    follow_up_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE hypotheses (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    type TEXT NOT NULL,
    statement TEXT NOT NULL,
    risk TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'untested',
    success_criteria TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE evidence (
    id TEXT PRIMARY KEY,
    hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('supports', 'refutes', 'neutral')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE insights (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    interview_id TEXT REFERENCES interviews(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    is_quote INTEGER NOT NULL DEFAULT 0 CHECK (is_quote IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    decided_at TEXT NOT NULL,
    evidence_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    assignee_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    due_date TEXT,
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    interview_id TEXT REFERENCES interviews(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT '',
    bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX idx_members_venture ON venture_members(venture_id);
  CREATE INDEX idx_guides_venture ON guide_assignments(venture_id);
  CREATE INDEX idx_segments_venture ON segments(venture_id);
  CREATE INDEX idx_contacts_venture ON contacts(venture_id);
  CREATE INDEX idx_interviews_venture_date ON interviews(venture_id, date);
  CREATE INDEX idx_interviews_contact ON interviews(contact_id);
  CREATE INDEX idx_hypotheses_venture ON hypotheses(venture_id);
  CREATE INDEX idx_evidence_hypothesis ON evidence(hypothesis_id);
  CREATE INDEX idx_evidence_interview ON evidence(interview_id);
  CREATE INDEX idx_insights_venture ON insights(venture_id);
  CREATE INDEX idx_decisions_venture ON decisions(venture_id);
  CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
  CREATE INDEX idx_tasks_venture ON tasks(venture_id);
  CREATE INDEX idx_attachments_interview ON attachments(interview_id);
  `,
  /* v2: remove Guide view */ `
  ALTER TABLE profiles DROP COLUMN view_mode;
  `
]

/** Runs pending migrations, each in its own transaction. `beforeMigrate` runs only for an existing database. */
export function migrate(
  db: Database.Database,
  list: string[] = migrations,
  beforeMigrate?: (from: number, to: number) => void
): void {
  const from = db.pragma('user_version', { simple: true }) as number
  if (from > list.length) {
    throw new Error('This data was saved by a newer version of Catalyst Discovery CRM. Install the latest version to open it.')
  }
  if (from === list.length) return
  if (from > 0) beforeMigrate?.(from, list.length)

  for (let v = from; v < list.length; v++) {
    db.transaction(() => {
      db.exec(list[v])
      db.pragma(`user_version = ${v + 1}`)
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(String(v + 1))
    })()
  }
}
