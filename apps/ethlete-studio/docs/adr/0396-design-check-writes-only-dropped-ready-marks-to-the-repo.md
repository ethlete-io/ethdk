---
status: accepted
open: B665
decided: 2026-11-21
source: doc-agent session 2026-11-21, morning round after the night shift; supersedes ADR 0300
---

# design check writes only dropped ready marks to the repo

Under ADR 0300, `design check` set and dropped ready marks in the tracked `ready.json`, so every check left a dirty tree,
also for a product nobody worked on, and then reported that state as a finding. ADR 0300's reason (a hand-edited part
invalidated the local cache) is handled differently since 2026-11-18. The builder had built "check writes nothing" on a
branch, at the price that a dropped mark lives only in the local cache, so the Mac, CI and other worktrees keep a broken
part ready until they check it themselves. Asked with three options (check never writes; check writes only drops, and
new ready marks stay with `design ready`; keep ADR 0300) and the recommendation of the second, the human answered
"q2 ok".

- `design check` writes a dropped ready mark into the tracked file, so a real regression shows as a dirty tree.
- `design check` never sets a new ready mark in the tracked file; only `design ready` (and `sketch merge`) do.
- The same split applies to the recorded state of direct edits.

Cross-checked; the question to the human is not saved.
