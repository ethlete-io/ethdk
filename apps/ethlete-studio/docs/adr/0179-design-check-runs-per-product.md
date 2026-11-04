---
status: accepted
built: a5a004199
decided: 2026-10-27
source: plans/ethlete-studio/design-system/model.md, "Slice 1 decisions (2026-10-27)"
---

# design check runs per product

`et design check --product <name>` runs the rules, then `tsc`; with no flag it checks every product. The old flags
work as before. Base parts are checked as part of the product that uses them.
