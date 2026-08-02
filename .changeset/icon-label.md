---
'@ethlete/components': minor
---

Icon: add a `label` input. An icon stays `aria-hidden` by default - it usually repeats the text beside
it - but a lone status glyph is the content, and `label` turns the host into a named `role="img"` so
the meaning survives for a screen reader.
