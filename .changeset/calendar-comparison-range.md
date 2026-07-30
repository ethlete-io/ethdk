---
'@ethlete/components': minor
---

Calendar: `comparisonStart` / `comparisonEnd` band a compared period.

The analytics "vs. the previous 30 days" pattern: a second range banded behind the selection, on the
calendar and forwarded by the date range input. It is presentation only — its cells stay selectable,
picking never writes to it — and the two ends are read as an interval whichever way round they come.

It is drawn as a bar under the cells rather than a second band behind them, because a band would have
to compete with the selection's for the same space and the whole point of the two is being read
together: where they overlap, the bar runs under the band. Cells expose `data-comparison-band`
alongside `data-band`, with a new `'single'` position for a period one cell wide (a one-day comparison
still has to show). Comparisons band at the calendar's `precision`, so a month-precision calendar
bands whole months.
