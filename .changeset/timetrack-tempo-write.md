---
'@ethlete/timetrack': minor
---

Add the Tempo write half: `executeTempoSync$()` applies a `TempoSyncPlan` with per-row results and a
retryable remainder, plus worklog create/update/delete and a configurable ownership marker that
survives a lost ledger.
