# Backlog: next version

Ideas for the version after 0.9.0. Add new items at the bottom. When we plan the next version, move the chosen items into the [PRD](prd.md).

## Ideas

1. **Right-click to copy and paste.**
   - Today, right-clicking text does nothing: the app has no context menu.
   - Add Cut, Copy, Paste and Select all to every text field.

2. **Clean up pasted interview notes.**
   - Notes are plain text today. Pasting from Word, Google Docs or a web page can bring in messy spacing and lose list structure.
   - Decision: notes use the rich text editor (item 5). A paste keeps only what the toolbar can make (bold, underline, numbered and bullet lists, paragraphs) and drops everything else: fonts, colors, images, tables and links.

3. **Interview types.** Add a type to each interview, and let students filter and chart by it:
   - **Informational:** researching the problem.
   - **Validation:** finding out whether they would buy it.
   - **Sales:** trying to sell to them.

   - Decision: the readiness checklist does not count Informational interviews.
   - Decision: the migration sets existing interviews to Validation, so no venture's readiness drops after the update. New interviews require a type.
   - Needs a database migration: a new `type` column on `interviews`.

4. **"Written response" interview format,** next to In person, Video and Phone, for surveys and email answers.
   - Small change: one new value in `INTERVIEW_FORMATS` (`src/shared/schema.ts`) and its label. The database doesn't restrict the column, so no migration is needed.

5. **Formatting toolbar on interview notes only** (no other text box gets it): bold, underline, numbered list, bullet list.
   - Decision: use a rich text editor (for example TipTap). It is a new dependency; pick and approve it when planning (CLAUDE.md).
   - Store notes as HTML limited to the toolbar's tags. Clean every note against that list on save and on workspace import, because a shared workspace file could carry hidden scripts.
   - Exports: CSV gets plain text, with lists as `-` or `1.` lines. Workspace export keeps the HTML.
   - Needs a migration that turns existing plain-text notes into paragraphs, and an update so insights read the text without tags.

6. **Spell check** in text boxes, with suggestions in the right-click menu (item 1).
   - Electron uses the system spell checker on Windows and macOS. On Linux it downloads dictionaries from the internet, which breaks the no-network rule, so turn it off on Linux.

### Save time

7. **Search everything:** one search box (Ctrl+K) that finds contacts, interviews, quotes and hypotheses.

8. **Import survey answers:** load a CSV from Google Forms or Qualtrics, and turn each row into a "Written response" interview (item 4). The student matches columns to contacts and notes.

9. **Duplicate contact warning:** flag a new or imported contact whose name or email matches an existing one.

10. **Keyboard shortcuts:** new interview, save, and jump between screens. List them in the Help menu.

### Patterns screen

11. **A new Patterns screen** that holds the three pattern finders below, each in its own section.

    - **Referral chains:** add a "Referred by" contact field and show which interviews led to new ones.
      - Interview guides: the question bank already has "Who else should I talk to about this?" (`src/shared/guides.ts`). Make it the last question of every guide by default, and let the answer create a new contact with "Referred by" filled in.

    - **Tag board:** group insights by tag, like sticky notes on a wall, to spot themes across interviews.
      - **Tag manager:** rename, merge and delete tags in one place, so "price" and "pricing" become one tag.

    - **Compare by interview type:** pain scores, buying signals and quotes for Validation interviews side by side with Sales ones (needs item 3).

### Share progress

12. **One-page summary PDF:** the venture, top hypotheses, readiness, best quotes and the latest decision, for mentor meetings or demo day. It uses Electron's built-in print-to-PDF, so no new dependency.

13. **Follow-up reminders:** when the app opens, show follow-ups that are due today or overdue.
    - **Follow-up email template:** a "Copy follow-up email" button on each interview that fills in the contact's name, a thank-you, the next step and the follow-up date. The student pastes it into their own email (the app never sends email). Let students edit the template in Settings.

### Protect work

14. **Trash with undo:** deleted interviews and contacts stay in a Trash for 30 days, and can be restored.
    - Needs a migration (a `deleted_at` column).
    - Open question (undecided): how workspace import treats deleted rows. If a teammate deleted an interview, should importing their file delete it for you too, or keep yours?

15. **Attach files to interviews:** for example photos of whiteboard notes or survey screenshots, copied into the data folder.
    - Decision: 25 MB limit per file.
    - Open question: whether workspace export includes attachments. Today's import refuses files over 50 MB, so two attachments could already exceed it.
