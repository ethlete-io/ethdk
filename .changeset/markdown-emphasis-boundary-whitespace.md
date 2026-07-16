---
'@ethlete/core': patch
---

`htmlToMarkdown`: boundary whitespace inside bold/italic/strikethrough now serializes outside the delimiters (`<strong> x</strong>` → ` **x**` instead of the invalid `** x**`).
