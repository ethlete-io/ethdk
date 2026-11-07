---
status: accepted
open: none
governs: ['.husky/pre-push']
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Solo focus, sketch view, behavior tests and pre-push decisions", pre-push
---

# No e2e in pre-push

The hooks are already too slow. CI is the gate for the behavior suites; a red CI run is builder work at once. Small,
scoped checks such as the 13 s VitePress build on apps/docs pushes stay.
