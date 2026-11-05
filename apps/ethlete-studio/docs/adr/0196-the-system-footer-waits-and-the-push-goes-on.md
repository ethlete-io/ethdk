---
status: accepted
open: B288
decided: 2026-11-05
source: grill session 2026-11-05
---

# The system footer waits, and the push goes on with Studio rules red

The design of `pages/system` draws the build-ready footer with a "Gründe" disclosure since 2e70dc149; the app never
built it (B288). The `--slow` step of the CI job "Studio rules" therefore fails on every app commit that touches
`pages/system` (finding 454). B288 is not pulled forward: the work stays on the sketch view. Tom: "q1 bitte lass uns
erstmal beim focus sketch view bleiben". Until B288 comes in its normal place, the `--slow` failure on `pages/system`
is a known red in CI.

The builder pushes aff13b991 (scheduler locator fix) and 221073493 (B377) now, although Studio rules stays red: the
red is already on `next`, and the push adds no new failure. Tom: "q2ok".

"Focus sketch view" does not move the sketch view ahead of B388: asked whether B388 or the sketch view comes first,
Tom answered "ok" to the recommendation that B388 stays first, as ADR 0195 says.
