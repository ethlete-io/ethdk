---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Person names in the product" (finding 362) item 1
---

# A check fails on person names in product files

A check fails on person names (`git config user.name` plus a list of known names) in source under `libs/` and
`apps/`, in `apps/docs`, and in the files the CLI writes (`.ethlete/design/**`). `plans/` stays free: there "Tom
decided" is a source note. Every current hit is fixed.
