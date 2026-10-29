---
'@ethlete/cli': patch
---

`design sketch new` on a merged part with a `shared/` folder moves that folder into the sketch's `shared/` and imports it as `@shared/`, so the variants no longer each hold a copy.
