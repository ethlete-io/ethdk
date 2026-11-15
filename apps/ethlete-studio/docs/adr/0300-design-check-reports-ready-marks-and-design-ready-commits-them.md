---
status: accepted
built: 457eb0655
decided: 2026-11-15
source: doc-agent session 2026-11-15, morning round after the night shift
---

# design check reports its ready marks, and design ready commits them

`design check` sets or drops a part's ready mark in `ready.json` from its result, and that edit stays uncommitted in the
tree. Asked whether check should commit it itself, with three options (check reports READY UNCOMMITTED and `design ready`
commits; check commits like the merge; check writes nothing), and the recommendation of the first, the human answered
"q2ok".

`design check` keeps setting and dropping ready marks, never commits, and reports the uncommitted edit as READY
UNCOMMITTED. `design ready` commits it.
