---
'@ethlete/core': minor
'@ethlete/components': patch
---

Markdown: `htmlToMarkdown` now backslash-escapes literal text (except code, rich-text editor tokens and `data-markdown-verbatim` spans) and drops links with unsafe URL schemes, which the rich-text editor's link tools also refuse.
