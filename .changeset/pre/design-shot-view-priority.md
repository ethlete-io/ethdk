---
'@ethlete/cli': minor
---

`et design` shot requests take `view` (a number raised per view change) and `rank=active|visible`: the active frame of the shown view draws first, then its visible cells, then the rest, then older views. A hung-up request's queued shot is dropped.
