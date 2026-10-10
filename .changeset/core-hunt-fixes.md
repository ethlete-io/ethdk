---
'@ethlete/core': patch
---

Fix several core edge cases:

- `AnimatedLifecycleDirective`: `forceEnteredState()`, `forceLeftState()` and the instant and skipped enter/leave paths now remove every other animation class, so an element never carries `enter-done` and `leave-done` (or a stale `-active`/`-to`/`-interrupt` class) at once.
- `getScrollSnapTarget` skips items without a box (`display: none`), instead of treating them as already aligned and not snapping at all.
- `[etClickOutside]` no longer swallows the next keyboard click outside after a press inside that was cancelled (a touch that turned into a scroll).
- `signalElementIntersection` keeps its entries in DOM order when an element is inserted while a `rootMargin` is set.
- `isElementVisible().intersectionRatio` is now the visible share of the element's area, matching `IntersectionObserver`, instead of the smaller of the two axis ratios.
- `createUnsavedChangesTracker({ defaultValue: null })` captures the first non-null value as its baseline, like an omitted `defaultValue`.
