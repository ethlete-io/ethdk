---
status: accepted
open: et-update-findings 11
decided: 2026-11-06
source: grill session 2026-11-06
---

# A third session builds the fifagg SDK fixes

fifagg on next.62 reopened item 16: a legacy `state$` subscriber still gets the old Success after a refresh, so
`refreshUserSuccessfully` takes the old roles (`plans/et-update-findings.md`, section 11). The tool builder works on the
performance block and the UI builder on Studio UI; neither touches `libs/query` or `libs/query-devtools`.

A third session builds the SDK fixes, in this order: item 16 (the consumer's steps ported one to one into a scenario on
both clients, then the fix, plus the rule in the `query-scenario-tests` skill), item 20 (a devtools e2e case: the pill
does not cover app buttons under Playwright, `showInAutomation: true` keeps the UI), then a replay of the migrator on
the pre-migration fifagg commit with tsc and lint. No push without Tom. Tom: "q1a".
