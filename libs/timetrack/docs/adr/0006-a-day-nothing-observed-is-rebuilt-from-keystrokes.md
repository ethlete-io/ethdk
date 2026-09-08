# A day nothing observed is rebuilt from the keys the user pressed, and a turn only bridges

Presence is built from `window-focus` and the idle transitions, and presence gates every block. Both
are edge-triggered and exist only while the application runs, so a day it did not run reports almost
nothing however much work the day held. Measured on 2026-09-07: the screen read 21 minutes and one
`Other applications` line, against 18 commits and 15 768 agent turns between 09:57 and 18:57.

Two things are durable and are collected after the fact: git (the reflog and the log of each
repository) and the agent session logs. So the day can be rebuilt. The question is from what.

**A prompt the user typed is presence. A turn is not.** Both live in the same log, and only the first
is a person pressing keys at a known instant. So `agent-prompt` joins `window-focus` as a sample that
opens a stretch and ends being away, and `agent-usage` joins nothing: alone it books no minute, at any
number.

**A turn between two prompts holds the stretch open.** It postpones the close and never moves the
end, so a stretch still ends at the user's own last action. That is what pays for the minutes spent
reading what an agent wrote, and it can only ever happen between two things the person did.

This is a narrower rule than the one it stands beside, and both are kept: "an agent session is not
presence" cost 7 hours on 2026-08-10, and it still holds — from an `idle-start` or a `lock` until real
input, a turn does nothing at all.

Measured on 2026-09-07, with a 15-minute gap: prompts and commits alone give 4 h 47 m in 9 stretches;
with turns bridging, 7 h 13 m in 3. Tom chose the second on 2026-09-08.

## Consequences

- The gap is its own option. `maxUnobservedMs` is a safety valve at 30 minutes, and this is an idle
  rule at 15: a person waiting on an agent is at the machine, and a person who typed nothing and ran
  nothing for a quarter of an hour is not.
- **What was rebuilt is reported, and it is inside presence.** `StreamDay.reconstructedMs` and
  `Stream.reconstructedMs` are the part of presence no window and no idle transition observed. A day
  with a rebuilt afternoon says so and still reports one presence number.
- **A keystroke names the stream.** Inside a rebuilt stretch there is no focused window to be
  exclusive, so each mark — a prompt, a commit, a session sample, a turn — claims the minutes up to
  the next one, exactly as the focused window claims them on an observed day. A mark that names no
  checkout gives them to the folded line, so presence still reconciles with the list.
- **A prompt carries no text**, so it can outlive the raw samples the way spend does (ADR 0002), and
  a title-pattern exclusion rule is tested against the checkout it names.
- **It is kept for a checkout no project link covers**, where a session and a turn are dropped. A
  prompt is presence rather than billable work, and a day in an unlinked repository still happened. A
  private checkout still drops whole.
- **Two passes more per agent**, `prompt` and `codex-prompt`, reading each log once from the top. The
  spend passes have converged, and re-reading their logs under those names would be a rewind of a
  cursor that is finished — a new pass name is a cursor at line 0, which is what this needs.
