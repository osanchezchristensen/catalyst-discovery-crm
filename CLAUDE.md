# CLAUDE.md — Catalyst Discovery CRM

## What this is
An offline desktop CRM for customer discovery, built for students in KU's The Catalyst entrepreneurship cohort.
- Features, data model, screens and roadmap: `docs/product/prd.md`
- Visual and voice rules: `docs/brand/brand-kit.md` and `docs/brand/tokens.css`. Read both before any UI work.
- Plugin usage: `docs/tooling/plugins.md`

## Hard constraints
- No login, accounts, backend, telemetry, analytics, or network calls at runtime. Bundle all fonts and assets.
- Data lives in one SQLite file in the OS app-data folder. Every schema change goes through a migration that keeps existing data.
- Never draw, trace or generate the Jayhawk or the KU signature. Use the text wordmark only.
- Colors come from the tokens only; no raw hex in components. KU Blue is primary. Crimson is only for destructive actions and invalidated hypotheses.
- Meet WCAG 2.1 AA. Status is never shown by color alone.
- The window must work at 1024×700 and up.
- Ask before adding any dependency that is not in the stack below.
- The PRD wins over any plugin's defaults, including design skills and code-minimizing skills.

## Stack
Electron, Vite, React, TypeScript, Tailwind, shadcn/ui, Recharts, Lucide icons, zod (input validation).
- `better-sqlite3` runs in the main process. The renderer reaches it only through a typed preload IPC API.
- Electron settings: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a strict CSP.
- Use prepared statements only.
- Testing: Vitest. Packaging: electron-builder (dmg, nsis, AppImage).

## Commands
- `npm run dev`: start the app with hot reload. Uses its own data folder, `Catalyst Discovery CRM (dev)`, so real data is never touched.
- `npm run typecheck` / `npm run lint` / `npm test`: TypeScript (main + renderer), ESLint (with jsx-a11y), Vitest. Run all three before every commit.
- `npm run build`: production build into `out/`.
- `npm run dist`: build, then package installers into `release/<version>/` with electron-builder (NSIS on Windows, universal dmg on macOS, AppImage on Linux). Build each OS's installer on that OS.

Notes:
- better-sqlite3 ships N-API prebuilds for every platform, so there is no native rebuild step. Its install script is denied in `package.json#allowScripts`.
- Data-layer tests run on an in-memory SQLite database (`src/main/test-helpers.ts`).

## How we work
1. Build the PRD roadmap one phase at a time, on branch `phase-N-<name>`.
2. In each phase, follow the routine in `docs/tooling/plugins.md#per-phase-routine`:
   plan → build → test → UI review → simplify → security (milestone phases only) → PR.
3. Stop for human review at the end of each phase.
4. Record any decision that is hard to reverse as an ADR in `docs/decisions/`, using `docs/templates/adr.md`.
5. At the end of each session, add or append `docs/dev-log/YYYY-MM-DD.md` using `docs/templates/dev-log.md`.
6. Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Plugin rules (short version)
- **agent-skills:** the process backbone. The PRD already exists, so skip `/spec` and start at `/plan`.
- **ponytail:** run in `lite` mode. Run `ponytail-review` before each PR. Never cut a PRD P0 feature, input validation, error handling, migrations, backups or accessibility.
- **web-design-guidelines:** run it on changed UI files before each PR. Ignore its SSR and hydration rules (this is not a web app).
- **security-audit (Cloudflare):** run a full audit at the end of Phase 1 and before every release. Never commit its output.
- **graphify:** use only once `src/` has about 30 files. Write its output to `graphify-out/`, never into `docs/`.
- **Taste Skill** and **Awesome Design** are not used for app screens. `brand-kit.md` is the design system.

## Docs vault
`docs/` is an Obsidian vault.
- Use relative Markdown links (`[PRD](product/prd.md)`), not `[[wikilinks]]`, so links render on GitHub.
- Use kebab-case filenames with no spaces.
