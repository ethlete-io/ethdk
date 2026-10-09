# Auto mode and the approval queue

Status: slices 1 to 5 done (2026-09-28), ADR 0035 approved.

## Goal

Timetrack names the day by itself. With auto mode on, the AI finds the ticket a band belongs to. If
no ticket matches, it drafts a new one and finds its epic. The human keeps two things: the Tempo
sync, every time, and the last word on any field they edited.

The agent endpoint (the `timetrack` CLI and other agents) gets the same guard. It answers only while
the app is unlocked, and every write it asks for waits in the app for a confirm.

## Settled decisions this changes

- "A model runs only on an explicit press" and "its answer is never above `weak`" (ADR 0013, 0023).
  With auto mode on, a model runs without a press. Turning auto mode on is the consent. A new ADR
  must supersede this part of 0013 and 0023 before slice 4 lands. Pseudonymisation stays unchanged.
- "The agent endpoint lists stand-ins and writes none" is already stale: `jira.create`,
  `worklog.add`, `standIn.remove`, `standIn.rename`, `standIn.split` and `tempo.sync` exist. The
  ADR fixes the sentence.

## Invariants

1. The Tempo sync is a human press. No auto mode action and no CLI call writes to Tempo without it.
   A CLI `tempo.sync` or `tempo.delete` request waits in the queue, and "Approve all" never
   includes it.
2. A human edit wins. Every field auto mode can set carries its source: `human`, `auto` or
   `observed`. Auto mode never writes a field whose source is `human`. Any edit in the UI sets
   `human`. A reset in the UI is the only way back to `auto`.
3. A locked app answers no agent op, read or write.
4. Every op has a class, in one exhaustive `Record<AgentOp, OpClass>`. A new op without a class
   fails the typecheck.

## Action classes

| Class        | Auto mode       | CLI                | Examples                                                                                 |
| ------------ | --------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `read`       | yes             | yes, when unlocked | `day.rows`, `jira.search`, `standIn.list`, `tempo.worklogs`                              |
| `local`      | yes, reversible | queued             | name a band with an existing issue, resolve a stand-in, pick a parent, rename a stand-in |
| `external`   | queued          | queued             | `jira.create` (ticket or epic), a Jira status change                                     |
| `human-only` | never           | queued, one by one | `tempo.sync`, `tempo.delete`, `standIn.remove`, settings, rules, masked names            |

Every `local` action auto mode takes shows as `auto` on its field and has an undo. Classes are
settings: the user can move an action to a stricter class, never to a looser one than the table.

## The approval queue

- One queue for both sources: CLI writes and the `external` actions of auto mode.
- Each item shows who asked (CLI client name or "auto mode"), what it writes, and the exact payload.
- Presses: approve, reject, and "Approve all" for every item that is not `human-only`.
- A CLI write returns `{ status: 'queued', approvalId }` at once. The op `approval.status` returns
  `queued`, `approved` with the result, `rejected` or `expired`. An item expires after a set time.
- The queue lives in the encrypted store, so a restart keeps it and a lock hides it.
- Where it shows (design call `timetrack/auto-mode/01-pending-actions`, 2026-09-28): A chosen. An
  action with a band previews on that band (dashed accent) with an inline chip and ✓ / ✕, like
  the ✂ cut line; the row's edit popover gets an "Auto mode suggests" section with the readable
  diff; actions without a band wait behind a small header pill that opens a short list. The JSON
  modal goes. B (a lane on the right) rejected; C (header queue list) rejected because the list
  can grow huge. Built (2026-09-28): a band shorter than two lines shows a dot instead of the chip
  (approve from its edit surface); a `worklog.add` on no row draws a dashed preview band at its span
  in the "No checkout" lane, with the chip. e2e in `inline-approvals.spec.ts`, including a create on
  a stand-in band.
- The sidebar shows "Auto mode · on" with the waiting count while auto mode is on.

## Slices

1. **Lock gate and op classes.** Done. The endpoint refuses every op while locked. Add the class table in
   `libs/timetrack/src/lib/agent-api/model.ts`. Unit specs for the gate and the table.
2. **Approval queue.** Done. Store, `approval.status` op, queue panel in the app with approve, reject and
   "Approve all". Route every non-read CLI op through it. e2e: a queued `jira.create` files only
   after the press; "Approve all" skips `tempo.sync`. Plan-only `standIn.split` (no `apply`) and
   `tempo.sync` (no `planHash`) stay direct answers. The class comes from the table on every read,
   never from the store. Contract v3; the CLI names itself via `TIMETRACK_CLIENT` or Claude Code.
