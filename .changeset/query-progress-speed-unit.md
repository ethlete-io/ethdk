---
'@ethlete/query': patch
'@ethlete/components': patch
---

Fix `HttpRequestLoadingProgressState.speed`, which reported 1000x the actual rate (and
`Infinity` on a stalled or re-executed request), and show it in the query devtools.
