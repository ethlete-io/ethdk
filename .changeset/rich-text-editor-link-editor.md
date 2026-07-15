---
'@ethlete/components': minor
'@ethlete/core': minor
---

Rich text editor: replace the browser `prompt()` link flow with a popover to edit a link's text and
URL, with an **open-in-new-tab** toggle. It is responsive — an arrow'd popover anchored to the
selection on wider screens, and a top sheet (pinned above the on-screen keyboard) on small/touch
screens. New-tab links persist through the Markdown value as raw HTML
(`<a href="…" target="_blank" rel="noopener noreferrer">…</a>`); ordinary links stay `[text](url)`.
`htmlToMarkdown`/`markdownToHtml` in `@ethlete/core` now round-trip `target="_blank"` anchors
(sanitized to a safe href + forced `rel`). After applying a link the caret is placed just after it
(rather than leaving the link selected), and a trailing space is added when the link ends the line so
typing continues cleanly — the same for an inserted building-block/mention token.
