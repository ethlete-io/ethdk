---
status: accepted
open: B661
decided: 2026-11-20
amends: 0376
source: grill session 2026-11-20 (afternoon)
---

# An empty queue never stops the builder

In the morning the builder stopped because the queue was "empty", while lists A, C and D still held rows. The human
(German, verbatim): "ich will nicht dass wir nachher wieder in die situation von heute morgen laufen wo ihr aufhört weil
die liste angeblich leer sei", and "q2ok q3ok" on the two proposals below.

1. When no queue row can start, the builder takes the next topic from the lists in this order: the released Studio
   topics of list A, then the SDK topics of list D, then the CLI speed topics of list C. Only when none of them can
   start does it message the doc agent; it never just stops. This replaces point 4 of ADR 0376.
2. Until the weekly reset on Saturday 2026-11-21 14:00, one research-only agent sorts every queue row against git
   (done: out, stale: out, ready: with a build brief). The other research agents write build briefs for the released
   list A topics, in their order.
