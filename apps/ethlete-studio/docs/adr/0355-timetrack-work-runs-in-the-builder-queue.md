---
status: accepted
built: 1dbcc0fa2
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, Timetrack review, its proposal approved by the human with "klingt gut", relayed through the doc agent
---

# Timetrack work runs in the builder queue

The human answered "klingt gut" to the analysis session's three Timetrack points (his words on the review are in ADR
0354). The points are the analysis session's text, approved by the human.

1. No Timetrack role session of its own: Timetrack rows go into the existing builder queue; one list of live work.
2. Order of the open findings in `plans/timetrack/findings-2026-11-17-demo-prep.md`: first #6-#8 (duplicate
   `jira.create` drafts, approve-all files twenty tickets), then the attendance class (#1, #2, #18, #21), then the
   two-machine difference (#15, #24).
3. The `timetrack snapshot` rule (AGENTS.md, "Testing beyond unit specs") is enforced by a check on commits that touch
   row-changing paths, instead of prose.
