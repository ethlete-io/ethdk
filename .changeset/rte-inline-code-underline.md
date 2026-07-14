---
'@ethlete/components': minor
'@ethlete/core': patch
---

Rich text editor: added **inline code** and **underline** formatting tools (in the static and selection toolbars, and the default toolbar). Inline code round-trips as `` `code` ``; underline is preserved as native `<u>` since Markdown has no underline form.

`@ethlete/core`: `htmlToMarkdown`/`markdownToHtml` now round-trip `<u>` (underline) instead of dropping it.
