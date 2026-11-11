---
status: accepted
open: B295
governs: ['.husky/*', 'tools/scripts/*gate*']
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Solo focus, sketch view, behavior tests and pre-push decisions", what stops a defect
---

# Build-ready stops a defect without the hook; CI is the backstop

A part with an open problem is not build-ready, and the builder reports a slice done only when its parts are
build-ready. CI runs the same rules as the backstop. Built with the go-system rework (B249).
