---
status: accepted
built: 80480dce5
decided: 2026-10-22
source: plans/color-theme-variants.md (deleted in B597), accepted by the human with the recommendations of its open questions
---

# Colour has two rules: a surface and an accent

A surface is where an element sits: background, text, borders and its own grey (`interactionColor`). A colour is an
accent the author chooses. A surface may swap an accent for a version that reads well on it through one field,
`colorThemeVariants`, which replaces `colorTheme` and `semanticColorThemes` (both deprecated, still resolved).

- The field is named `colorThemeVariants`.
- The `surface` colour never swaps; a null surface never swaps.
- An explicit `[etProvideColor]` above a surface is swapped inside it when the surface has an entry (accepted
  behaviour change).
- `provideColorScheme()` swaps the default accent on `:root` too.

ADR 0056 applies the same rule to the theme scope.
