---
status: accepted
open: B440
decided: 2026-11-09
source: doc-agent session 2026-11-09, round on the broken CI state (findings 587, 588, 596, 607)
---

# A red CI stops feature work, and every push runs the Studio e2e suite

The human, to "how do we stop the ultra broken CI state": "q1ok q2ok q3ok es sollte aber nicht hirnlos immer jeder
commit direkt pushed werden. sonst brechen wir immer die ci ab. aber hard blocken weil man auf einen ci run wartet
sollte auch nicht passieren sofern nicht unbedingt nötig."

- The Studio e2e suite runs on every push to `next`, with no path filter (B439).
- A red CI (Next) blocks every feature slice. A cause not proven within 15 minutes means revert the suspect commit
  first. Studio shows "CI rot" in the title bar, and the builder start refuses a feature slice while CI is red (B440,
  finding 587).
- A flaky spec counts as a red run: it gets a STATUS row with priority, no retry and no skip. Specs that measure time
  move out of Unit tests into their own non-blocking perf job that stores its measurements as an artifact (B441).
- Push cadence: the builder pushes at the end of a slice, not after each commit, and does not wait for the run
  before the next slice. `ci-next.yml` keeps one run going and one pending, so a push never cancels a running run.
  The builder waits for a run only when the next slice needs its result (a Linux-only cause, a changed CI job).
