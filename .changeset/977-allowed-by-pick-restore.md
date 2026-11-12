---
'@ethlete/cli': patch
---

`sketch merge --allowed-by` no longer leaves its agent pick in the sketch file when the merge is refused, and an agent
pick never decides a later merge: only a pick by the designer does.
