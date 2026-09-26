# File a ticket in three clicks

Status: agreed with Tom on 2026-09-26, not started.

## Problem

Filing a ticket for a stand-in already takes three clicks: **File its ticket** → **Create in Jira** →
**File it now**. The problem is everything around those clicks. The dialog shows the stand-in row
(Issue select, Resolve, File a ticket, Delete) above an inline form. The form holds Project, Summary,
a long Description, two AI buttons, a paragraph of help text, and the masking wall ("214 words go out
as written" plus a grid of **Mask** buttons). All of it is visible at once.

## Target flow

1. **Only the form.** When the dialog opens from a band, it shows only the ticket form. The stand-in
   row goes away. Delete moves into a `⋮` menu in the dialog header.
2. **A known ticket first.** When `matchExistingIssues` or an AI answer names an open issue, one
   line at the top shows it with **Log on KEY**. That path takes two clicks and files nothing.
3. **One compact card.** Project, Summary and Parent are filled in and each has a small change link.
   The Description folds away behind "Edit description".
4. **One AI button.** **Ask AI** already returns an `existingKey`, so **Ask AI to find a match** and
   its help paragraph go away.
5. **Masking moves into the AI step.** The first press of **Ask AI** opens a preview: the prompt,
   the unrecognised words with their **Mask** buttons, and **Send**. A filing without AI never shows
   the masking wall.
6. **Create → File it now stays.** Jira has no undo for a created issue.

The happy path is **File its ticket** → **Create in Jira** → **File it now**, with nothing else in
the way unless the user asks for it.

## Must not change

- ADR 0013: a model call happens only on an explicit press, after the user saw the prompt, and
  every unrecognised capitalised word is marked before the first send. The preview in step 5 carries
  both.
- ADR 0023: only the agent sees pseudonyms. Jira gets real names, and the preview is never unmasked.
- The duplicate check in `libs/timetrack/src/lib/ticket/file.ts` (same summary → take that key).
- The New parent sub-form stays reachable, behind the Parent change link.

## Where the code is

- Entry: `apps/timetrack/src/app/day-review/row-edit/edit-stand-in-waiting.component.ts`
- Dialog: `apps/timetrack/src/app/stand-ins/stand-ins.component.ts`, row in
  `stand-ins-list.component.ts`
- Form: `apps/timetrack/src/app/day-review/create-ticket.component.ts`, state in `ticket-draft.ts`
- Masking: `apps/timetrack/src/app/day-review/unmasked-words.component.ts`
- AI: `libs/timetrack/src/lib/ticket/write.ts` (Ask AI), `match.ts` (find a match)

## Open

- The stand-ins panel opened from the sidebar keeps its list. Decide if its rows get the same
  compact form.
- Verify with a timetrack-e2e spec that counts the clicks of the happy path.
