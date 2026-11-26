---
'@ethlete/components': minor
---

Rich text editor: public API to insert a token chip at the caret from your own UI.

- `RichTextEditorDirective.insertToken(type, id, opts?)` inserts a `{{type:id}}` token chip at the
  caret (or the end when unfocused), resolving its label via the trigger's `resolveItem` - the same
  result as picking it from the `#`/`@` popup. `insertTokenItem(type, item, opts?)` does the same
  when you already hold the resolved `{ id, label }`. The directive now also exports as
  `etRichTextEditor`.
- New opt-in `et-rich-text-editor-token-palette` component (via `RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS`):
  a click-to-insert chip row driven by the same `RichTextEditorTrigger[]`.
