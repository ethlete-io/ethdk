---
'@ethlete/core': patch
---

An `Observable` returned from an unsaved-changes `confirm` is now unsubscribed when the session ends while it is open (`abandonAll()`, e.g. on logout), so it no longer keeps running - and a confirm dialog opened through it closes.
