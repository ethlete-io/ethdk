---
'@ethlete/components': patch
---

Rich text editor fixes:

- An empty heading or list item no longer stores `#`, `-` or `1.`, so a field holding only one counts as empty and undo no longer shows a literal marker.
- Pasted `text-align: -webkit-center` keeps its alignment instead of showing the paragraph's HTML as text. Pasted `left`, `start` and unknown alignments paste as plain text, and without `provideRichTextEditorAlignmentTool()` all pasted alignment is dropped.
- IME input: marks toggled before a composition and Markdown-as-you-type apply to the committed text, keys pressed while composing (Safari's commit Enter) no longer insert a trigger chip or rewrite a list or heading, and the value and undo history update once per composition.
- A value written from outside clears marks toggled for the previous document, refreshes the toolbar state and keeps the caret of a focused editor.
- `requiredLanguages` reports the languages as missing on a `null` record instead of throwing.
