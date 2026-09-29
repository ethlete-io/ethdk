---
'@ethlete/core': minor
'@ethlete/components': patch
---

Markdown: `markdownToHtml` takes a `verbatim` pattern whose matches render as plain text. The rich-text editor and viewer pass their token codec's new `markdownPattern`, so `{{field:__x__}}` no longer loses its chip on reload.
