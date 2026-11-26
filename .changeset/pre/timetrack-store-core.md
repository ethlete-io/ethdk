---
'@ethlete/timetrack': minor
---

Add the store's core half: the event and ledger persistence ports, `applyExclusionRules()` with
shipped defaults, `planRetention()` clamped to what compaction has covered, and
`applyLedgerChanges$()`. `TimetrackEventStore` moved from `transport` to `store`.
