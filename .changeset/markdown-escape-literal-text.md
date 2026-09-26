---
'@ethlete/core': minor
'@ethlete/components': patch
---

Markdown: `htmlToMarkdown` now backslash-escapes text that would read as Markdown (rich-text editor values change accordingly) and drops links with unsafe URL schemes, which the rich-text editor's link tools also refuse.
