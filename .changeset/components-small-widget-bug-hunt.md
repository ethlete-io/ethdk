---
'@ethlete/components': patch
---

`etToolbar` no longer puts its tab stop on a hidden control, and skips controls inside a disabled `<fieldset>`. `etCopyButton` reports `copyFail` when `navigator.clipboard.writeText` throws instead of rejecting. `et-avatar` derives initials from whole characters, so a name starting with an astral character no longer renders half a surrogate pair. `normalizeEthleteGroupRanking` gives participant-less placements tied at one position distinct ids.
