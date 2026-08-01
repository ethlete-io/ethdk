---
'@ethlete/components': major
---

Rich text editor: the link editor popover is opt-in via `provideRichTextEditorLinkEditor()` — without
it the `link` tool falls back to `prompt()`. Run
`nx g @ethlete/components:migrate-rich-text-editor-link-editor` to find affected editors.
