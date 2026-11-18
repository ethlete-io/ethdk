---
'@ethlete/cli': patch
---

`definePart` with `data: 'list'` now requires a `dataStates: { loading, error, empty }` map naming the state that draws each.
