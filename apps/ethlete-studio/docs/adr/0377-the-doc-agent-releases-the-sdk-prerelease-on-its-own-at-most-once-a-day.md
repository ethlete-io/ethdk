---
status: accepted
built: b99850fe6
decided: 2026-11-19
source: doc-agent session 2026-11-19, after the fifagg session waited for an SDK prerelease
---

# The doc agent releases the SDK prerelease on its own, at most once a day

The prerelease PR (`changeset-release/next`) waited since the afternoon while the fifagg session waited for its
changes. The human (German, verbatim): "fifa wartet afaik auch auf einen sdk release. macht den dann auch bei zeiten
bitte automatisch. aber nicht releases spammen!"

1. The doc agent merges the prerelease PR without asking, once CI (Next) is green on the commit the PR was cut from.
2. At most one prerelease a day. A consumer that reports itself blocked on a change gets it at once, outside that limit.
3. A day without a change a consumer waits for may skip its release.
4. After the merge, the doc agent tells the waiting consumer the version.

This extends the one-night permission of ADR 0295 to every day.
