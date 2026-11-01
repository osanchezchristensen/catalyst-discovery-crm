# ADR 0001: Offline desktop app with Electron and SQLite, no login

- **Status:** Accepted
- **Date:** 2026-11-01

## Context
Catalyst founders need a simple CRM for customer discovery. An earlier draft planned a hosted web app (Lovable + Supabase) with KU email sign-in. That raised account, hosting, cost and student-data questions that the program doesn't need to solve for v1.

## Decision
Ship a downloadable desktop app with no login and no backend. Use Electron + React for the UI and a local SQLite database (better-sqlite3) in the OS app-data folder. Founders share progress with Guides by exporting and importing JSON workspace files.

## Consequences
- No hosting, accounts or server costs. Student and interviewee data stays on the student's computer.
- Guides see a venture only when a founder sends an export. There is no live cohort dashboard.
- Each student is responsible for backups. Mitigation: automatic local backups plus export reminders.
- Installers are unsigned unless KU provides Apple and Windows signing certificates, so first launch shows OS warnings.
- Installers are large (about 100 MB) because Electron bundles Chromium.

## Alternatives considered
- **Hosted web app with Supabase auth:** rejected for v1 because of accounts, hosting and data governance.
- **Browser-only app storing data in IndexedDB:** rejected because clearing browser data erases the workspace, and it's not a real downloadable app.
- **Tauri:** smaller installers, but needs Rust in the toolchain. Revisit if installer size becomes a problem.
