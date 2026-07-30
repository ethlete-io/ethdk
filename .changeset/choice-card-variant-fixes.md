---
'@ethlete/components': minor
---

Card presets: `et-checkbox-option` now takes `variant="card"` too. Cards drop the tinted fill and
follow the form-field frame for hover/press/focus, a selected card's border tracks the theme's
interaction shades, `et-choice-field` cards are clickable across the whole panel including its
border, and disabled / readonly cards no longer offer a pointer cursor. `et-form-field`'s hover
treatment now follows the frame and label instead of the whole field, so the hint/counter row no
longer triggers it.
