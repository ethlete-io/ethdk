---
'@ethlete/components': minor
---

Overhaul the sheet drag-to-dismiss gesture. It runs on pointer events now (one path
for touch, pen and mouse) and waits for 8px of travel along the dismiss axis before
following the pointer, so a swipe starting on scrolled overlay content scrolls it
instead of hijacking the sheet. Both the snap-back and the exit animate at the speed
the pointer had when it let go, clamped to 100–350ms and skipped under
`prefers-reduced-motion`. New `dragToDismiss.snapPoints` parks the sheet at fractions
of its own size, advancing one point per flick and dismissing past the last one.
