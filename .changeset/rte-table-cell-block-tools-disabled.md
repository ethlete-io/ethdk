---
'@ethlete/components': minor
---

Rich text editor: the heading menu and list buttons now disable themselves while the caret is inside a table cell (a GFM table cell can only hold inline content, so block markup there would not survive serialization), instead of silently doing nothing. Custom tools can opt into the same behavior via the new `isDisabled` callback on `RichTextEditorToolDefinition`. The Cmd/Ctrl+U shortcut now runs through the editor's own underline command like the other formatting shortcuts.
