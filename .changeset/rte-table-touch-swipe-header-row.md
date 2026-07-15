---
'@ethlete/components': minor
---

Rich text editor:

- Table tool: the grid-size picker now supports swiping on touch — drag across the grid to size the table and release to insert.
- Table tool: when a table's header row has been deleted, the menu offers **Insert header row** to restore it; inserting a row from the header row now lands in the table body instead of the header.
- Form field: the `inline` label mode now lays out correctly around rich text editors (label inset and top-aligned, divider contained in the frame).
- The link editor and floating toolbar now anchor to the selected text instead of the full-width block when the selection spans a whole element (e.g. a triple-clicked list item), so the popover arrow points at the text. The link editor also opens correctly in an empty editor (a boundary caret has no rect, which used to instantly close the popover as "hidden").
- The trailing space inserted after atomic tokens (mentions, merge fields) and line-ending links is now a no-break space — Chrome silently dropped the plain space on the next keystroke, gluing the following word to the chip. It still serializes as a regular space.
- `RichTextEditorToolDefinition` gains an optional `keydown` hook so opt-in tools can intercept editor keys for content they own.
- Arrow-key caret navigation across table boundaries now ships with `provideRichTextEditorTableTool` (via the new `keydown` hook) instead of being bundled into every editor — completing the "table code is opt-in" promise. If your content can contain tables, provide the table tool. `editorDom.tableExit`/`editorDom.tableEnter` no longer exist on the editor's DOM service.
