---
'@ethlete/components': minor
'@ethlete/core': minor
---

Rich text editor: block quote and fenced code block tools (`'blockquote'` / `'codeBlock'`, also
typed as `> ` / ` ``` `), both in the default toolbar. Quotes nest with Tab/Shift+Tab; a code block
holds literal text, so the marks that can't serialize inside one disable themselves. `htmlToMarkdown`
/ `markdownToHtml` now round-trip nested quotes (`>>`).
