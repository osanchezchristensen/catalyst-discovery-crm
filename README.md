# Catalyst Discovery CRM

A downloadable desktop app for students in [The Catalyst](https://business.ku.edu/research-and-faculty/entrepreneurship/catalyst) (KU School of Business). Students log customer-discovery interviews, test venture hypotheses and decide whether an idea is viable. There is no login and no cloud: all data stays on the student's computer.

> **Status:** planning. There is no app code yet. To start building, open Claude Code in this folder and paste [docs/prompts/claude-code-kickoff.md](docs/prompts/claude-code-kickoff.md).

## What's in this folder

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code reads at the start of every session |
| `.claude/settings.json` | Shared Claude Code settings (plugin marketplaces, secret-file deny list) |
| `docs/` | Obsidian vault holding the specs, decisions, dev log and prompts |
| `docs/product/prd.md` | Product requirements, the source of truth for features |
| `docs/brand/brand-kit.md` | KU colors, fonts, voice and UI rules |
| `docs/brand/tokens.css` | CSS variables the app imports |
| `docs/tooling/plugins.md` | Which Claude Code plugins to use, when to use them, and which to skip |
| `docs/decisions/` | Architecture decision records (ADRs) |
| `docs/dev-log/` | One dated note per work session |
| `.github/` | Pull request template (the CI release workflow is added in Phase 6) |

## 1. Prerequisites (Windows)

- [Node.js](https://nodejs.org) 22 LTS (Taste Skill needs 22+; everything else works on 20+)
- [Git](https://git-scm.com/download/win) and the [GitHub CLI](https://cli.github.com) (`winget install GitHub.cli`)
- [Obsidian](https://obsidian.md)
- Python 3.10+, only if you use Graphify later
- Claude Code

## 2. Put it on GitHub (one time)

Run these in PowerShell from this folder. The first three lines move two config files out of `setup/` and into their hidden folders.

```powershell
New-Item -ItemType Directory -Force .claude, .github | Out-Null
Move-Item setup\claude-settings.json .claude\settings.json
Move-Item setup\pull_request_template.md .github\pull_request_template.md
Remove-Item setup -Recurse
git init -b main
git add .
git commit -m "chore: scaffold project, PRD and brand kit"
gh auth login
gh repo create catalyst-discovery-crm --private --source . --remote origin --push
```

If you don't use `gh`, create an empty private repo on github.com, then run `git remote add origin https://github.com/<you>/catalyst-discovery-crm.git` and `git push -u origin main`.

**Branching:** use one branch per PRD phase (`phase-1-foundation`, `phase-2-discovery`, ...). Merge to `main` through a pull request; the template has the review checklist. Tag releases `v0.1.0`, `v0.2.0` and so on. In Phase 6, a GitHub Actions workflow will build installers from those tags.

## 3. Open the docs in Obsidian

1. In Obsidian, choose **Open folder as vault** and pick the `docs` folder, not the project root. That keeps `node_modules` out of the vault.
2. Start at `home.md`.
3. These settings are already configured:
   - Links use standard Markdown, so they also work on GitHub and for Claude Code.
   - New notes go to `inbox/`.
   - **Daily note** creates today's dev-log entry.
   - **Insert template** offers the ADR and dev-log templates.
4. Commit notes together with the code. Per-device layout files are already git-ignored.

## 4. Build with Claude Code

1. Install the recommended plugins listed in [docs/tooling/plugins.md](docs/tooling/plugins.md#install-now).
2. Run `claude` in this folder and paste the kickoff prompt.
3. Claude proposes a plan and waits for your approval, then builds one phase at a time, stopping for your review after each phase.
