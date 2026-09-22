---
'@ethlete/components': minor
---

Calendar: `comparisonStart` / `comparisonEnd` band a compared period under the selection - the
analytics "vs. the previous 30 days" pattern - and the date range input forwards them. It is
presentation only, so picking never writes to it. Cells expose `data-comparison-band`, and
comparisons band at the calendar's `precision`.
