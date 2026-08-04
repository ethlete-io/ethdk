---
'@ethlete/query': patch
'@ethlete/components': patch
---

Fix `HttpRequestLoadingProgressState.speed`, which reported 1000x the actual rate, and
show the transfer rate in the query devtools progress readout.
