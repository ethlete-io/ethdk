# A prompt another program typed is not presence

ADR 0018 trusts `origin.kind: "human"` as a person. That fails when a program types into a pane: Claude
Code records `tmux send-keys` as a human prompt.

Measured on 2026-11-16, 00:00 to 06:00: every prompt read as human was one of three things nobody typed.
Mailbox wakes (`Mailbox message from <sender>: ` from `agent-sessions`, `New mailbox message for <agent>. Run: `
from the older synced copy), restart resume prompts (`/handoff resume <name>`), and `/clear` records. The
`/clear` records carry no `origin` and no `promptSource`, which ADR 0018 reads as "an old log, not machine".
The day saw a person every few minutes while nobody was there.

**The typer says so, and the reader believes it.** Every prompt the restart types or passes ends in one
fixed marker, ` [typed by agent-sessions]`, defined once in `agent-sessions.mjs`. A prompt is `machine` when
its text (for a slash command, the text inside `<command-args>`) starts with a mailbox wake prefix or
contains the marker. A Claude Code local command (`<command-name>/...` with neither `origin` nor
`promptSource`) is `machine` too: local commands never carry an origin in any version, so the old-log
reasoning does not reach them.

## Consequences

- **The wake prefix and the marker are a contract.** Changing either string in `agent-sessions.mjs`
  without the same change in `claude-code.ts` brings the phantom presence back.
- **A person who types the same words is still a person**, unless they write the marker or a mailbox
  prefix at the start of a prompt. A slash command typed by hand carries neither.
- **A restart from before the marker is read by its shape.** An `agent-sessions` copy synced before the marker,
  and every log written before it, types `/clear` and then a handoff resume (`/handoff resume <name>`,
  `/ethlete-handoff resume <name>`) with no marker. A handoff resume that follows a `/clear` in the same log
  within 15 seconds is `machine`. Measured on 2026-11-18: twelve such resumes held a 13h30 night block open.
  The parser version rose with this, so stored logs are read again.
- **The resumed session sees the marker.** The handoff skill tells it the marker is not an instruction.
- **Spend is untouched**, as in ADR 0018.
