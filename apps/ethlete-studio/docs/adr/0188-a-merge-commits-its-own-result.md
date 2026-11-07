---
status: accepted
built: 4a4bb56c6
decided: 2026-11-04
source: grill session 2026-11-04
---

# A merge commits its own result

A merge in Studio commits its own result: one commit per merge, with only the files the merge wrote. Nothing stays
uncommitted, so the dirty-product guard never refuses the next merge because of an earlier one, and Tom can merge
several sketches in a row. Tom: "q1ok" to the recommendation "Der Merge committet selbst".
