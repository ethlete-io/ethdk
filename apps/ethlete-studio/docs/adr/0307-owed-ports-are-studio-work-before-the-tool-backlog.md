---
status: accepted
built: fb3994aeb
decided: 2026-11-16
source: doc-agent session 2026-11-16, night, Q1
---

# Owed ports are Studio work before the tool backlog

The full `design check` found eight implemented parts whose app code no longer matches the merged design: six owed
ports (components/disclosure, shell-collapse, tree-row, zoom-chip, elements/part-tree, shell-main) and two drifting
parts outside the baseline (components/canvas-viewport, comment-pin). Applying the rule that each old drift opens its
own UI item (ADR 0205), the doc agent queued them as one group row B520, item 2 of the binding order in
`plans/ethlete-studio/STATUS.md`, before the tool backlog. Asked whether B520 stays there or moves behind the tool
backlog, with the recommendation to keep it: it is Studio work, and a drifting part fails the next push that touches
its files. The human: "Q1ok".
