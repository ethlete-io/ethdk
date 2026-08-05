---
'@ethlete/components': patch
---

Structural `RuntimeError`s (e.g. "must be placed inside X") now log the offending host element via `console.error`, so you can click straight to it in devtools instead of guessing from the message alone.
