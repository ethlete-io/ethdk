---
status: accepted
open: B249
decided: 2026-11-02
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Studio order, explorer, merge canvas and build-ready decisions" item 5 (A10)
---

# Build-ready replaces go and acceptance

"Go geben" and "Änderung abnehmen" go away, with go.json and accepted.json as human gates. A part is build-ready
when its checks are green; Studio computes it, no click, and `design task` starts only for build-ready parts. A
direct edit to a merged part outside a sketch holds at once without a picture change; with one, Studio turns it into
a sketch with "old" and "new" variants. The human decides only by picking in a sketch.
