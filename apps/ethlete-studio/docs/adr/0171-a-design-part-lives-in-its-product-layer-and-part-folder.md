---
status: accepted
built: a5a004199
decided: 2026-10-27
source: plans/ethlete-studio/design-system/model.md, "Slice 1 decisions (2026-10-27)"
---

# A design part lives in its product, layer and part folder

`.ethlete/design/<product>/<layer>/<part>/<part>.ts` plus `<part>.css`, with `<product>/fixtures.ts` at the product
root. Layer folders: `foundations`, `components`, `elements`, `pages`; `calls/` stays as it is.
