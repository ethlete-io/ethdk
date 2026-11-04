---
status: accepted
built: 9a7c40c56
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q218 (option a)
---

# Unused SDK base parts sit in a computed "Not used in Studio" subtree

Q178 moves into the MVP. The Studio part tree puts the SDK base parts no Studio part imports into their own subtree,
collapsed by default, computed from the import graph so it stays current with no list; no `hideBaseParts` entry. The
parts stay reachable and checked.
