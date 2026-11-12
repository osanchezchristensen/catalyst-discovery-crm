# ADR 0006: Interview notes stored as allowlisted HTML

- **Status:** Accepted
- **Date:** 2026-11-11

## Context
Students asked for bold, underline and lists in interview notes (backlog #5). They also asked that pasting from Word, Google Docs or the web stop bringing in messy formatting (backlog #2). Notes were plain text in a JSON object with four fields. A shared workspace file is untrusted input, so whatever we store must be safe to load.

## Decision
The four interview note fields use a TipTap editor, pinned to an exact version. It is built only from the parts the toolbar needs: document, paragraph, text, bold, underline, lists and undo.

Notes are stored as HTML limited to `<p> <strong> <u> <ul> <ol> <li>`, with no attributes. Note HTML is cleaned in three places:
- in the main process on every save, through the zod schema;
- on workspace import;
- by migration v6, which turns existing plain-text notes into paragraphs.

The cleaner is about 30 lines in `src/shared/notes.ts`, not a library. CSV export turns notes into plain text, with lists as `•` and `1.` lines. Key quotes and every other field stay plain text.

## Consequences
- A paste keeps only what the editor's schema allows, so #2 needs no separate code.
- The HTML is only ever parsed by the editor or turned into text. It is never inserted into the page as raw HTML, so the cleaner is defense in depth. Keep it that way: any new place that shows notes must go through `noteToPlain` or the editor.
- Adding a format later (for example italic) means adding the extension, adding the tag to `NOTE_TAGS`, and adding one test.
- Files from v0.11.0 and later carry HTML notes. Older files are converted on import by their `schema_version`.
- Nine new runtime packages, all from the TipTap project. They are pinned exactly and upgraded on purpose.
- CSV bullets are `•`, not `-`, because a cell starting with `-` trips the formula-injection guard.

## Alternatives considered
- Markdown in a plain textarea: no toolbar, and students would see the syntax.
- TipTap StarterKit with features switched off: fewer packages, but an upgrade could switch on a new mark by default.
- `sanitize-html`: well tested, but it is another dependency (plus `htmlparser2`), and the allowlist here is only six tags with no attributes.
- Storing ProseMirror JSON: safer to parse, but the PRD asks for HTML, and the CSV and import code would need a JSON walker anyway.
