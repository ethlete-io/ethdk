---
status: accepted
built: e5b8da98f
decided: 2026-11-06
source: grill session 2026-11-06
---

# Every design run logs its timings

Speed bottlenecks were found by Tom waiting (a drawn sketch waited 71 min, finding 499), not by a tool:
`ETHLETE_DESIGN_PHASES=1` (`phase-timing.ts`) is off by default, wired into six commands, and keeps nothing. Tom: "ggf
sollten wir auch instumentation einbauen um speed engpässe überhaupt gut sehen zu können. denke das ist wichtig".
Every `design` run appends one line to a local, uncommitted `.ethlete/design/.timings.jsonl`: command, part, calling
session, total, each phase, queue wait, cache hits and misses, build and browser start, and how many heavy runs ran at
the same time. `design timings` shows the slowest phases and commands over the last hour or day, the median against the
targets (compare <= 5 s, sketch <= 10 s, full check <= 60 s) and each miss with its most expensive phase. Studio shows a
sketch's check duration and what it waited on next to its check state, from S6 on. It is slice S0, built right after
the push of next and before S6, so every speed slice measures before and after with it. Tom: "ok" (recommended).
