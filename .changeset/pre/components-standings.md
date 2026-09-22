---
'@ethlete/components': minor
---

Add the standings table behind `STANDINGS_IMPORTS`: `<et-standings>` draws a real `<table>` from
`NormalizedStandingRow`s (any backend maps in; `normalizeEthletePlacement` ships for Ethlete feeds), bands
position `zones` in your own color themes and draws their legend from the same config, drops columns rather
than scrolling on narrow widths, and can single out one row.
