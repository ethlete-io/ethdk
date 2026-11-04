---
status: accepted
built: c63a0f089
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Solo focus, sketch view, behavior tests and pre-push decisions", import cycles (refines Impl Q116)
---

# libs/components has zero runtime import cycles

The target is 0 runtime cycles (imports that survive TS emit). Type-only cycles stay; no interfaces only to break
them (80 left on purpose). `libs/components/src/import-cycles.spec.ts` guards it (2ad7291ac, c63a0f089).
