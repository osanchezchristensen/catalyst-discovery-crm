# PRD: Catalyst Discovery CRM

Discovery CRM gives every Catalyst venture one place to plan, log and learn from customer interviews, so students can judge viability on evidence by the end of the semester. It is an offline desktop app with no login.

Related: [Brand kit](../brand/brand-kit.md) · [ADR 0001: offline desktop, Electron + SQLite](../decisions/0001-offline-desktop-electron-sqlite.md) · [Kickoff prompt](../prompts/claude-code-kickoff.md)

## Context
[The Catalyst](https://business.ku.edu/research-and-faculty/entrepreneurship/catalyst) is a KU School of Business co-curricular program built on cohort-based, learn-by-doing entrepreneurship.
- **Stage 1:** students arrive with a venture or nonprofit idea.
- **Stage 2:** students serve as paid Guides in Training.
- **Stage 3:** students lead cohorts as Guides.

Students meet regularly with leadership and mentors, and their hours can count toward the school's 120-hour experiential learning requirement.

## Problem
- Interview notes live in phones, Google Docs and memory, so patterns across 10–30 conversations get lost.
- Students confirm what they hope is true instead of tracking which assumptions they tested and what the evidence said.

## Users

| Persona | Who | Main job in the app |
| --- | --- | --- |
| Founder (Stage 1) | KU student with a venture idea, often on a team of 1–4 | Plan and log interviews, tag insights, test hypotheses, decide whether to pivot or persevere |

Stage 2 and 3 students who still run a venture use the app as founders. Guide and program-admin tools are out of scope ([ADR 0002](../decisions/0002-remove-guide-view.md)).

## Goals and success metrics

| Goal | Metric | Target (first semester) |
| --- | --- | --- |
| Students talk to more customers | Median interviews logged per venture | 15+ |
| Evidence over opinion | Ventures with 3+ hypotheses, each linked to 5+ interviews | 80% |
| Students keep using it | Founders active weekly, weeks 2–12 | 70% |
| Clear outcome | Ventures that record a viability decision by semester end | 90% |

The app has no telemetry, so these metrics are measured from exported workspace files.

## Non-goals (v1)
- Not a sales pipeline or email marketing tool. No bulk email.
- No automatic recording or transcription of interviews.
- No grading. The program awards points and hours outside the app.
- No public profiles or investor-facing pages.
- No accounts, sign-in, server, cloud sync or telemetry.
- No Guide or program-admin tools: no Guide view, comments, check-ins, cohort roll-ups or admin console ([ADR 0002](../decisions/0002-remove-guide-view.md)).

## Features

| # | Feature | What it does | Priority |
| --- | --- | --- | --- |
| F1 | Local workspace (no sign-in) | Opens straight into the app. First launch asks for your name and venture. Data is stored in a SQLite file in the OS app-data folder. Export and import the whole workspace as JSON for backups, moving computers and sharing with teammates | P0 |
| F2 | Venture workspace | Venture name, one-line pitch, problem statement, target segments, Catalyst stage, semester, team member names | P0 |
| F3 | Contacts pipeline | People to interview: name, role, organization, segment, source (warm intro, LinkedIn, event, cold), tags, consent to follow up. Kanban stages: Identified → Reached out → Scheduled → Interviewed → Follow-up → Closed | P0 |
| F4 | Interview log | Date, contact, interviewers, type (informational, validation, sales), format (in person, video, phone, written response), structured notes with bold, underline and lists (current behavior, pains, current solutions, budget and willingness-to-pay signals), key quotes, pain intensity 1–5, next step, follow-up date | P0 |
| F5 | Hypotheses board | Assumptions by type (Customer, Problem, Solution/Value, Channel, Revenue/WTP, Feasibility) with risk level and status: Untested, Testing, Validated, Invalidated or Mixed | P0 |
| F6 | Evidence linking | From an interview, mark each hypothesis Supports, Refutes or Neutral, with a note. Hypothesis cards show the tally and suggest a status | P0 |
| F7 | Viability dashboard | Interviews over time, interviews by segment, hypothesis scorecard, top pains by frequency and intensity, readiness checklist | P0 |
| F8 | Decision log | Record Persevere, Pivot, Pause or Stop, with date, rationale and linked evidence. Keeps a history of pivots | P1 |
| F9 | Interview guide builder | Reusable question sets drawn from a bank of past-behavior questions. Flags leading or yes/no wording ("Would you buy…") with a tip | P1 |
| F10 | Insights and tags | Highlight quotes or notes as insights, tag them, and see an affinity grid of tags by count | P1 |
| F12 | Follow-ups and weekly goal | Tasks with due dates, created from interview next steps. Weekly interview goal with a streak on the home screen | P1 |
| F14 | Contact import | CSV import with column mapping and a duplicate check by email | P2 |
| F15 | Attachments | Attach photos of whiteboard notes or a consented recording file to an interview. Files are copied into the app-data folder | P2 |

### Readiness checklist (drives F7)
- [ ] 3+ customer segments identified, one chosen as the beachhead
- [ ] 10+ interviews logged in the beachhead segment
- [ ] Top 3 riskiest hypotheses each have 5+ linked interviews
- [ ] A pain scored 4+ in at least 60% of beachhead interviews
- [ ] At least 3 interviews show a willingness-to-pay or commitment signal (pilot, pre-order, intro)
- [ ] Decision recorded with rationale

These thresholds are defaults that can be edited per cohort. Confirm them with program staff. Informational interviews don't count toward any item (from v0.10.0).

## Data model

| Table | Key fields | Relations |
| --- | --- | --- |
| profiles | id, full_name, email (optional), stage | single local user record |
| cohorts | id, name, semester, start_date, end_date, settings (checklist thresholds) | has ventures |
| ventures | id, cohort_id, name, pitch, problem, stage, status, created_by, weekly_goal | belongs to cohort |
| venture_members | venture_id, name, role (owner, member) | team names on a venture |
| guides | id, venture_id, name, questions (JSON) | interview guides (F9), ADR 0003 |
| segments | id, venture_id, name, description, is_beachhead | used by contacts and interviews |
| contacts | id, venture_id, segment_id, name, email, phone, role, organization, source, stage, tags, consent_followup, notes | has interviews |
| interviews | id, venture_id, contact_id, date, type, format, interviewers, notes (JSON of allowlisted HTML, [ADR 0006](../decisions/0006-interview-notes-as-allowlisted-html.md)), quotes, pain_score, wtp_signal, next_step, follow_up_date | links to hypotheses and insights |
| hypotheses | id, venture_id, version, type, statement, risk, status, success_criteria | linked through evidence |
| evidence | id, hypothesis_id, interview_id, verdict (supports, refutes, neutral), note | joins interviews to hypotheses |
| insights | id, venture_id, interview_id, text, tags, is_quote | from interviews |
| decisions | id, venture_id, decision, rationale, decided_at, evidence_ids (JSON: the cited hypotheses with their status and tally at decision time) | pivot history; a pivot copies hypotheses into a new version |
| tasks | id, venture_id, assignee_name, title, due_date, done, interview_id | follow-ups |
| attachments | id, interview_id, file_name, stored_path, mime, bytes (25 MB limit per file from v0.10.0) | F15 |
| meta | key, value | schema_version, last_backup_at, workspace_id |

All ids are UUIDs, so workspaces from different computers can merge on import. Array and list fields are stored as JSON text columns.

## Data storage and privacy
- All data lives in one SQLite database in the OS app-data folder:
  - Windows: `%APPDATA%\Catalyst Discovery CRM`
  - macOS: `~/Library/Application Support/Catalyst Discovery CRM`
  - Linux: `~/.config/Catalyst Discovery CRM`
- Nothing is sent over the network.
- The database is backed up automatically to `backups/` on launch and once a day. One automatic backup per day is kept for the last 14 days. "Back Up Now" and pre-import backups each keep their own last 14.
- Anyone at the computer can see the data.
- **Workspace export:** the full workspace exports as JSON (plus CSV per table). This is how a founder shares a venture with teammates or moves to another computer. Exports leave out interviewee emails and phone numbers by default. Attachments stay on this computer and are not included.
- **Import:** imported files are untrusted input. Validate them against a schema and preview the changes before merging.
- **Consent:** every contact has a consent checkbox and can be deleted on request.
- **KU policy:** confirm FERPA and data-handling expectations with KU IT before launch.

## Screens

| Screen | Who | Contents |
| --- | --- | --- |
| Welcome | All | Wordmark, name and venture fields, Import workspace button (first launch only) |
| Home | Founder | Weekly goal and streak, next follow-ups, recent interviews, readiness progress, last backup date, "Log interview" button |
| Venture overview | Founder | Pitch, problem, segments, team, latest decision |
| Contacts | Founder | Kanban by stage with a table toggle, filters by segment and tag, quick add |
| Interview detail | Founder | Structured notes form, quotes, pain score, hypothesis evidence panel, insights |
| Hypotheses | Founder | Cards grouped by type with status chip, risk and evidence tally; drill into linked interviews |
| Viability dashboard | Founder | Charts, scorecard, readiness checklist, decision log |
| Settings | All | Profile, cohort thresholds, export and import, backups, open data folder, reset workspace |

## Core flows
1. **Onboarding:** open the app → enter your name → create a venture or import a workspace file → add 1–3 segments → write 3 starter hypotheses from a template → set a weekly interview goal.
2. **Log an interview:** press "Log interview" (Ctrl/Cmd+N) → pick or quick-add a contact → fill in the structured notes → for each open hypothesis, choose Supports, Refutes or Neutral → highlight insights → set the next step and follow-up date → save. The contact moves to Interviewed.
3. **Viability decision:** founder reviews the dashboard → completes the checklist → records Persevere, Pivot, Pause or Stop with a rationale. A pivot copies the hypotheses into a new version.

## Non-functional requirements
- **Platforms:** Windows 10+, macOS 12+, Ubuntu 22.04+. Installers: NSIS `.exe`, universal `.dmg`, `.AppImage`.
- **Window:** usable from 1024×700. The core loop (log an interview, link it to hypotheses) takes under 3 minutes and can be done from the keyboard.
- **Accessibility:** WCAG 2.1 AA, full keyboard navigation, visible KU Blue focus ring, status never shown by color alone.
- **Performance:** cold start under 3 seconds. Screens open under 300 ms with 1,000 interviews. Interview notes autosave every 5 seconds.
- **Security:**
  - Electron: `contextIsolation` on, `nodeIntegration` off, `sandbox` on, strict CSP, no remote content.
  - `shell.openExternal` allowed for `https:` links only.
  - Prepared SQL statements only.
  - CSV export guards against formula injection.
- **Offline:** no telemetry, analytics, auto-update calls, remote fonts or scripts.
- **Durability:** schema migrations never drop user data. A backup is taken before every migration.
- **Stack:** Electron, Vite, React, TypeScript, Tailwind, shadcn/ui (radix-ui, class-variance-authority, clsx, tailwind-merge), Recharts, Lucide, zod, better-sqlite3, Vitest, electron-builder.

## Build roadmap (one Claude Code session per phase)
1. **Phase 1 — Foundation:** Electron shell, SQLite with migrations, typed IPC, brand tokens, layout and sidebar, welcome screen, venture workspace, JSON export/import, automatic backups (F1, F2).
2. **Phase 2 — Discovery core:** segments, contacts Kanban, interview log with autosave (F3, F4).
3. **Phase 3 — Evidence:** hypotheses board and evidence linking (F5, F6).
4. **Phase 4 — Viability:** dashboard, readiness checklist, decision log (F7, F8).
5. **Phase 5 — dropped:** Guide and admin tools are out of scope ([ADR 0002](../decisions/0002-remove-guide-view.md)). CSV export moves to Phase 6.
6. **Phase 6 — Polish and ship:** interview guide builder, insights grid, follow-ups and streaks, CSV export (with formula-injection guard), CSV import, attachments, app icon, installers, GitHub Actions release workflow, student install guide (F9, F10, F12, F14, F15). Shipped as v0.9.0.

### Next versions
Details, decisions and open questions for each item are in the [backlog](backlog.md) (item numbers in brackets).

7. **Phase 7 — v0.10.0, interview basics:**
   - Interview types: Informational, Validation, Sales. Readiness skips Informational. The migration sets existing interviews to Validation, and new interviews require a type (#3).
   - "Written response" interview format (#4).
   - Right-click menu with Cut, Copy, Paste and Select all, plus spell check on Windows and macOS. Spell check stays off on Linux, where it would download dictionaries (#1, #6).
   - 25 MB limit per attachment (#15).
8. **Phase 8 — v0.11.0, rich-text notes:** bold, underline and list toolbar on interview notes only. Notes are stored as HTML limited to those tags and cleaned on save and on import. Pastes keep only what the toolbar can make. Needs a new dependency, approved during planning, and a migration for existing notes (#5, #2).
9. **Phase 9 — v0.12.0, patterns and sharing:**
   - Patterns screen: referral chains, tag board and tag manager, compare by interview type (#11).
   - Search everything with Ctrl+K (#7).
   - Import survey answers from CSV as Written response interviews (#8).
   - One-page summary PDF (#12).
   - Trash with undo. Decide how workspace import treats deleted rows before planning (#14).
10. **Phase 10 — v0.13.0, outreach history:** a dated timeline of outreach events on each contact (channel, reply, meeting set, declined, no reply), a Do not contact flag, and a "Waiting on a reply" list on Home (7 days by default, editable in Settings). Moving a card to Reached out records the event. Needs a migration (#16).
11. **Phase 11 — v0.14.0, calendar (offline):** a meeting record when a contact moves to Scheduled, a Calendar screen (month, week and agenda views, keyboard navigation, built as a plain grid with no calendar library), `.ics` export per meeting and for all upcoming meetings, a scheduling-link field in Settings, and today's meetings on Home. Needs a migration (#17 step 1).
12. **Phase 12 — v0.15.0, transcripts:** paste or load `.txt`, `.vtt` or `.srt` files, with an option to strip timestamps. Transcripts are stored in their own table, limited to 1 MB, and included in Search everything. Selected text can be saved as a quote or insight that links back to the transcript. There is a consent checkbox, and transcripts are left out of exports by default. Check FTS5 support before planning. Needs a migration (#22).
13. **Phase 13 — v0.16.0, response scores:** optional likelihood-to-use and likelihood-to-recommend scores (0 to 10) on each interview. Charts over time (with decision markers), by audience, segment and contact, and recent versus earlier. They always show n, hold back trends on small samples, and are labeled as stated interest rather than commitments. Needs a migration (#20).
14. **Phase 14 — v0.17.0, audience and goals:** an audience field on each contact (Peer, Customer or Expert, "Not set" until chosen), dashboard date ranges, goal targets with goal lines and on-pace markers, and filters that apply to every chart and are always shown. Count-type readiness thresholds read from matching goals. Needs a migration (#19).
15. **Phase 15 — v0.18.0, charts everywhere:** contact funnel, interview timeline, evidence bars on hypotheses, readiness progress bars, a weekly trend on Home, and a one-page "everything" view that is also added to the summary PDF. Every chart has a "view as table" option. Recharts only. Split by screen during planning if it is too big for one session (#21).
16. **Phase 16 — v0.19.0, AI agent connector (milestone, security audit):** a local MCP server that is off by default, with the read and write limits from [ADR 0005](../decisions/0005-ai-agent-access-through-local-mcp-server.md), a Suggested review queue, and a daily cap. Before planning: accept ADR 0005, confirm KU data rules for sending prospect data to an AI provider, and approve `@modelcontextprotocol/sdk`. Needs a migration (#18).

Not scheduled: calendar sync with Microsoft 365 or Google (#17 step 2). It needs network access, an ADR, and answers on KU's Microsoft tenant and app-registration ownership.

## Open questions
- Will each founder run the app on their own laptop, or will the program run one shared copy on a program computer?
- Who owns the app and its data after launch: the program, a student team, or KU IT?
- Can KU sign the installers (Apple Developer ID and a Windows code-signing certificate)? Unsigned builds show security warnings on first launch.
- Is there an approved logo for The Catalyst, or should the text wordmark stand?
