---
'@ethlete/components': patch
---

Rich text editor: fixed formatting a selection then applying a heading dropping the inline mark (e.g. bold text turned into a heading lost its `<strong>`), and a follow-up fix so the first toggle-off click after a block-level command actually removes the mark instead of no-op-ing.
