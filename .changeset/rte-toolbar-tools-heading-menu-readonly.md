---
'@ethlete/components': minor
'@ethlete/core': patch
---

Rich text editor: the toolbar is now configurable. A new `tools` input takes an ordered list of tool tokens (`'bold' | 'italic' | 'strike' | 'heading' | 'bulletedList' | 'numberedList' | 'link' | 'divider'`), and `provideRichTextEditorTools(...)` sets the default for a scope. The block style is now picked from a `heading` menu (Normal / Heading 1–3) shown first in the toolbar, and toolbar buttons are larger and squarer.

Form field: read-only text controls (`et-input`, `et-rich-text-editor`) now keep their normal box but drop all interactive affordances — no hover/focus border change, default cursor — so read-only reads as view-only content, distinct from disabled.

Icon button: added an `--et-icon-button-border-radius` custom property so an ancestor context (e.g. a toolbar) can square off the otherwise fully-round button.

Overlay (`@ethlete/core`): anchored overlay positions accept an optional `boundary`, so an anchored pane (e.g. the editor's selection toolbar) can be kept inside a region and flip instead of overflowing it.
