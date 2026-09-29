# notification, tabs, scrollable, button scan - open findings

Scan of `libs/components/src/lib/{notification,tabs,scrollable,button}` from 2026-09-28. 0 High, 1 Medium, 0 Low (2 fixed: `emitAriaPressed` forwarded on button and window-control-button in b3b76368b, scrollable masks observe children once the track overflows 711ba0d34), 1 Spec (verified 2026-09-28). Skipped: stories, most specs, testing drivers, and a line-by-line read of the large CSS files (grep only for `@layer`, colours and transitions).

## notification

- Medium: the stack is a `role="log"` region with `aria-relevant="additions"`, and every item is also a `role="status"`/`"alert"` region (`notification-stack.component.ts:15-17`, `headless/notification.directive.ts:37`). A `promise()` that settles changes text and swaps `status` to `alert` in place, which the outer region ignores and screen readers announce unreliably. Pick one live region and test the loading-to-error path with a screen reader. M Verified in code. Unverified: no screen-reader run.

## Spec gaps

- Spec: `scrollable-snap`, `scrollable-navigation`, `scrollable-buttons` and the container paging path have no spec. M
