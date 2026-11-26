---
'@ethlete/cli': patch
---

`et design serve` always hosts the resident design process; the `ETHLETE_DESIGN_SHARED_SERVE` flag is gone. `ETHLETE_DESIGN_RESIDENT=0` still keeps every call in its own process, and in CI a call uses a serve-hosted resident but never starts one.
