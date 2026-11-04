# ADR 0003: Guides table and weekly goal column

- **Status:** Accepted
- **Date:** 2026-11-03

## Context
Phase 6a adds interview guides (F9) and a weekly interview goal with a streak (F12). The v1 data model had no place for either: guides need their own rows with an ordered question list, and the goal belongs to a venture so it travels with workspace exports.

## Decision
Migration v4 adds `ventures.weekly_goal` (integer 1–20, default 3) and a `guides` table (`id`, `venture_id`, `name`, `questions` as a JSON array, timestamps), deleted with its venture. Both are part of the workspace file. Files exported before v4 still import: a missing `weekly_goal` defaults to 3 and a missing `guides` list is empty.

## Consequences
- Guides and goals move between computers with export/import like everything else.
- The streak judges past weeks against the current goal; raising the goal can shorten the streak. A goal history table would fix that if students complain.
- Questions are stored inside the guide, not as rows, so they can't be shared between guides. That's fine for a handful of guides per venture.

## Alternatives considered
- Store the goal in `meta`: not exported, and not per venture.
- One row per question: easier sharing and reuse, but more code for ordering with no current need.
