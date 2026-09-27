# Auto mode and the approval queue

Status: planned, not started (2026-09-27).

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

1. **Lock gate and op classes.** The endpoint refuses every op while locked. Add the class table in
   `libs/timetrack/src/lib/agent-api/model.ts`. Unit specs for the gate and the table.
2. **Approval queue.** Store, `approval.status` op, queue panel in the app with approve, reject and
   "Approve all". Route every non-read CLI op through it. e2e: a queued `jira.create` files only
   after the press; "Approve all" skips `tempo.sync`.
3. **Field sources.** Add `human | auto | observed` to the row fields auto mode can set (issue,
   description, parent, stand-in resolution). Any UI edit sets `human`. Spec: an auto pass after a
   human edit changes nothing.
4. **Auto mode.** New ADR first. A setting to turn it on. On each new unnamed band or open stand-in:
   run the match; if one matches, apply it as `local`; if none matches, draft the ticket and pick
   its epic, then queue the create as `external`.
5. **Class settings.** A settings page to make an action stricter, and a readout of what auto mode
   did today.

## Open questions

- Does a CLI call wait for the decision, or only return `queued`? The plan says `queued`, because
  a CLI that blocks for minutes looks hung.
- How long until a queued item expires? Proposal: end of the day it was asked on.
- Does auto mode run on past days, or only on today and new evidence?
