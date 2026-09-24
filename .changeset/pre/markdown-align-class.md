---
'@ethlete/core': patch
---

`markdownToHtml` renders block and table-cell alignment as an `et-rte-align-*` class instead of an inline `text-align` style, which a strict `style-src` dropped; `htmlToMarkdown` reads both.
