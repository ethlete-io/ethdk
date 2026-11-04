---
status: accepted
built: a5a004199
decided: 2026-10-27
source: plans/ethlete-studio/design-system/model.md, "Slice 1 decisions (2026-10-27)"
---

# Parts import parts through @system, resolved by the product

`@system/<layer>/<name>` and `@system/fixtures`; the product resolves the name to its own part, else the base part,
so an override also replaces the part inside base parts.
