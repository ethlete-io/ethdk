---
'@ethlete/components': minor
---

Rich text editor: toolbar accessibility and pressed-state polish.

- Toolbar buttons that open a menu or popover (heading, alignment, table, link) now show their pressed state while the popover is open.
- The toolbar is now a single tab stop following the ARIA toolbar pattern: Tab enters it, `ArrowLeft`/`ArrowRight` (plus `Home`/`End`) move focus between buttons, and the next Tab moves on to the editor content.
- `et-icon-button` now forwards the `emitAriaPressed` input, so `aria-pressed` can be suppressed on pressed-styled buttons that already expose `aria-expanded`.
