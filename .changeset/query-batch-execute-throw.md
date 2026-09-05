---
'@ethlete/query': patch
---

Query batch: an item whose `execute()` throws (a route builder that fails, `ET800`) is now recorded as a failed item instead of aborting the run and leaving `inFlight()` stuck above zero.
