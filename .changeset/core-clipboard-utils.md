---
'@ethlete/core': minor
---

Add clipboard utilities: `copyToClipboard(text)` writes text to the clipboard (async Clipboard API with an `execCommand('copy')` fallback) and resolves to a success boolean, `readFromClipboard()` resolves to the clipboard text or `null`. Both are SSR-safe and never throw.
