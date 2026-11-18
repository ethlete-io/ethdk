---
status: accepted
built: a5a004199
decided: 2026-10-27
source: the design system model plan (deleted in B597, ADR 0365), "Slice 1 decisions (2026-10-27)"
---

# A design part lives in its product, layer and part folder

`.ethlete/design/<product>/<layer>/<part>/<part>.ts` plus `<part>.css`, with `<product>/fixtures.ts` at the product
root. Layer folders: `foundations`, `components`, `elements`, `pages`; `calls/` stays as it is.
