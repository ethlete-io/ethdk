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
- **What was rebuilt is reported, and it is inside presence.** `StreamDay.rebuiltMs` and
  `Stream.rebuiltMs` are the part of presence no window and no idle transition observed. A day
  with a rebuilt afternoon says so and still reports one presence number.
- **A keystroke names the stream.** Inside a rebuilt stretch there is no focused window to be
  exclusive, so each mark — a prompt, a commit, a session sample, a turn — claims the minutes up to
  the next one, exactly as the focused window claims them on an observed day. A mark that names no
  checkout gives them to the folded line, so presence still reconciles with the list.
- **A directory is only a stream when something says it is a checkout**: the git discovery reported
  it, a git event named it, or the user linked it. A prompt and a turn are the two marks kept without
  a link, so they are the two that can name a directory that is no repository at all — a console
  opened in `~`, a folder under `~/Downloads`, or the directory a private checkout sits in. Their
  minutes and their turns go to the folded line, which is how the hours stay in the day while no
  such path is ever named on the screen.
- **A prompt carries no text**, so it can outlive the raw samples the way spend does (ADR 0002), and
  a title-pattern exclusion rule is tested against the checkout it names.
- **A prompt and a turn are kept for a checkout no project link covers**, where a session sample is
  dropped. Both are what a rebuilt day is made of: the prompt is the presence and the turn is the
  bridge, so gating the turn cost a day in an unlinked repository every gap over the agent gap — 4 h
  46 m against the 7 h 13 m this rule predicts, measured on 2026-09-07. A link decides what can be
  billed, not what is collected, and no worklog can be written for a checkout no project covers. A
  private checkout still drops whole.
- **The spend passes are renamed** `spend-all` and `codex-spend-all`, so the stored days gain the
  turns they were denied. ADR 0005 rejected renaming a pass because a new name is a cursor at line 0
  and re-reads every log; here that is the whole point.
- **Two passes more per agent**, `prompt` and `codex-prompt`, reading each log once from the top. The
  spend passes have converged, and re-reading their logs under those names would be a rewind of a
  cursor that is finished — a new pass name is a cursor at line 0, which is what this needs.
