---
'@ethlete/components': minor
---

Rich text editor: add opt-in, tree-shakeable building-block autocomplete. Add the
`etRichTextEditorTriggers` directive (with `RICH_TEXT_EDITOR_TRIGGERS_IMPORTS`) and pass triggers
built with `createRichTextEditorTrigger` — typing a trigger char (e.g. `#`, `@`) opens a
caret-anchored, menu-styled popup, and picking an item inserts an atomic `{{type:id}}` token chip.
Item sources can be static, `Promise`, or `Observable`. Use `provideRichTextEditorTokenRendering(...)`
to render stored token values as chips in read-only contexts, or `createRichTextEditorTriggerWithQuery(...)`
to back a trigger with an `@ethlete/query` query (results, loading and error wired automatically).
