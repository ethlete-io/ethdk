---
status: accepted
open: B636
decided: 2026-11-19
source: doc-agent session 2026-11-19, on the design CLI issues ethdk #3189, #3192, #3193
---

# The design CLI runs the same in every worktree

Three design CLI bugs reported on GitHub share one root: the CLI assumes a single checkout. The slow-check cache is
keyed by product name only, so two worktrees share and overwrite it (#3193); `design ready` then reports embedded parts
as not build-ready without a reason (#3189); and `design lint` / `sketch ready` crash in a fresh worktree, because Nx
prints a project-graph warning into the output the CLI parses as JSON (#3192).

Offered a new rebuild group for them, "the CLI runs the same in every worktree", the human answered "ok". The group is
row B636 and goes into the queue right after the Timetrack rows. A fix in the group names what it removes, as every
tool fix does.
