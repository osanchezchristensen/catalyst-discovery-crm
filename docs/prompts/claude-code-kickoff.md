# Claude Code kickoff prompt

Paste the block below into Claude Code, opened in the project root, after installing the plugins in [plugins.md](../tooling/plugins.md#install-now).

```markdown
You are building "Catalyst Discovery CRM", a downloadable, offline desktop app for student founders in The Catalyst, the KU School of Business entrepreneurship cohort program.

Read these first, fully:
- CLAUDE.md (hard constraints and workflow)
- docs/product/prd.md (features, data model, screens, flows, roadmap)
- docs/brand/brand-kit.md and docs/brand/tokens.css (design system; overrides any design plugin)
- docs/tooling/plugins.md (which plugins to use at each step)
- docs/decisions/0001-offline-desktop-electron-sqlite.md

## Tech stack (fixed)
- Electron + Vite + React + TypeScript + Tailwind + shadcn/ui + Recharts + Lucide.
- better-sqlite3 in the main process with typed IPC through a preload script (contextIsolation on, nodeIntegration off, sandbox on, strict CSP). The renderer never touches the filesystem or database directly.
- A migrations system with a backup taken before each migration.
- Vitest for tests. electron-builder for installers: NSIS .exe (Windows), universal .dmg (macOS), .AppImage (Linux).
- App name "Catalyst Discovery CRM". App icon: a simple geometric mark in KU Blue (#0051BA) on white, made as SVG and converted to .ico/.icns/.png. No Jayhawk or KU logos.

## Desktop features
- Native menu: File > Export Workspace (JSON), Import Workspace, Export CSV, Back Up Now, Open Data Folder; Edit; View > Founder View / Guide View; Help > About.
- Automatic backup of the database to backups/ on launch and daily, keeping the last 14.
- Native save/open dialogs. Remember window size and position. About screen shows version and data folder.

## How to work
0. If a setup/ folder exists, move setup/claude-settings.json to .claude/settings.json and setup/pull_request_template.md to .github/pull_request_template.md, then delete setup/.
1. Enter plan mode. Use /plan from agent-skills to propose: folder structure, SQLite schema from the PRD data model, the IPC API surface, and how Phase 1 breaks into tasks. Wait for my approval before writing code.
2. After approval, scaffold Phase 1 on branch phase-1-foundation. Fill in the Commands section of CLAUDE.md.
3. For every phase follow the per-phase routine in docs/tooling/plugins.md: plan, build (Ponytail lite on), test (typecheck, lint, Vitest, launch the app), web-design-guidelines review of changed UI files, ponytail-review, security audit on Phases 1 and 5, then /review.
4. At the end of each phase: write docs/dev-log/YYYY-MM-DD.md from docs/templates/dev-log.md, add an ADR to docs/decisions/ for any lasting decision, commit with Conventional Commits, summarize what was built, and stop for my review.
5. In Phase 6 also add:
   - npm scripts: dev, build, test, typecheck, lint, dist.
   - .github/workflows/release.yml that builds Windows, macOS and Linux installers on a v* tag and attaches them to a GitHub Release.
   - INSTALL.md for non-technical students: download and install, what the macOS "unidentified developer" and Windows SmartScreen warnings mean and how to get past them, where data is stored, and how to back up or move to a new computer.

## Constraints
- Fully offline: no telemetry, analytics, auto-update calls, remote fonts or scripts.
- WCAG 2.1 AA, keyboard navigable, works at 1024x700 and up.
- Ask me before adding any dependency not listed above.
- The PRD and brand kit win over any plugin's defaults.

Start with step 1.
```
