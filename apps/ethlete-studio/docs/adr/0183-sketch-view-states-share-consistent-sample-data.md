---
status: accepted
built: aa8c96889
decided: 2026-11-04
source: grill session 2026-11-04
---

# Sketch view states share consistent sample data

In the pages/sketches design, the same state of the same variant carries the same marks in every page state. Today
`folded` folds fit-hover, fit-active and fit-focus-visible as unchanged in all variants, while `agent-round` draws them in
variant a without the "unverändert" mark. Tom: "ok" to aligning the sample data, so a difference between two states
never comes from the sample data alone.
