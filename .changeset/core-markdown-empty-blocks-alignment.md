---
'@ethlete/core': patch
---

`htmlToMarkdown` drops an empty heading or list item instead of writing a bare `#`, `-` or `1.` that read back as a literal paragraph. Block alignment keeps only `center`, `right` and `justify`: a vendor-prefixed value such as `-webkit-center` maps to its base value, and `left`, `start`, `inherit` or an unknown value serialize as plain Markdown instead of raw HTML that rendered its own tags as text.
