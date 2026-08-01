---
'@ethlete/components': minor
---

Icon: add a `label` input. An icon stays `aria-hidden` by default - it usually repeats the text beside
it - but a lone status glyph is the content, and `label` turns the host into a named `role="img"` so
the meaning survives for a screen reader.

Menu: add `loop` (default `true`, the current behaviour). Turn it off and the arrow keys stop at the
ends instead of wrapping, which reads better in a long menu. A menu with a search field is unaffected:
its ends hand focus back to the field either way.
