---
status: accepted
open: B474
decided: 2026-11-10
source: grill session 2026-11-10 (Mac night shift, morning round)
---

# The night range goes to next without a green push suite

The Mac night shift ended with 111 local commits on top of `origin/next` and CI red on the cli spec worker count. ADR
0239 allows a push only after a green push suite, but four push suites in the night were red, each on a different
load-sensitive e2e case that the commits do not touch (the last one, B471, has a proven cause in Chromium's priority of
off-screen pictures). The day shift on the desk PC needs the range. So the whole range goes to `next` now with
`PUSH_SUITE_SKIP=1`, and CI is the check. This is a one-time exception, not a change of ADR 0239. Rejected: only the
worker fix first, the range after a green push suite (recommended; it keeps the day shift waiting on load-sensitive
e2e runs), and no push until a green push suite. The human: "Q1b".
