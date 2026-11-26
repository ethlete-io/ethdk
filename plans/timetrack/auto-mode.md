# Auto mode and the approval queue

Slices 1 to 5 are built, and so are the call-transcript naming, the bug-hunt merge-request answer, the Jira mirror, the
per-ticket descriptions and the re-parse of stored agent sessions. The decisions are in ADR 0035 and ADR 0044. The
code is in `libs/timetrack/src/lib/review/auto-mode.ts`, `ticket/`, `agent-api/` and `apps/timetrack/src/app/day-review/auto-mode.ts`.
Only open things follow.

## Open

- **Auto descriptions.** They run only while today is on screen. The spec header (`specForCommits$`) is not in the auto
  payload, and an auto-named row carries no confidence of its own. A failed run is stored and never retried, and a
  draft with no project key is stored, not queued. A restart between the queue write and the answer write asks the
  model once more (the queue item's target makes that ask reuse the waiting create). The readout does not list
  descriptions.
- **Naming asks.** Rows the user split or merged are not auto-named (no unnamed group maps to them). Context asks wait
  for git discovery, as the stand-in pass does.
- **The create form's parent fill** (ranking, spec epic, agent wording) is never stored as `human`, because the select
  emits `valueChange` only on a pick. `auto-mode.spec.ts` in timetrack-e2e guards it.
- **Bug hunts.** A stretch with no merge request yet still goes to the model and may draft; later activity replaces the
  draft. `sessions` is not part of the evidence string, so a session that writes later does not re-ask by itself.
- **Reads.** `standIn.list` does not report the resolution or parent source yet.
- **Class settings.** The readout covers the day on screen, not only today, and lists no undo of its own (the row reset
  and "Hand back to auto mode" stay the way back). The action and choice labels live in the app component, not next to
  `CLASSED_ACTIONS`, so a new classed op shows its op name until it gets a label. No e2e drives `autoMode.apply` at
  `external` through the queue.
- **Call transcripts.** Whisper invents text on near-silence at a call's start. Cap the excerpt and say in the prompt
  that the text is a raw machine transcript. Check whether `pseudonym.ts` runs over transcript text too.
- **Off-topic rests.** Thin data: one real rest band (2026-09-28, 90 min, 3.4% call focus), so the 5% threshold is
  conservative. Focus alone does not tell a rest from call work (2026-09-24: 45 minutes past a meeting booked as call
  work at 1.4%); the user's own end cut guards it. Next: a voice-activity flag per quarter from the microphone and
  the call's playback level, a level only, never audio content.
