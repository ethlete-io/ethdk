---
'@ethlete/components': minor
---

Add `provideRichTextEditorTool()`, an injectable factory form of `provideRichTextEditorImageTool()`, and reactive `requiredLanguages` options. The multi-language editor now shows field errors, honors `provideRichTextEditorTools()` and resets undo per language; dev mode catches misconfigured tools and triggers.
