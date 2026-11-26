---
'@ethlete/components': major
---

Rich text editor: the `'heading'` block-style menu is now an opt-in tool -
`provideRichTextEditorHeadingTool()`, like the align/table/image tools. It stays in the default toolbar,
so that call is all it takes; without it no block-style control renders (Markdown `#` autoformat is
unaffected). It was the only default tool needing the menu system, worth 8.5 kB gz to every editor.
