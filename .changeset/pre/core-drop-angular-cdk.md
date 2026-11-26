---
'@ethlete/core': major
'@ethlete/cdk': patch
---

`@ethlete/core` no longer depends on `@angular/cdk`: `injectBreakpointObserver()` is a plain
`matchMedia` implementation (same API), and `AnimatedOverlayDirective` moved to `@ethlete/cdk` -
import it from there.
