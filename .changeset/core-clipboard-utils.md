---
'@ethlete/core': minor
---

Add clipboard utilities: `copyToClipboard(text)` writes text to the clipboard (async Clipboard API with an `execCommand('copy')` fallback) and emits a success boolean, `readFromClipboard()` emits the clipboard text or `null`. Both return cold observables that run on subscribe, emit once and complete, are SSR-safe, and never error.
