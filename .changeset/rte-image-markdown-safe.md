---
'@ethlete/components': patch
'@ethlete/core': patch
---

The rich text editor keeps an image whose URL holds parentheses or spaces an image after a save and reload. `htmlToMarkdown` escapes brackets and backslashes in image alt text, so the alt text comes back exactly as written.
