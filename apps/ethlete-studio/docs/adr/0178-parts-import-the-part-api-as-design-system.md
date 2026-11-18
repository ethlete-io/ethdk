---
status: accepted
built: a5a004199
decided: 2026-10-27
source: the design system model plan (deleted in B597, ADR 0365), "Slice 1 decisions (2026-10-27)"
---

# Parts import the part API as @design-system

`libs/cli/design/define-part.ts`; the core writes a tsconfig per product with one explicit `paths` entry per resolved
part.
