---
'@ethlete/core': patch
---

`htmlToMarkdown` and `markdownToHtml` keep the start number of an ordered list (`<ol start="3">` and `3.`) instead of renumbering from 1.
