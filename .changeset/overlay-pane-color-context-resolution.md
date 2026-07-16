---
'@ethlete/core': patch
'@ethlete/components': patch
---

Theming: overlay panes (menu, select) now resolve their color context through passive providers and apply it before the first painted frame.

- `ProvideColorDirective` gains `resolvedColor` — the color that actually applies at the provider's location, falling through passive providers like the CSS cascade does. `syncWithProvider` uses it, so a passive in-between provider (e.g. a form field's) no longer erases the theme inside a detached overlay pane.
- The menu and select panels install the context sync during construction instead of in an effect, eliminating a wrong-theme flash during the enter animation.