3. **Field sources.** Add `human | auto | observed` to the row fields auto mode can set (issue,
   description, parent, stand-in resolution). Any UI edit sets `human`. Spec: an auto pass after a
   human edit changes nothing. Done. `FieldSource` in `libs/timetrack/src/lib/model/field-source.ts`.
   A row's `issue` (key or stand-in) and `description` carry `sources` on `ProposalOverride` and
   `PinnedRow`; a stand-in carries `resolutionSource`. Setters take `source` (default `human`) and an
   `auto` write to a `human` field returns its input. A stored value without a source reads `human`.
   Approved CLI writes (`day.edits`, `worklog.add`) are `human`: the approve press is the user's. The
   existing "Reset to the proposal" row action is the UI reset. Open for slice 4: no stored slot for a
   drafted parent yet (the create form ranks it live), no way back to `auto` for a stand-in the user
   reopened, and `day.rows` does not report sources.
4. **Auto mode.** New ADR first. A setting to turn it on. On each new unnamed band or open stand-in:
   run the match; if one matches, apply it as `local`; if none matches, draft the ticket and pick
   its epic, then queue the create as `external`. ADR 0035 (approved 2026-09-28) decides: only the
   current day, never a past one; never `nameMeeting` or `nameCall`; the prompt is kept with the
   answer. Add a stored parent slot with a source, a way back to `auto` for a reopened stand-in, and
   the sources in `day.rows`. Guards to call: `mayAutoWrite`, `mayWrite` in `model/field-source.ts`.
   Done. Pure pass in `libs/timetrack/src/lib/review/auto-mode.ts` (answers stored on
   `DayReviewEdits.auto` with the masked payload); app service `apps/timetrack/src/app/day-review/
auto-mode.ts` runs `writeTicketWithAgent$` once per band and stand-in, names unnamed rows or
   resolves the stand-in as `auto`, and queues a draft as `jira.create` from "auto mode"; the key
   its approval files is applied as `auto`. Setting `reasoning.autoMode` (switch under Suggestions).
   `StandIn.parentKey`/`parentSource` with `withStandInParent`; `withStandInResolutionReset` behind
   "Hand back to auto mode"; `day.rows` rows carry `sources`. Project read shared with the create
   form in `day-review/project-issues.ts`. e2e: `apps/timetrack-e2e/src/auto-mode.spec.ts`.
   Settle gate (2026-10-06): a band or stand-in is asked only once its work (a context's band, a
   stand-in's rows) has been quiet for `AUTO_MODE_SETTLE_MS` (30 minutes), and an answer still auto
   mode's that was asked before then is asked again once it settles; "Ask auto mode again" stays
   immediate.
   Stand-in evidence (2026-10-06): a stand-in's request carries the notes of all its bands on the day,
   weighted by their observed time (`standInNotes` in `ticket/draft.ts`), with its checkout, branch and
   minutes; an app-drafted description is dropped once the bands give notes, and the prompt asks for
   the main outcome, never a minor step. Before, it sent only the name and the description frozen from
   the first 16 minutes, so a day of bracket work drafted a ticket about a `.gitignore` commit.
   Epic candidates (approved and built 2026-10-09): the match list was the project's 100 newest open
   issues, so an issue under the checkout's epic could fall out of it (fifagg-frontend
   `feature/reward-frontend`, FIFAGG-12704 under FIFAGG-12601). A project link now names `epicKeys`
   (Settings → Projects, "Epics" on the path's own row); without them the epics are the parents of
   the issues the user named this checkout's rows with over the last 4 weeks. `fetchJiraEpicChildren$`
   reads their open children, cached per project and epic for the day and read again after an hour
   or once a stand-in opens (`day-review/day-read-cache.ts`). `ticketMatchCandidates`
   (`ticket/match-candidates.ts`): epic children first (at most 50, marked `inEpic`, only the linked
   project's), then the project's open issues, 100 together, then the logged ones; each key once, no
   sub-task. Every offered issue carries its parent's summary as `parent`, masked. The prompts say to
   prefer `inEpic` and to quote the matching words in `existingReason`, or answer a draft. The list
   stays out of `autoModeEvidenceOf`. A match whose key no evidence names (`autoModeKeyInEvidence`)
   is stored `listOnly` and waits as an `autoMode.apply` with its summary and reason at `local` and
   `external`, like a parent match; nothing at `human-only`. e2e: `epic-candidates.spec.ts`.
   Jira mirror (approved and built 2026-10-09): candidates come from a local mirror, not a per-ask
   read of the 100 newest. `jira/mirror.ts`: each linked project is read whole (open issues and the
   ones updated in the last 30 days, paged, with status category, type, parent and its summary,
   `updated`) once a day, and for `updated >= -Nm` since the last read every 20 minutes while auto
   mode is on (`app/jira/jira-mirror.ts`, skipped within 10 minutes of the last read, so a reload
   costs nothing); a project an ask needs and no mirror holds is read on demand. A failed read keeps
   the mirror held. Stored per project in the encrypted store (`jira_mirror`, schema v24). Per ask
   `rankMirrorCandidates` (`ticket/mirror-rank.ts`) runs BM25 over summary, parent summary and
   subject against the branch, notes, stand-in and spec words (6-letter stems), boosts and marks
   the children of the checkout's epics `inEpic`, puts a key the words name first, and sends the
   best 25 (ties by recency). The epic keys come from the link or from the mirror's parents of the
   issues the checkout was named with; only keys the mirror lacks are read from Jira. Without a
   mirror the ask falls back to the 100 newest. `fetchJiraEpicChildren$` is gone. Before a match
   applies, `fetchJiraIssueState$` reads that one issue: done marks it `done` as before; deleted, or
   answered under another key (moved), marks it `gone`, which never applies or queues and reads out
   as failed. An approved `autoMode.apply` is read again too and refused when gone, or done where the
   card did not say done. The issue picker still searches Jira. e2e: `jira-mirror.spec.ts`.
   Row descriptions: done (2026-09-28). A settled code row of today (a `repo:` lane, ended 30
   minutes before now) that names an issue gets its description written as `auto`, once per row:
   `autoDescriptionAsks`, `autoDescriptionRequest` and `withAutoModeDescription` in
   `review/auto-description.ts`, answers on `DayReviewEdits.autoDescriptions` (a failed run is stored
   too, so it is not retried). It has its own worklog prompt (`ticket/worklog.ts`,
   `writeWorklogWithAgent$`), not the ticket prompt: one line under about 100 characters saying what
   the stretch did, sent the row's ticket key and summary (read from Jira by key; the key alone
   where that read fails) and told not to repeat the summary. An answer of the wrong shape or an
   empty line counts as a failed run. It is a `local` write, not a Jira write, so
   it writes directly and never queues; it runs only while `autoMode.apply` is `local`. A `human`
   description is never touched, also one the user typed while the call ran. Calls, rows without a
   ticket, hidden, rejected, unattended and excluded rows are skipped. The check runs when the day's
   rows change, not on a timer, and the readout does not list descriptions yet.
   Per ticket (2026-10-09): a row whose ticket a standing rule or a background project names waits
   until its day is over; then one call per ticket and day sends the notes of all its rows and writes
   the answer to each (`autoDescriptionTicketId`, `rowIds` on the stored answer), at most 7 days back
   and only while Tempo holds nothing of the day. The day that just ended is read off screen once.
   Open follow-ups:
   - It runs only while today is the day on screen: the review computes nothing for another day.
   - The spec header (`specForCommits$`) is not in the auto payload, and an auto-named row carries
     no confidence of its own (the ticket call answers none).
   - A failed run is stored and never retried; a draft with no project key is stored, not queued.
   - A restart between the queue write and the answer write asks the model again (one more CLI run);
     the queue item's target (day and subject) makes that ask reuse the waiting create.
   - The create form's own parent fill (ranking, spec epic, agent wording) is never stored as `human`:
     the select emits `valueChange` only on a pick. Guarded by `auto-mode.spec.ts` in timetrack-e2e.
   - Rows the user split or merged are not auto-named (no unnamed group maps to them).
   - Context asks wait for git discovery, as the stand-in pass does.
   - `standIn.list` does not report the resolution or parent source yet.
5. **Class settings.** A settings page to make an action stricter, and a readout of what auto mode
   did today. Done (2026-09-28).
   - Design. `OP_CLASS_ORDER` is `read < local < external < human-only`. The setting
     `actionClasses` stores only actions the user moved to a stricter class; `actionClassOf` takes
     the stricter of the table and the pick, so a stored looser class never loosens anything, and
     `parseActionClasses` drops it. Auto mode has two actions of its own: `autoMode.apply` (`local`:
     name a band, resolve a stand-in, set its parent) and `autoMode.create` (`external`: file its
     draft). At `external` a match waits in the queue as an `autoMode.apply` item that only auto
     mode can queue (a CLI calling itself "auto mode" loses the name); at `human-only` auto mode
     writes nothing, and with both at `human-only` it asks nothing. A CLI write already waits in the
     queue, so it offers only `human-only` on top, which keeps it out of "Approve all". A queued
     item follows the class of the action that queued it (`approvalClassOf`); a rejected apply stays
     rejected.
   - Logic: done (2026-09-28). `agent-api/action-classes.ts`, `approvalClassOf` and the apply item
     in `agent-api/approval-queue.ts`, `autoModeApplies`, `autoModeApplyRequest` and
     `autoModeReadout` in `review/auto-mode.ts`. The app service queues the apply, carries out an
     approved one and gates every auto write; "Approve all" reads the setting.
   - UI: done (2026-09-28). "What waits for you" under Suggestions (`settings/action-classes.component.ts`,
     one select per action in `CLASSED_ACTIONS` over `actionClassChoices`, `setActionClass`). The
     readout is the "Auto mode" panel of the day's Debug dialog (`auto-mode-readout.component.ts`,
     `injectAutoMode().readout`). The queue panel's badge and `data-class` read `approvalClassOf`.
     e2e in `auto-mode.spec.ts`: a CLI `jira.create` set to one by one stays out of "Approve all";
     the readout shows the resolved stand-in.
   - Open follow-ups:
     - The readout covers the day on screen, not only today, and lists no undo of its own; the row
       reset and "Hand back to auto mode" stay the way back.
     - The action and choice labels live in the app component, not next to `CLASSED_ACTIONS`: a new
       classed op shows its op name until it gets a label.
     - No e2e drives `autoMode.apply` at `external` through the queue (the unit specs cover it).

