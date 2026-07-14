---
'@ethlete/components': minor
---

Rich text editor: added an opt-in **table** tool. Provide `provideRichTextEditorTableTool()` and include `'table'` in the editor's `tools` to get a toolbar control that inserts a table via a grid-size picker and edits it (insert/delete rows and columns, delete table) when the caret is inside one. Tables round-trip as GFM pipe tables. The tool and its DOM operations are only referenced from the provider, so they tree-shake away when not used.

Toolbar tools are now extensible: register a `RichTextEditorToolDefinition` (a toggle button or a custom control component) via the `RICH_TEXT_EDITOR_TOOL` multi-provider token.
