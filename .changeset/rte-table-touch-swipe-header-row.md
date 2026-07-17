---
'@ethlete/components': minor
---

Rich text editor:

- Table tool: the grid-size picker supports touch — drag across the grid to size the table and release to insert; when a table's header row was deleted the menu offers **Insert header row**, and inserting a row from the header now lands in the table body.
- The link editor and floating toolbar anchor to the selected text (not the full-width block) so the arrow points at the text, and the link editor now opens correctly in an empty editor.
- The trailing space inserted after atomic tokens (mentions, merge fields) and line-ending links is now a no-break space (Chrome dropped the plain one, gluing the next word); it still serializes as a regular space.
- Form field: the `inline` label mode now lays out correctly around rich text editors.
- `RichTextEditorToolDefinition` gains an optional `keydown` hook; table caret navigation now ships with `provideRichTextEditorTableTool` via that hook instead of being bundled into every editor (`editorDom.tableExit` / `tableEnter` are removed) — provide the table tool if your content can contain tables.
