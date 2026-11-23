---
status: superseded by 0424
open: none
decided: 2026-11-20
amends: 0021
source: grill session 2026-11-20 (afternoon), commit a155bf140
---

# One unpushed commit message is reworded, once

A subagent committed a155bf140 (A6 quick switch e2e case) through `git commit-tree`, past the hooks. Its message
fails commitlint (agent attribution trailer, two lines too long), and pre-push and CI lint every commit in the range,
so it and the two commits above it could not be pushed.

The builder rewords only that message: it rebuilds the three commits outside the shared working tree, checks that
the trees are identical to the old ones, and moves `next` with `git update-ref refs/heads/next <new> <old>`, which
fails if another session committed in between. This is a one-off; ADR 0021 stays as it is for every other case. A
standing rule waits for a second case. A commitlint ignore entry was rejected as a permanent hole in the gate.

The human, asked whether to reword it once, as a standing rule, via a commitlint ignore, or not at all, with the
recommendation "once": "ok".

Cross-checked (ADR 0358): fixed the mechanics (no cherry-pick chain in the dirty shared checkout; compare-and-swap
ref move) and narrowed it from a standing rule to a one-off.
