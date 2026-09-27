# Auto mode and the approval queue

Status: slices 1, 2 and 3 done (2026-09-28); slice 4 next.

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
   its epic, then queue the create as `external`. Start here: draft ADR 0035 (supersedes the
   press-only and `weak` cap parts of 0013 and 0023, and fixes the stale endpoint sentence) and get
   the user's approval before any code. Decide with the user: past days or only today; whether auto
   mode may write the remembered meeting and call names (`nameMeeting`, `nameCall`, no source yet).
   Then add a stored parent slot with a source, a way back to `auto` for a reopened stand-in, and
   the sources in `day.rows`. Guards to call: `mayAutoWrite`, `mayWrite` in `model/field-source.ts`.
5. **Class settings.** A settings page to make an action stricter, and a readout of what auto mode
   did today.

## Open questions

- Settled in slice 2: a CLI write returns `queued` at once and never blocks; a queued item expires
  at the end of the day it was asked on, and a decided one is kept for 7 days.
- Does auto mode run on past days, or only on today and new evidence?
