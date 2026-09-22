---
'@ethlete/timetrack': minor
---

Own Tempo worklogs per day: the ledger port now reads `entriesForDay$(day)`, so a worklog whose
proposal the day stopped producing is deleted instead of reading as somebody else's.
