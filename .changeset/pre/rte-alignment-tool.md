---
'@ethlete/components': minor
'@ethlete/core': patch
---

Rich text editor: added an opt-in **alignment** tool. Provide `provideRichTextEditorAlignmentTool()` and include `'align'` in the editor's `tools` to get a block-alignment menu (left / center / right / justify) that also works inside table cells. The button reflects the caret's current alignment live. Alignment has no Markdown form, so it persists as a native `text-align` style and round-trips as raw HTML.

`@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip block elements carrying a `text-align` style (preserved verbatim as native HTML).
