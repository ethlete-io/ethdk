---
status: accepted
built: 7eb3cb4fd
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/decisions.md, "Colour foundations and agent logos decisions", one source
---

# The foundations/colors part is the one colour source

`themes.ts` and `surface-themes.ts` in `apps/ethlete-studio` are generated from the `foundations/colors` part; the
overrides in `sdk-token-map.css` go away. Each colour change runs as its own sketch: dead copy, then one source plus
the warning theme, then the missing states.
