# notification, tabs, scrollable, button scan - open findings

Scan of `libs/components/src/lib/{notification,tabs,scrollable,button}` from 2026-09-28. 0 High, 1 Medium, 11 Low, 1 Spec (verified 2026-09-28). Skipped: stories, most specs, testing drivers, and a line-by-line read of the large CSS files (grep only for `@layer`, colours and transitions).

## notification

- Medium: the stack is a `role="log"` region with `aria-relevant="additions"`, and every item is also a `role="status"`/`"alert"` region (`notification-stack.component.ts:15-17`, `headless/notification.directive.ts:37`). A `promise()` that settles changes text and swaps `status` to `alert` in place, which the outer region ignores and screen readers announce unreliably. Pick one live region and test the loading-to-error path with a screen reader. M Verified in code. Unverified: no screen-reader run.

## scrollable

- Low: `et-scrollable-masks` renders by default and always calls `activateChildIntersections()`, so every plain track runs an IntersectionObserver with 27 thresholds per child (`headless/scrollable-masks.component.ts:21`, `scrollable.component.html:24`). Activate only for a mask variant that needs partial-item state. S
- Low: `masksDirective` is never reset when `renderMasks` turns off, so `--has-partial-items` keeps computing (`headless/scrollable-masks.component.ts:20`). S
- Low: `scrollable-footer.css` is listed in two components' `styleUrls`, so it ships twice and injects twice when both buttons and dots are on (`headless/scrollable-navigation.component.ts:34`, `headless/scrollable-buttons.component.ts:37`). Move it to one styles-only component. S
- Low: a dot click on the child that is already in place sets a manual index that no scroll event clears, so the dots stay stuck until the next scroll (`headless/scrollable-navigation.component.ts:154`). S
- Low: the dots' `translateX` offset is not flipped in RTL (`headless/scrollable-navigation.component.ts:118-120`). S
- Low: `gapValue` calls the global `getComputedStyle` without a platform guard (`headless/scrollable.directive.ts:204`); verify it does not run under SSR. S
- Low: rationale comments at `headless/scrollable.directive.ts:85-87,111-114`, `headless/scrollable-snap.directive.ts:38-39`, `headless/scrollable-drag.directive.ts:26`, `headless/scrollable-navigation.component.ts:136`. S

## button

- Low: `kind="close"` hardcodes `rgba(232, 17, 35, …)` and `#ffffff` as primary values (`window-control-button.component.css:107-118`). Route through a token with these as fallbacks. S
- Low: `et-button` does not forward `emitAriaPressed`, but `et-icon-button` does (`button.component.ts:92`, `icon-button.component.ts:44`). S
- Low: a disabled `a[etButton]` keeps its `href`, so a middle click (`auxclick`) still opens it (`headless/button.directive.ts:34,89-96`). S
- Low: `icon-button`, `text-button` and `fab` import `BUTTON_SIZES`/`BUTTON_SPINNER_CONFIG` from `button.component.ts`; move the shared constants to their own file so the modules do not depend on `ButtonComponent` (`icon-button.component.ts:6`, `text-button.component.ts:7-13`, `fab.component.ts:7-14`). S

## Spec gaps

- Spec: `scrollable-snap`, `scrollable-navigation`, `scrollable-buttons` and the container paging path have no spec. M
