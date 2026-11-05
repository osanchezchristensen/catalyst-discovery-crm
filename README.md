# Catalyst Discovery CRM

A desktop app for students in [The Catalyst](https://business.ku.edu/research-and-faculty/entrepreneurship/catalyst) (KU School of Business). Students plan and log customer-discovery interviews, link what they hear to the hypotheses their venture depends on, and decide on evidence whether the idea is viable. There's no login and no cloud: all data stays on the student's computer.

> **Status:** 0.9 beta for the first cohort. Installers are not code-signed yet ([ADR 0004](docs/decisions/0004-unsigned-beta-on-public-releases.md)).

## For students

**[Download the latest release](https://github.com/osanchezchristensen/catalyst-discovery-crm/releases/latest)**, then follow the **[install guide](docs/guides/install-guide.md)**. It shows what to click past the one-time Windows and Mac security warnings.

What's inside:
- **Venture:** pitch, problem, customer segments with a beachhead, team.
- **Contacts:** a Kanban from Identified to Closed, a table view, CSV import.
- **Interviews:** structured notes that save automatically, pain and willingness-to-pay signals, attachments, interview guides.
- **Hypotheses and evidence:** mark each interview as supporting or refuting each assumption; the app suggests a status.
- **Insights:** highlight notes into tagged insights and see which pains come up most.
- **Viability:** readiness checklist, charts, and a decision log (persevere, pivot, pause, stop).
- **Home:** weekly interview goal, streak and follow-ups.

## For developers

Requirements: [Node.js](https://nodejs.org) 24 and Git. Windows, macOS or Linux.

```sh
npm ci            # install exactly what's in package-lock.json
npm run dev       # run the app with hot reload (uses a separate "(dev)" data folder)
npm run typecheck && npm run lint && npm test
npm run dist      # build an installer for this OS into release/<version>/
```

- Electron + Vite + React + TypeScript, with Tailwind and shadcn/ui. SQLite (better-sqlite3) runs in the main process. The renderer is sandboxed and reaches it only through a typed, validated IPC API.
- Product requirements: [docs/product/prd.md](docs/product/prd.md). Brand rules: [docs/brand/brand-kit.md](docs/brand/brand-kit.md). Decisions: [docs/decisions/](docs/decisions/). Session notes: [docs/dev-log/](docs/dev-log/).
- `CLAUDE.md` holds the project rules for Claude Code sessions.

### Releasing

1. Bump `version` in `package.json` on a branch, merge it to `main`.
2. Tag the merge commit and push the tag: `git tag v0.9.0 && git push origin v0.9.0`.
3. The **Release** workflow builds Windows, macOS and Linux installers, runs the checks, and creates a **draft** GitHub Release.
4. Try the installers, then publish the draft.

Signing later: see [ADR 0004](docs/decisions/0004-unsigned-beta-on-public-releases.md).

### Docs in Obsidian

`docs/` is an Obsidian vault. Open the `docs` folder (not the project root) as a vault and start at `home.md`. Links are standard Markdown, so they work on GitHub too.

## Privacy

The app makes no network calls and sends no analytics. Workspace exports leave out interviewee emails and phone numbers unless the student includes them. Confirm FERPA and data-handling expectations with KU IT before wider use.
