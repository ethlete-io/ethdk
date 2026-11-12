---
status: accepted
built: 91fc4fb8e
decided: 2026-11-12
source: decisions of the human, about 11:40 local, relayed by the analysis session (claude2)
---

# One builder on Linux, and the night work order

The human decided two points; the analysis session relayed them (its words, not a verbatim quote):

1. One builder only. It writes on Linux. The Mac and the Windows PC stay as compute: the builder reaches them by ssh
   when they are on and runs checks there (push suite, e2e, CI-like runs). No second agent commits. The Mac builder
   finishes B496 and then stops.
2. Night work order. (a) The evening list: 5-10 decided product rows from the human, in his order. (b) Then a second,
   longer list from the human: decided product rows of lower priority, long enough not to run empty in one night.
   (c) Only when both are empty: the rebuild rows B498-B506. (d) Never when idle: search for new findings, build a new
   check, hook or gate, touch the parked machinery pile. The builder does not stop when the evening list is done.

The human writes both lists each evening.
