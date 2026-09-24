---
'@ethlete/query': minor
'@ethlete/components': patch
---

Query: add `executeUntilSettled$`, a cold Observable that executes on subscribe, emits the settled snapshot and aborts the request when unsubscribed early; the dropzone delete executor now uses it.
