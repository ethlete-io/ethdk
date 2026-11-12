---
status: accepted
open: B507
decided: 2026-11-12
source: decision of the human in the doc agent chat, about 15:00 local; supersedes the order line of ADR 0286
---

# B507 is built before B506

Until B507 is built, the pre-push hook of `next` refuses a code push without a full push suite verdict, and only the
human may set `PUSH_SUITE_SKIP=1` (ADR 0243). So every push waits for the human. The human asked (German, verbatim):

> wiedo muss ich jetzt manuell pushen macht ihr das doch

The doc agent recommended to build B507 before B506; after it, the builder pushes on its own. The human answered "ok".

Order: B507 (the push path of ADR 0286) is built next, before the B506 font proof, then B498. The push of 12837c0e8 is
the last one the human makes with `PUSH_SUITE_SKIP=1`.
