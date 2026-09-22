---
'@ethlete/components': minor
'@ethlete/core': minor
---

RTL and reduced-motion consistency pass:

- Side sheets and the notification stack dock, animate and drag toward their logical inline edge under `dir="rtl"` - `dragToDismiss.direction` gains `'to-inline-start'` / `'to-inline-end'`.
- `createFlipAnimation` and the PiP animations now skip to their end state under `prefers-reduced-motion`; `ignoreReducedMotion` opts out, and `matchesReducedMotion()` is exported for helpers with no injection context.
- The full-screen overlay animation throws `ET1209` when it has no origin element, instead of a bare `Error`.
