---
status: accepted
open: B514
decided: 2026-11-15
source: doc-agent session 2026-11-15, day shift, B514 question from the builder
---

# The full check target is the uncached run with a warm server

The full `design check --product studio` has a 60 s target, but no decision said whether it holds for a cached or an
uncached run. Measured on 2026-11-15: cached (no SDK or CLI change) 14.5 s; uncached (after any SDK or CLI change)
131.3 s, 103 s after 28876b22f; first run right after an SDK rebuild (cold server plus auto-accept) 185.5 s. Asked for
which case the target holds, with the recommendation of the uncached run with a warm server and the first run after a
rebuild logged but outside the target, the human answered "ok".

The 60 s target holds for the uncached full check with a warm server. The first run after a rebuild keeps being
measured and logged, and does not count against the target.
