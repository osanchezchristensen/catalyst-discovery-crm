# ADR 0007: Trash as a soft-delete column

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
Backlog #14 asks for a Trash: deleted contacts and interviews can be restored for 30 days. A delete must also count as an edit on workspace import, so the newest change wins. A teammate's newer delete moves the row to your Trash, and your newer edit keeps it.

The workspace merge already uses "newer `updated_at` wins" for every row. Interviews have child rows (evidence and attachments), and other rows point at them (insights, follow-ups, a contact's referrer, an interview's contact).

## Decision
Contacts and interviews get a `deleted_at` column (migration v8). A delete sets `deleted_at` and moves `updated_at`, and a restore clears `deleted_at` and moves `updated_at`. The column travels in workspace files, so the existing merge rule covers deletes and restores with no new merge code.

Every read leaves out trashed rows and shows a link to one as empty, as a real delete would (`ON DELETE SET NULL`). At startup, after the launch backup, rows that have been in Trash for more than 30 days are deleted for good, along with their attachment files. "Delete forever" in Settings → Trash does the same at once (consent requests).

## Consequences
- Foreign keys stay valid while a row is in Trash, so an import never meets evidence or attachments whose interview is missing.
- Every query on contacts or interviews must filter `deleted_at IS NULL`. Tests in `repo.test.ts` (describe `trash`) check each screen's numbers before a delete, after it, and after the restore. New queries need the same filter.
- Editing an insight or follow-up while its interview is in Trash saves the link as empty, so a later restore doesn't bring that link back. The same goes for an interview whose contact is in Trash.
- After a purge, nothing records the delete. A teammate's file from before the delete brings the row back as new. This is marked in `purgeTrash` as a known shortcut.
- Workspace and CSV exports include trashed rows, with `deleted_at` set.

## Alternatives considered
- **A trash table holding JSON copies of deleted rows:** reads would stay untouched. But imports could carry evidence, attachments or links that point at a row sitting in Trash, which breaks foreign keys or needs custom fix-up code for each table.
- **Keeping tombstones forever:** this fixes the "purged row comes back" case, but it needs a new table in the workspace format. Not worth it for a 30-day window.
