---
'@ethlete/query': patch
---

Fix `withSuccessHandling`, `withErrorHandling` and `withLogging` callbacks sometimes being skipped when a query re-executes in quick succession (e.g. polling, auto-refresh, or fast repeated requests). Each execution's result now reliably triggers its handler.
