---
'@ethlete/components': minor
---

Query error: new `<et-query-error>` and `[etQueryError]` - status title, message or violation list, and a retry
button when the retry policy says it's worth offering. Themed with the app's `type: 'error'` theme, localized via
`injectLocale()`, with `etQueryErrorTitle` / `etQueryErrorActions` slots. `legacyQueryErrorSource` bridges a V2
query.
