# A prompt nobody asked for is not presence, and an unattended band is never a Tempo row

ADR 0006 rests on one sentence: "a prompt the user typed is presence... only the first is a person
pressing keys at a known instant". That was true when every session began because somebody typed into
it. It stopped being true when Tom started to run agents on a schedule.

Measured on 2026-09-12. This machine held 592 events. Between 01:30 and 22:30 it held 36, and all 36
were `git-commit` — commits a `git pull` brought in from a second machine an agent had worked on
overnight. The day drew three bands and two breaks out of them, named one ET-772, and offered 3 h 33 m
to Tempo. Tom's words: "syncing these times to tempo would be straight up lying about work hours."

The second machine was not running Timetrack. Had it been, the day would have been worse rather than
better: it would have reported those hours with sessions, prompts and turns behind them, and every one
of them reads today as a person at a keyboard. So this is not a problem cross-machine sync solves. An
agent run nobody watched is indistinguishable from one somebody watched, on any machine, from the
collectors alone.

**The agent is what knows.** Claude Code records who asked for every prompt: `origin.kind` is `human`,
`task-notification` or `peer`, and the older `promptSource` is `typed`, `queued`,
`suggestion_accepted` or `system`. Across Tom's logs on 2026-09-12: 1972 human, 168 task
notifications, 175 `system`. Nothing has to be collected, inferred or watched for — the fact is
already in the file, and reading it is not surveillance in the way "was there a keystroke" would be.

So `AgentPromptEvent.askedBy` carries it, and `askedBy: 'machine'` denies presence. Such a prompt
opens no stretch, extends none, holds none open across an `idle-start`, and ends no stretch away.
A turn has no `askedBy` of its own, so its **session** answers for it: a turn belongs to whatever the
session was last asked for, which is what lets a person take a scheduled session over mid-run.

**A second rule sits under it, because the first one will not always hold.** A band no human signal
falls inside is never proposed to Tempo, whatever issue its branch names. `attendedAt` reads the four
things that say a person was here — a window brought to the front, an idle transition, a human prompt,
a call — and `markAttendance` answers the question per band, which is the unit the user books.

The two rules are deliberately redundant. The first is precise and depends on a field a provider may
rename. The second is crude and depends on nothing. On 2026-09-12 the first would not have helped at
all, because this machine held no agent events to read — the second is what refuses those three bands.

## Consequences

- **A log that records neither field still counts as a person.** Codex records no origin, and an old
  Claude Code log records none either. `askedBy` is absent there, and absent is not `machine`. The
  rule can only ever subtract time the day would otherwise have invented.
- **Spend is untouched.** A token is spent at an instant and paid for either way, so an unattended
  session's turns still land on their stream, and `StreamDay.spend` still counts them. This ADR is
  about who was there, and ADR 0002 is about what it cost.
- **The band is drawn, not hidden.** `WorklogProposal.unattended` marks it, the timeline reads
  "Nobody was here" instead of "Not yet named", and `DayCheck` splits `unattendedMs` out of
  `unattributedMs` with its own warning. Time waiting for a name is a question for the reviewer;
  the machine's own time is not.
- **The user can still name it by hand**, and that names it. The barrier is against a day proposing
  such an hour, not against a person deciding they were in fact there. A refusal nothing could
  override would be a refusal that gets worked around.
- **A commit is still a presence source, and is still wrong on a pulled commit.** `git` stays in
  `PRESENCE_SOURCES`: on a normal day a commit is real presence, and taking it out would lose a
  terminal-only afternoon. What the second rule does is stop a pulled commit from _booking_ anything.
  Recording when this machine first saw a commit, beside when it was authored, is the fix for the
  bands themselves, and it is not built yet.
- **This changes what M7 has to carry.** A cross-machine merge may not send presence alone. It has to
  send the attendance verdict: a minute is attended if any of the user's machines saw attendance in
  it, and unattended if work ran and none did. A merge that drops unattended time would make a real
  day on the second machine book short again, which is the failure M7 exists to remove.
