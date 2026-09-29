# notification, tabs, scrollable, button scan - open findings

Scan of `libs/components/src/lib/{notification,tabs,scrollable,button}` from 2026-09-28. 0 High, 0 Medium (1 fixed: stack `role="log"` dropped in 0989b1cab), 0 Low (2 fixed: `emitAriaPressed` forwarded on button and window-control-button in b3b76368b, scrollable masks observe children once the track overflows 711ba0d34), 1 Spec (verified 2026-09-28). Skipped: stories, most specs, testing drivers, and a line-by-line read of the large CSS files (grep only for `@layer`, colours and transitions).

## Spec gaps

- Spec: `scrollable-snap`, `scrollable-navigation`, `scrollable-buttons` and the container paging path have no spec. M