- Call transcripts help name a call. Done (2026-10-09). A third subject kind `call` (`rowId`, the
  row's edit id) for an unnamed counted call row of today, after the 30-minute settle gate, asked
  once. The request (`callWritingRequest`) sends the call label, minutes and the issues the user
  logged recently as candidates, plus, with `reasoning.autoModeTranscripts` on, an excerpt of that
  call's own chunks (`callTranscriptExcerpt`: its app's chunks, the first 30 s skipped, cut to 1500
  characters), masked. A match names the row as an `auto` field (`withAutoModeRowNames`), never a
  `nameCall`; a draft is stored, never filed. The transcript switch sits in the transcription panel.
  The row editor of a call band shows the same excerpt under its evidence (`edit-call-transcript`).
  - Re-ask (2026-10-09): a call asked while the switch was off was never asked again, so turning it
    on did nothing for that call. Now a call of today whose stored request carries no `call.transcript`
    (`autoModeSentTranscript`, the record of what was sent) is asked once more when the switch is on
    and an excerpt exists for it (`transcribedCalls` in `autoModeAsks`, read each minute on screen and
    per off-screen pass). It must still be an unnamed call row, so a name by hand or a rule ends it.
    The new answer carries the excerpt, so the rule is false afterwards and never loops.
  - Decided (2026-10-06): a second Settings switch, "Let auto mode read call transcripts", off by
    default and shown only while transcription is on. Only the transcript of the call auto mode
    asks about goes into the prompt, never other calls. `TRANSCRIBE_WHY` must then stop saying
    "Nothing is sent anywhere" and say the text goes to the reasoning command.
  - Read side exists: the `transcript_day` host command (`transcript.rs`), the
    `ports.transcription.day$` port and the `transcript.day` agent op. Chunks carry
    `callStartedAtMs` and `appId`, which pick one call's chunks.
  - Start at the call-naming prompt in `libs/timetrack/src/lib/reason` (`prompt.ts`, `payload.ts`)
    and check whether `pseudonym.ts` must run over transcript text too.
  - Known noise: whisper invents text on near-silence at a call's start ("Hallå … Upp dum dum").
    Cap the excerpt length and say in the prompt that the text is a raw machine transcript.

