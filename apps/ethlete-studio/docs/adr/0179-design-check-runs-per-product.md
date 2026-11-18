---
status: accepted
built: a5a004199
decided: 2026-10-27
source: the design system model plan (deleted in B597, ADR 0365), "Slice 1 decisions (2026-10-27)"
---

# design check runs per product

`et design check --product <name>` runs the rules, then `tsc`; with no flag it checks every product. The old flags
work as before. Base parts are checked as part of the product that uses them.
