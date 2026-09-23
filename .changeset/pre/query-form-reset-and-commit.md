---
'@ethlete/query': patch
---

`defineQueryForm`: an emptied array commits as its `null` default, `skipResets` and `skipFields` no longer leak into the next change, a value written before `observe()` survives, and `liveValue` reports the controls.
