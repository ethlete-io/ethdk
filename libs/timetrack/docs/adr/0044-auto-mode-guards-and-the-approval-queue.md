# Auto mode's guards and the approval queue

This ADR records decisions the human made on 2026-09-28 and 2026-10-06 with ADR 0035, taken from the plan
`auto-mode.md` before it was trimmed to its open items (ADR 0352). ADR 0035 holds what auto mode does. This one holds
the guards around it.

## Invariants

1. The Tempo sync is a human press. No auto mode action and no CLI call writes to Tempo without it. `tempo.sync` and
   `tempo.delete` wait in the queue, and "Approve all" never includes them.
2. A human edit wins. Every field auto mode can set carries its source: `human`, `auto` or `observed`. Auto mode never
   writes a field whose source is `human`. A UI edit sets `human`. A reset in the UI is the only way back to `auto`. A
   stored value without a source reads `human`.
3. A locked app answers no agent op, read or write.
4. Every agent op has a class in one exhaustive `Record<AgentOp, OpClass>`, so a new op without a class fails the
   typecheck.

## Action classes

`read`, `local`, `external` and `human-only`, from loosest to strictest. Auto mode takes `local` actions (name a band,
resolve a stand-in, pick a parent) and reversible ones directly. An `external` action (`jira.create`, a status change)
and any CLI write wait in the queue. A `human-only` action (`tempo.sync`, `tempo.delete`, `standIn.remove`, settings,
rules, masked names) is never done by auto mode and waits one by one in the queue.

A class is a setting. The user may move an action to a stricter class, never a looser one than the table gives; the
stricter of the table and the pick wins. Auto mode has two actions of its own, `autoMode.apply` (`local`) and
`autoMode.create` (`external`). At `human-only` auto mode writes nothing.

## The approval queue

- One queue for CLI writes and the `external` actions of auto mode. Each item shows who asked, what it writes and the
  exact payload.
- A CLI write returns `queued` at once and never blocks. An item expires at the end of the day it was asked on, and a
  decided one is kept for 7 days. The queue lives in the encrypted store.
- A queued item previews on its band with an inline chip to approve or reject. An action with no band waits behind a
  small header pill that opens a short list. A lane of its own and a header queue list were rejected, the list because
  it can grow huge.

## Call transcripts

Auto mode reads a call's transcript only with a second switch, off by default and shown only while transcription is on.
Only the transcript of the call it asks about goes into the prompt, masked, never another call's. The switch's text
says the transcript goes to the reasoning command.

## Off-topic rests

Auto mode may suggest hiding the unnamed rest band of an ended call that was off topic. It is a suggestion in the queue,
never an action, and it reads no transcript or audio, only which app was focused.
