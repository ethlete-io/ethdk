---
'@ethlete/cli': patch
---

`et design complete <part> --handoff` gives a design complete part the `handoff` status; `et design complete --handoff` re-checks every `handoff` part and exits 1 when one regressed, for CI.
