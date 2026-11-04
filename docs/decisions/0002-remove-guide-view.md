# ADR 0002: Remove Guide view

- **Status:** Accepted
- **Date:** 2026-11-03

## Context
The PRD (F1, P0) had a header switch between Founder view and Guide view. Guide view was a read-only mode meant for Stage 2/3 students who review a venture that a founder exports to them. The project owner is building the app for the students in their cohort and decided the app does not need Guide view.

## Decision
Remove Guide view entirely: the header switch, the View menu items, read-only mode, the `setViewMode` IPC call, and the `profiles.view_mode` column (dropped by migration v2, which keeps all other data).

## Consequences
- Every student always sees the editable Founder screens. Less code and one less mode to test.
- PRD Phase 5 (Guide feedback F11, cohort and admin console F13, the Guide check-in flow and the Cohort view) is dropped. CSV export moves to Phase 6. The `guide_assignments` and `comments` tables stay in the schema, unused, until a migration removes them.
- Bringing Guide view back needs a new migration that adds the column again.

## Alternatives considered
- Hide the switch but keep the code and column: easier to restore for Phase 5, but leaves unused code and a column nobody sets. The owner chose full removal.
- Keep Guide view: not needed by the owner.
