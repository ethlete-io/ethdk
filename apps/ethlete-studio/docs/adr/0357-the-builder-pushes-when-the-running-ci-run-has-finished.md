---
status: accepted
built: 014e1fd75
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, point C5, approved by the human with "c5ok", relayed by the analysis session; supersedes point 3 of ADR 0286
---

# The builder pushes when the running CI run has finished

On `next`, 200 CI runs started in 3 days: 44 green, 38 red, 109 cancelled. A push after each row cancels the run
before it. The analysis session proposed the point below and named its cost: commits stay local a little longer, and a
red run then covers several rows at once. The human answered (verbatim):

> c5ok

1. The builder pushes when the CI run on `next` that is running has finished, not after each row. Until then it commits
   locally and takes the next row.

It supersedes ADR 0286 point 3 ("Push small and often: after each finished row"). The other points of ADR 0286 stay:
the builder does not wait for CI, and red CI is fixed first.
