# ADR 0005: AI agent access through a local MCP server

- **Status:** Proposed (not built; decide before planning backlog item 18)
- **Date:** 2026-11-10

## Context
The project owner wants to use the CRM with an AI agent that finds people to interview, drafts outreach, and updates the CRM when someone is contacted or replies.

The app is offline by design ([ADR 0001](0001-offline-desktop-electron-sqlite.md)), and `CLAUDE.md` forbids network calls at runtime. The agent needs the web to find people, and an email tool to see replies. So the agent can't live inside the app.

## Decision
Keep the app offline. The agent is a separate program that the student runs (Claude Code or the Claude desktop app). It has its own web search and its own email access. It reaches the CRM only through a small **local MCP server** over stdio, shipped from this repo.

- **Same rules as the UI.** The server calls the app's data layer (`src/main/db/repo.ts`) and zod validation, so agent writes follow the same rules as writes from the screens. It opens the same SQLite file, which is already in WAL mode.
- **Off by default.** A Settings switch, "Allow an AI agent to use this workspace", must be on. The text beside it says that anything the agent reads is sent to the AI provider it runs on.
- **Narrow tools.**
  - Read: venture pitch, problem, segments and hypothesis statements; contacts (name, role, organization, segment, stage, email for matching replies); follow-ups. Never phone numbers, interview notes, transcripts, quotes, insights, attachments or settings.
  - Write: suggest a prospect (with why they fit and a source link), save an outreach draft, log outreach, log a reply, set a contact's stage, set Do not contact.
  - No delete, no export or import, no changes to anything the student typed.
- **The agent never sends messages.** The student sends every message from their own account.
- **Review queue.** Suggested prospects wait in a "Suggested" tray until the student accepts or rejects each one. A daily cap (default 10) limits suggestions.
- **Audit trail.** Every agent action is a `contact_events` row with actor `agent`, shown on the contact (backlog item 16).
- **Instructions.** The standing rules for the agent are in the [agent playbook](../guides/agent-playbook.md).

## Consequences
- The app's own promise, "nothing is sent over the network", stays true. But a connected agent does send what it reads to its AI provider. The privacy section of the PRD and the Settings text must say so before this ships.
- Prospects are third parties who never agreed to be in a database. Keep to professional information that is published for professional contact. Record the source link, honor Do not contact, and delete on request.
- Web pages and replies the agent reads are untrusted and may contain instructions. Narrow, non-destructive tools limit the damage; the playbook tells the agent to treat page and email text as data.
- LinkedIn's terms prohibit scraping and automation, so the agent uses public web search only and never logs in to LinkedIn.
- New dependency: `@modelcontextprotocol/sdk`. Approve it during planning (`CLAUDE.md`).
- Two processes write to one SQLite file. Needs `busy_timeout`, and the app must notice outside changes (for example by polling `PRAGMA data_version`) so the screen updates. Verify that better-sqlite3 loads under plain Node as well as Electron.
- Needs item 16 first (events and Do not contact), plus a migration for `contacts.review_status`, `added_by`, `fit_reason` and `source_url`.
- `CLAUDE.md` does not change for this decision, because the app itself stays offline. It changes only if calendar sync (backlog item 17, step 2) is approved.

## Alternatives considered
- **A localhost HTTP endpoint inside the app.** The screen would update live and there would be one writer. But it opens a listening socket on every student's computer. Rejected for v1; revisit if two-process writes prove fragile.
- **A drop folder.** The agent writes JSON files, and the app imports them through the existing preview and validation. Safest and needs no new process, but the agent can't see the current pipeline (so it makes duplicates), and status updates aren't live. This is the fallback if the MCP server proves fragile. Today's CSV import is a small version of it.
- **An agent built into the app.** Needs the app to call an AI API, so it needs keys, billing and network access. It breaks ADR 0001.
- **Cloud sync so a hosted agent can reach the data.** Rejected by ADR 0001.
