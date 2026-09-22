---
'@ethlete/components': major
---

Query error: labels default to English only — the German status tables are no longer bundled or auto-selected by locale. Keep the old behavior with `provideQueryErrorLabels(queryErrorLabelsForLocale)` (or `GERMAN_QUERY_ERROR_LABELS`); the `migrate-query-error-labels` generator finds affected sites.