## Open questions

- Settled in slice 2: a CLI write returns `queued` at once and never blocks; a queued item expires
  at the end of the day it was asked on, and a decided one is kept for 7 days.
- Settled in ADR 0035: auto mode runs on the current day only.
- Off-topic call rests. Auto mode notices that a call went off topic and suggests hiding its
  unnamed rest bands. No transcript or audio content. Discord's mute state is not visible: a mute
  does not change the PipeWire capture node (measured 2026-09-15), and Discord RPC needs an approved
  OAuth app.
  - First slice: done (2026-09-28). `offTopicRests` in `review/off-topic-rest.ts`: a rest band
    (`isRestOfEndedCall`, the band a call ran on into after the user ended its named row) of today,
    at least 30 minutes long, with no calendar occurrence over it, the call's own app focused for at
    most 5% of it and other apps for at least 60% (time away counts toward neither). It waits as an
    `autoMode.hide` item (target `day|hide:rowId`, class follows `autoMode.apply`, none at
    `human-only`) on the band's chip and edit surface; approve hides the row (`show` undoes it). An
    item of any state holds the band, so a rejected one is never asked again. e2e:
    `off-topic-rest.spec.ts`.
  - Real data (`day.inputs` and `day.events`, 2026-09-22 to 09-28): one real rest band so far (09-28,
    90 min, call focus 3.4%, other 96.6%); the named parts of the same day's calls ran 11% to 21%.
    Thin, so the 5% threshold is conservative. Focus alone does not tell a rest from call work: on
    09-24 the user booked 45 minutes past a meeting's end as call work at 1.4% call focus. The user's
    own end cut is what guards it, so this stays a suggestion.
  - Next: a voice-activity flag per quarter from the microphone and the call's playback level (a
    level only, never audio content), to tell a quiet room from a call the user listens to.
