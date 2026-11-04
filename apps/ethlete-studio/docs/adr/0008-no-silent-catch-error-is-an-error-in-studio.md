---
status: accepted
built: 412ee0209
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Silent catchError decisions" (finding 370) item 1
---

# no-silent-catch-error is an error in Studio

`ethlete/no-silent-catch-error` goes from `warn` to `error` in `apps/ethlete-studio/eslint.config.mjs`. One pass
checks all 28 disable comments: each site either carries an error value (like `sketchRead$`) or keeps a disable
comment whose reason a reviewer accepts (an empty list that is the real answer). Disable comments stay allowed.
