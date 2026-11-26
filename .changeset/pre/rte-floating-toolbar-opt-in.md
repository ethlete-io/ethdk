---
'@ethlete/components': major
---

The rich text editor's selection toolbar is now opt-in - add `provideRichTextEditorFloatingToolbar()`
to keep it. Saves 15 kB gz without it, the whole overlay runtime.
