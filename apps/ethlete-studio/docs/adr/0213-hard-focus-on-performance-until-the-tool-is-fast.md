---
status: accepted
open: B416
decided: 2026-11-06
source: doc-agent session 2026-11-06, after findings 521 and 522
---

# Hard focus on performance until the tool is fast

Tom: "HARD FOCUS: Performance. Ich will hier KEINE anderen themen sehen solange die perf undbrauchbar ist ist das tool
unbrauchbar". Sharpens ADR 0199. Until `design timings` shows a warm compare of a studio page <= 10 s and a full studio
check within its target, the builder works only on performance (B416 with S4, S7, S8, S5). Every other slice waits, and
the doc agent sends Tom nothing but performance. A new finding outside performance is recorded and queued, not built and
not raised with Tom. Tom on the push: "der push ist solange auch egal". The push of next waits until the block is done; nobody spends a
run on it before.
