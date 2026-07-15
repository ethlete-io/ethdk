---
'@ethlete/core': minor
---

Markdown: GFM table column alignment round-trips — `markdownToHtml` applies `:---` / `:---:` / `---:` separators as `text-align` on every cell of the column, and `htmlToMarkdown` serializes the header cells' `text-align` back into the separator line.
