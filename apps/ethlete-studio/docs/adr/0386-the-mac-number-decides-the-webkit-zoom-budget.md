---
status: accepted
open: B356
decided: 2026-11-20
source: grill session 2026-11-20 (day shift), B356
---

# The Mac number decides the WebKit zoom budget

The zoom budget of the Studio canvas is a frame interval of p50 <= 20 ms and p95 <= 33 ms in WebKit. On Linux WebKit p50
is 16-17 ms, but p95 stays at about 46 ms after two failed fixes, and Linux WebKit timestamps are whole milliseconds, so
render and layout cannot be told apart there.

Asked whether the human measures once on the Mac, and ~45 ms p95 on Linux WebKit is accepted if the Mac meets the
budget, the human answered (German, verbatim): "q2ok".

1. The human runs one ready-made measurement command on the Mac.
2. Mac p95 <= 33 ms: about 45 ms p95 on Linux WebKit is accepted, and B356 closes.
3. Mac p95 above 33 ms: the builder continues with a Safari Web Inspector timeline, not with more Linux attempts.
