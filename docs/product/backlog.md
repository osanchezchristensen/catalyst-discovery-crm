# Backlog: next version

Ideas for the version after 0.9.0. Add new items at the bottom. When we plan the next version, move the chosen items into the [PRD](prd.md).

## Planned
The [PRD roadmap](prd.md#next-versions) assigns these items to releases. Their details stay below.

| Release | Items |
| --- | --- |
| v0.10.0 (Phase 7) | 1, 3, 4, 6, and the 25 MB attachment limit from 15 |
| v0.11.0 (Phase 8) | 2, 5 |
| v0.12.0 (Phase 9: 9a 11; 9b 7, 8; 9c 12, 14) | 7, 8, 11, 12, 14 |
| v0.13.0 (Phase 10) | 16 |
| v0.14.0 (Phase 11) | 17 step 1 |
| v0.15.0 (Phase 12) | 22 |
| v0.16.0 (Phase 13) | 20 |
| v0.17.0 (Phase 14) | 19 |
| v0.18.0 (Phase 15) | 21 |
| v0.19.0 (Phase 16) | 18 |
| Not planned yet | 9, 10, 13, 17 step 2 |

Already shipped in v0.9.0, so not new work:
- 15: attachments themselves. The PRD already says workspace export leaves them out, which answers its open question.
- 13: Home already lists follow-ups and flags overdue ones.
- 9: CSV contact import already skips duplicates by email.
- 10: Ctrl+N, Ctrl+E and Ctrl+O already exist.

## Ideas

1. **Right-click to copy and paste.** Shipped in v0.10.0.
   - Today, right-clicking text does nothing: the app has no context menu.
   - Add Cut, Copy, Paste and Select all to every text field.

2. **Clean up pasted interview notes.** Shipped in v0.11.0.
   - Notes are plain text today. Pasting from Word, Google Docs or a web page can bring in messy spacing and lose list structure.
   - Decision: notes use the rich text editor (item 5). A paste keeps only what the toolbar can make (bold, underline, numbered and bullet lists, paragraphs) and drops everything else: fonts, colors, images, tables and links.

3. **Interview types.** Shipped in v0.10.0 (filters and charts by type come with item 11). Add a type to each interview, and let students filter and chart by it:
   - **Informational:** researching the problem.
   - **Validation:** finding out whether they would buy it.
   - **Sales:** trying to sell to them.

   - Decision: the readiness checklist does not count Informational interviews.
   - Decision: the migration sets existing interviews to Validation, so no venture's readiness drops after the update. New interviews require a type.
   - Needs a database migration: a new `type` column on `interviews`.

4. **"Written response" interview format.** Shipped in v0.10.0. A format next to In person, Video and Phone, for surveys and email answers.
   - Small change: one new value in `INTERVIEW_FORMATS` (`src/shared/schema.ts`) and its label. The database doesn't restrict the column, so no migration is needed.

5. **Formatting toolbar on interview notes only.** Shipped in v0.11.0 ([ADR 0006](../decisions/0006-interview-notes-as-allowlisted-html.md)); CSV bullets are `•`, not `-`, because of the formula guard. No other text box gets it: bold, underline, numbered list, bullet list.
   - Decision: use a rich text editor (for example TipTap). It is a new dependency; pick and approve it when planning (CLAUDE.md).
   - Store notes as HTML limited to the toolbar's tags. Clean every note against that list on save and on workspace import, because a shared workspace file could carry hidden scripts.
   - Exports: CSV gets plain text, with lists as `-` or `1.` lines. Workspace export keeps the HTML.
   - Needs a migration that turns existing plain-text notes into paragraphs, and an update so insights read the text without tags.

6. **Spell check.** Shipped in v0.10.0 (Windows and macOS). Spell check in text boxes, with suggestions in the right-click menu (item 1).
   - Electron uses the system spell checker on Windows and macOS. On Linux it downloads dictionaries from the internet, which breaks the no-network rule, so turn it off on Linux.

### Save time

7. **Search everything:** one search box (Ctrl+K) that finds contacts, interviews, quotes and hypotheses.

8. **Import survey answers:** load a CSV from Google Forms or Qualtrics, and turn each row into a "Written response" interview (item 4). The student matches columns to contacts and notes.

9. **Duplicate contact warning:** flag a new or imported contact whose name or email matches an existing one.

10. **Keyboard shortcuts:** new interview, save, and jump between screens. List them in the Help menu.

### Patterns screen

11. **A new Patterns screen** that holds the three pattern finders below, each in its own section. Built in 9a. Decision: the Insights screen already is the tag board, so the tag manager goes there, and Patterns holds referral chains and compare by type.

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
    - Decision: a delete counts as an edit. On import the newest change wins, so a teammate's newer delete moves the row to your Trash (restorable for 30 days), and your newer edit keeps it.

15. **Attach files to interviews:** for example photos of whiteboard notes or survey screenshots, copied into the data folder.
    - Decision: 25 MB limit per file.
    - Answered: workspace export does not include attachments (PRD, "Data storage and privacy"), so the 50 MB import limit is not affected.
    - Attachments shipped in v0.9.0 with no size limit. The 25 MB limit shipped in v0.10.0; files already stored stay.

### Outreach, calendar and agent

16. **Outreach history and do-not-contact.** The base that items 17 and 18 build on.
    - Each contact gets a timeline of dated events: Reached out (with the channel: email, LinkedIn, text, in person, other), Replied, Meeting set, Declined, No reply. Today the Kanban only shows the current stage, not when or how.
    - A **Do not contact** flag. A flagged person can't be moved to Reached out, drops out of follow-up reminders, and an agent can never suggest them again (matched by email, or by name plus organization).
    - Home gets a "Waiting on a reply" list: reached out 7 or more days ago with no reply. The 7 days is editable in Settings.
    - Moving a card to Reached out in the Kanban records the event, so students don't enter things twice.
    - Needs a migration: a `contact_events` table (id, contact_id, type, channel, at, note, actor: `student` or `agent`) and `contacts.do_not_contact`.

17. **Calendar with meeting-time integrations.** Two steps. Step 1 needs no network.
    - **Step 1, offline:**
      - **Meetings.** When a contact moves to Scheduled, ask for the date, time, time zone, format and a meeting link or place. Logging the interview later pre-fills from it. Needs a `meetings` table (id, venture_id, contact_id, starts_at in UTC, ends_at, time_zone, format, location_or_link, status: scheduled, done or canceled).
      - **Calendar screen** with month, week and agenda views of meetings, follow-up due dates and tasks, with overdue items flagged. It must work from the keyboard (arrow keys move between days) and meet the accessibility rules. Build it as a plain grid; a calendar library is a new dependency, so approve it when planning (CLAUDE.md).
      - **Add to calendar.** Each meeting saves an `.ics` file that Outlook, Google Calendar and Apple Calendar open. "Export upcoming meetings" saves one `.ics` for all of them. Files keep the app offline.
      - **Scheduling link.** A Settings field for a Microsoft Bookings, Calendly or Google appointment page, with a one-click copy for outreach emails and the follow-up email template (item 13).
      - Home shows today's meetings.
    - **Step 2, optional, needs network (write an ADR before building):** connect Microsoft 365 (KU Outlook) and/or Google Calendar.
      - Read free/busy to suggest open times. When a contact agrees to a time, create the event with a Teams or Meet link, and update or cancel it later.
      - This breaks the app's no-network rule, so it must be off by default and opt-in per account. Allow only the sign-in and calendar hosts. Sign in through the system browser (OAuth with PKCE; the repo is public, so no secret can ship). Store tokens with Electron `safeStorage`.
      - Open questions: does KU's Microsoft tenant let a student approve a third-party app, or does it need an administrator? Who registers and owns the app registration? If neither is settled, ship Step 1 only.
      - Once Step 2 exists, the agent (item 18) can propose meeting times from free/busy.

18. **AI agent access: find prospects, draft outreach, keep stages current.** A student runs an AI agent (Claude Code or the Claude desktop app) that finds people to interview, drafts messages, and updates the CRM as people are contacted and reply. The app itself stays offline. Design and open decisions: [ADR 0005](../decisions/0005-ai-agent-access-through-local-mcp-server.md). How to use it: [agent playbook](../guides/agent-playbook.md).
    - **Use it today, no new code.** The agent writes a CSV of prospects and the student imports it with File ▸ Import Contacts from CSV… Duplicates by email are skipped. Stage changes are still made by hand until the connector below exists.
    - **The connector.** A small local MCP server, run by the student's agent, that reuses the app's data layer and validation. It is off until the student turns on "Allow an AI agent to use this workspace" in Settings.
    - **The agent can:**
      - read the venture's pitch, problem, segments and hypothesis statements, so it knows who to look for;
      - read contacts (name, role, organization, segment, stage, email for matching replies; never phone numbers);
      - suggest a prospect, with why they fit and a source link;
      - save an outreach draft on a contact;
      - log that outreach happened, and log a reply (interested, declined, meeting time, do not contact).
    - **The agent cannot:** send any message, delete anything, edit what the student typed, read interview notes, transcripts, quotes, insights or attachments, export or import, or change settings.
    - **Review queue.** Suggested prospects wait in a "Suggested" tray until the student accepts or rejects each one. Rejected people are remembered and not suggested again. A daily cap (default 10) keeps the agent from flooding the queue.
    - **Replies.** If the student connects an email tool to the agent (read-only), the agent can notice replies and log them. Otherwise the student tells the agent what happened.
    - **Needs:** item 16 first. A migration adds `contacts.review_status`, `added_by`, `fit_reason` and `source_url`. The MCP SDK (`@modelcontextprotocol/sdk`) is a new dependency, so approve it when planning.

### Data, charts and transcripts

Already in the app: Viability charts for interviews per week, interviews by segment, pain scores and top insight tags; a hypothesis scorecard; a pain score (1 to 5) and a buying-signal field on each interview; and a weekly interview goal. Items 19 to 22 build on those.

19. **Audience breakdown, date ranges and goal targets.** Chart the work over time, by who was interviewed, against the numbers the student wants to hit.
    - **Audience** on each contact: **Peer**, **Customer** or **Expert**. This is a different idea from segments (groups of customers) and from interview type (item 3: Informational, Validation, Sales), so the labels must make that clear. Contacts that have no audience yet appear as "Not set" in every chart.
    - **Date range** on the dashboard: this week, last 4 weeks, this semester, or custom. Charts switch between by week and by month.
    - **Goals.** The student sets targets for the venture, for example 15 customer, 5 expert and 5 peer interviews by the end of the semester. Each chart shows progress as "7 of 15" with a goal line, plus an on-pace marker (where they should be today if they keep an even pace). The existing weekly goal stays.
    - **Filters** for audience, segment and interview type apply to every chart on the screen, and the active filters are always shown, so a chart is never read without knowing what was cut.
    - Needs a migration: `contacts.audience`, and a `goals` table (id, venture_id, metric, audience, target, due_date).
    - Decision: audience belongs to the contact, not to each interview.
    - Decision: count-type readiness thresholds (for example, 10+ beachhead interviews) read from a matching goal, so students set each number once. The other thresholds (pain score and share, hypothesis counts) stay in Settings. When no goal matches, the Settings value is used.

20. **Score responses: likelihood to use and to recommend.** Capture a number for each answer, then see how the numbers change over time and by who said them.
    - Two new fields on each interview, both optional: "How likely are you to use this?" and "How likely are you to recommend it?" Decision: 0 to 10 for both. 0 to 10 is the standard scale for "recommend", and using it for both keeps the form simple.
    - Charts:
      - **Over time:** each interview is a dot, with a trend line once there are 5 or more. Decision-log entries (a pivot, for example) appear as markers on the timeline, so the student can see whether scores moved after a change. "Recent updates" is read two ways here, the last 30 days and before/after each decision. Tell me if you meant something else.
      - **By who said it:** audience, segment, and each individual contact. Clicking a dot opens that interview and its quote.
      - Recent versus earlier: average of the latest 5 interviews next to all earlier ones.
    - Small samples: always show how many answers (n) beside every average, and show every individual dot, not only the average. Hold back percentages and trend lines below the minimum n and say so.
    - Label these as **stated interest** (what they said), kept apart from **commitments** (what they did: a pilot, a pre-order, an introduction). The interview guide builder warns against "Would you buy…" questions because hypothetical answers overstate real demand, so a high score alone should never turn a readiness item green.
    - Needs a migration: `use_score` and `recommend_score` columns on `interviews`, each 0 to 10 or empty. Survey imports (item 8) can fill them.

21. **See everything as charts, not just lists.** Today most screens are words and numbers. Add a visual to each place where a pattern matters, and add a "view as table" for each.
    - **Contact pipeline:** a funnel from Identified to Reached out, Replied, Scheduled and Interviewed, with how many drop off at each step. (Reached out and Replied dates need item 16.)
    - **Interview timeline:** one dot per interview on a date axis, colored and shaped by audience, sized by pain score.
    - **Hypotheses:** each card shows a small stacked bar of Supports, Refutes and Neutral evidence beside the status, so the weight of evidence is visible at a glance.
    - **Readiness checklist:** each item as a progress bar toward its target, not just a check mark.
    - **Home:** a small trend of interviews per week against the weekly goal.
    - **Everything view:** one page of small charts for the whole venture (pipeline, timeline, scores, evidence, goals) that fits on a screen and prints on one page. Add it to the one-page summary PDF (item 12).
    - **Rules.** Use the chart colors in `tokens.css` and the brand kit. Never rely on color alone: add shapes, patterns or labels. Every chart has a plain-language title that states what it shows, shows n, and has a "view as table" button for keyboard and screen-reader users. Charts use Recharts, which is already in the stack, so there is no new dependency. Planned as one release (Phase 15). Split it by screen during planning if it is too big for one session.

22. **Interview transcripts.** A place to keep the written record of each interview.
    - A **Transcript** section on each interview. The student pastes text, or loads a `.txt`, `.vtt` or `.srt` file (the formats Zoom, Teams, Google Meet and Otter export). For caption files, a checkbox removes the timestamps. Word `.docx` files would need a new dependency, so paste those instead.
    - Stored as plain text in its own table, so long transcripts don't slow the interview list. Suggested limit: 1 MB of text per transcript.
    - **Speaker labels** are text the student types or pastes ("Maya:", "Me:"). The app does no automatic speaker detection and no transcription (PRD non-goals).
    - **Search:** transcripts are included in Search everything (item 7). Check that the bundled SQLite supports full-text search (FTS5) before choosing how.
    - **Turn text into evidence:** select a passage, then choose **Save as quote** or **Save as insight**. The saved item keeps a link back to that spot in the transcript.
    - **Privacy:** a transcript is the most sensitive thing in the app: someone's own words, sometimes with names and company details.
      - A checkbox on the interview, "The person agreed to be recorded or transcribed", shown beside the transcript section as a reminder, not a block.
      - Transcripts are left out of workspace export and CSV export by default, with an option to include them (the same way attachments and interviewee emails are handled).
      - The AI agent (item 18) can never read them.
    - Needs a migration: a `transcripts` table (id, interview_id, text, source, consent_confirmed, added_at).
