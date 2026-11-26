---
'@ethlete/cli': patch
---

The design check reads the tokens that an imported `@ethlete/<lib>/design` module defines in its stylesheets, so `var(--_et-focus-ring-width)` from `buttonStyles` no longer shows as UNDEFINED-TOKEN.
