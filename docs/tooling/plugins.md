# Plugins: what to use and when

Use four of the nine plugins now (Agent Skills, Ponytail, Web Design Guidelines, Cloudflare Security Audit) and add two later (Graphify, Stageshow). Skip Taste Skill and Awesome Design for the app itself, because the KU brand kit already is the design system. Don't use Mix Route.

| Plugin | What it is | Verdict | When |
| --- | --- | --- | --- |
| [Agent Skills](#agent-skills-addy-osmani) | Plan → build → test → review → ship workflow (24 skills, 7 commands) | **Use**: process backbone | Every phase |
| [Ponytail](#ponytail) | Pushes the agent to reuse code and write less of it; reviews diffs for over-engineering | **Use**, lite mode | Always on; `ponytail-review` before each PR |
| [Web Design Guidelines](#web-design-guidelines-vercel) | Reviews UI code against Vercel's interface rules (a11y, focus, forms) | **Use**: UI review gate | Before each PR that touches UI |
| [Cloudflare Security Audit](#cloudflare-security-audit) | Finds exploitable bugs, including desktop and local IPC issues | **Use**: milestone gate | End of Phase 1, end of Phase 5, every release |
| [Graphify](#graphify) | Turns the codebase into a queryable knowledge graph with an Obsidian export | **Later** | Once `src/` has about 30 files (around Phase 3) |
| [Stageshow](#stageshow) | Builds polished faux product UI, stills and cursor demos in React | **Later**, marketing only | Demo day, pitch slides, README hero image |
| [Taste Skill](#taste-skill) | Opinionated, studio-style frontend design direction | **Skip** for app screens | Optional: a marketing page |
| [Awesome Design](#awesome-design) | Collection of other brands' `DESIGN.md` files | **Skip**: redundant | Not needed |
| [Mix Route](#mix-route) | Paid third-party API gateway that routes requests across 250 models | **Don't use** | Not needed |

## Redundancies and conflicts
- **Three design sources, one brand.** Taste Skill, Awesome Design and the built-in frontend-design guidance all propose a visual direction. [brand-kit.md](../brand/brand-kit.md) has already fixed that direction (KU colors, fonts, layout), so they would only add drift. The brand kit wins.
- **Ponytail vs Agent Skills `/code-simplify`.** Both do the same job. Use `ponytail-review` and skip `/code-simplify`.
- **Ponytail vs the PRD.** Ponytail's first rung is "skip the feature". The PRD is the spec, so Ponytail may simplify *how* a feature is built but must not drop any listed feature. `CLAUDE.md` says so.
- **Agent Skills `security-and-hardening` vs Cloudflare audit.** These complement each other. The first is coding guidance while you build; the second is a formal audit. Keep both.
- **Agent Skills `frontend-ui-engineering` vs Web Design Guidelines.** These also complement each other: one is for building, the other for reviewing.
- **Which "Agent Skills"?** This guide means [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). If you meant **vercel-labs/agent-skills**, that repo is where Web Design Guidelines lives, so installing its one skill (below) covers it.

## Install now
Run these from the project folder (`npx` installs need Node 20+). The `npx skills add` commands put skills in `.claude/skills/`. Commit that folder so everyone gets the same skills.

```powershell
# Web Design Guidelines (review only)
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines

# Cloudflare Security Audit
npx -y skills add cloudflare/security-audit-skill --skill security-audit --agent claude-code
```

Then, inside Claude Code, send each line as its own message. `.claude/settings.json` already registers both marketplaces, so Claude Code may offer to install them automatically.

```text
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/ponytail lite
```

Restart Claude Code and run `/plugin` to confirm both are enabled.

## Per-phase routine

1. **Plan:** in plan mode, run `/plan Phase N from docs/product/prd.md`. Approve the plan before any code is written.
2. **Build:** run `/build`, with Ponytail lite active. Data-layer code goes test-first (`test-driven-development`).
3. **Test:** run `/test`, then `npm run typecheck && npm run lint && npm test`, then launch the app with `npm run dev`.
4. **UI review:** "Review the changed files in src/renderer with web-design-guidelines." Then check the screens against the brand kit.
5. **Simplify:** run `ponytail-review` on the diff and cut what it flags, unless the cut breaks a PRD requirement.
6. **Security** (Phases 1 and 5, and releases only): "Run a full security audit of this repo."
7. **Ship:** run `/review`, write the dev-log entry, add an ADR for any lasting decision, then open a PR using the template. At release time, `/ship` covers the version tag and release notes.

## Agent Skills (Addy Osmani)
- **What:** 24 skills across Define, Plan, Build, Verify, Review and Ship that activate from context, plus the commands `/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify` and `/ship`.
- **Use for:**
  - `planning-and-task-breakdown` at the start of each phase
  - `test-driven-development` for the SQLite data layer and migrations
  - `debugging-and-error-recovery`
  - `git-workflow-and-versioning` and `ci-cd-and-automation` for the Phase 6 release workflow
  - `documentation-and-adrs`, writing to `docs/decisions/`
- **Skip:** `/spec`, because the PRD exists. To pressure-test the PRD itself, use `interview-me` or `idea-refine` instead.
- **Watch out:** `browser-testing-with-devtools` targets web pages. It can test the renderer while it runs under Vite in a browser, but not the Electron shell. Test the IPC layer with Vitest instead.

## Ponytail
- **What:** a "laziest senior dev" ruleset. It tries options in order: skip → reuse → stdlib/native → existing dependency → minimum new code.
  - Modes: `/ponytail lite | full | ultra`; turn it off with `stop ponytail`.
  - `ponytail-review`: checks a diff.
  - `ponytail-audit`: checks the whole repo.
  - `ponytail-debt`: lists deliberate shortcuts.
- **Use for:** keeping the dependency list short (the stack is fixed) and catching wrappers or abstractions nobody needs. Run `ponytail-audit` once at the end of Phase 4.
- **Settings:** use **lite**, not full or ultra. Its activation hooks need Node on your PATH. It also applies to subagents. To limit it to specific agent types, set `PONYTAIL_SUBAGENT_MATCHER` to a regex of those types.
- **Watch out:** its reviews don't check correctness, security or performance. Never let it remove input validation on imports, migrations, backups, error handling or accessibility.

## Web Design Guidelines (Vercel)
- **What:** a review-only skill. It fetches Vercel's Web Interface Guidelines and reports issues as `file:line` findings, covering ARIA, focus-visible rings, form labels and autocomplete, image sizing, `transition: all` and locale-aware dates.
- **Use for:** a pass over the changed UI files before each PR. Then fix the findings yourself or ask Claude to.
- **Watch out:**
  - It needs internet while reviewing. That's fine on your machine; the app itself stays offline.
  - Ignore findings about SSR, hydration or SEO, because this is a desktop app.
  - A clean pass doesn't cover tap-target size or the brand kit. Check those yourself.

## Cloudflare Security Audit
- **What:** a source-first audit that only counts bugs that can actually be exploited. It hunts across injection, auth bypass, memory safety and business logic. Desktop, mobile and local IPC are covered in a separate companion file.
  - **Output:** `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md` and `NEEDS-VALIDATION.md`, written to `~/security-audit-skill/<repo>/run-N`. That folder is outside the repo, so the reports don't get committed by accident.
- **Use for:** a full audit when the attack surface changes.
  - **Phase 1:** the preload and IPC API, plus CSP.
  - **Phase 5:** JSON import from other students' files (untrusted input), CSV export formula injection, file paths.
  - **Every release:** run it twice, because one pass finds roughly half the issues and later runs build on earlier ones.
- **How:** say "Run a full security audit." Without that explicit ask, it stays in lighter guidance mode.
- **Watch out:** it doesn't require Cloudflare hosting. Treat "needs validation" findings as open until you confirm or reject them.

## Graphify
- **What:** builds a knowledge graph of code and docs into `graphify-out/`: `graph.json`, an interactive `graph.html`, `GRAPH_REPORT.md` and an `obsidian/` vault. Later questions can query the graph instead of re-reading files.
- **When:** not yet. Its own benchmark shows about 1× savings on a six-file project. It starts paying off once `src/` has about 30 files, around Phase 3.
- **Install (Windows):**
  1. `py -m pip install graphifyy` (the package name has two y's)
  2. `graphify install`
  3. In Claude Code: `/graphify . --update`
  4. Optional: `graphify hook install` rebuilds the graph on every commit.
- **Watch out:**
  - Code is parsed locally, but docs and images are sent through Claude, which uses tokens. Point it at `src/` plus `docs/product/` rather than the whole repo.
  - Its `obsidian/` output is a separate vault. Don't merge it into `docs/`.
  - `graphify-out/` is git-ignored, except `GRAPH_REPORT.md`.

## Stageshow
- **What:** a skill for faux product UI built in React: stills, feature cards, cursor demos and bento grids. It records its output so the agent can check its own work.
- **When:** after Phase 4, when there's a real product to show, for demo day slides, a pitch to the program, a README hero or a one-page site.
- **Install:** `npx skills add benjitaylor/skills --skill stageshow`
- **Watch out:** it is for marketing visuals, not the app's real screens. Give it the brand kit and `tokens.css` so demos match the product.

## Taste Skill
- **What:** an opinionated frontend design system, tuned by design variance, motion intensity and visual density (defaults 8/6/4).
  - It picks Next.js, Framer Motion and Radix.
  - Version 2 deals random design directions and checks screenshots in a browser (needs Node 22+ and Chrome).
- **Why skip it for the app:**
  - It overrides layout and visual choices that the KU brand kit has already locked.
  - Its default stack conflicts with Electron + Vite.
  - A dense data CRM wants low variance and low motion, the opposite of its defaults.
- **If you do use it** (for example, on a marketing page):
  - Install with `npx -y skills add leonxlnx/taste-skill --skill design-taste-frontend-v1 --agent claude-code`. The v1 variant is more predictable.
  - Tell it: "Use variance 3, motion 2, density 8. Keep the Vite stack. The brand kit's colors and fonts are fixed."

## Awesome Design
- **What:** a reference collection of about 57 `DESIGN.md` files describing other companies' visual systems (Apple, Stripe, Notion and more). It isn't a skill or a tool.
- **Why skip it:** the brand kit already is this project's `DESIGN.md`. Copying another brand's file invites a non-KU look. If you want a density reference for tables or dashboards, read Linear's or Notion's file once for ideas, but don't add it to the repo.

## Mix Route
- **What:** a hosted, paid API gateway (OpenAI-compatible, 250+ models, token billing) that picks a model per request. It isn't a skill or plugin.
- **Why not:**
  - It routes your prompts and code through a third party. Its docs reviewed here say nothing about data handling.
  - It adds a second bill on top of your Claude Code plan.
  - Its docs list Claude Code as supported but give no setup steps.
  - Claude Code's tool use is built for Claude models, so other models behind a gateway can break edits and plans.
  - The app itself makes no AI calls, so there's nothing for it to route.

Sources: [Graphify on ClaudeLog](https://claudelog.com/claude-code-mcps/graphify) · [Ponytail guide](https://skillselion.com/guides/ponytail-skill-claude-code-guide) · [Web Design Guidelines](https://skillselion.com/skills/vercel-labs/agent-skills/web-design-guidelines) · [Cloudflare security-audit](https://claudemarketplaces.com/skills/cloudflare/security-audit-skill/security-audit) · [Taste Skill](https://claudemarketplaces.com/skills/leonxlnx/taste-skill/design-taste-frontend) · [Stageshow (benjitaylor/skills)](https://github.com/benjitaylor/skills) · [Agent Skills on claudekit](https://claudekit.io/en/tools/agent-skills/) · [Awesome Design MD](https://www.mindstudio.ai/blog/awesome-design-md-github-claude-code-brand-systems) · [MixRoute docs](https://mixroute.ai/docs/introduction) — checked 2026-11-01. Plugin commands change often; if one fails, check that plugin's README.
