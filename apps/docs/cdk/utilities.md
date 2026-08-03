# Utilities

Standalone helpers exported from `@ethlete/cdk`.

::: warning Superseded by @ethlete/core
Every helper on this page has moved or been rebuilt outside the CDK - new code should import it from
`@ethlete/core`:

| CDK                                     | Where it lives now                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createNavigationDismissChecker()`      | [`createUnsavedChangesTracker` / `createUnsavedChangesGuard`](/core/utilities#unsaved-changes) in `@ethlete/core`, or `createOverlayUnsavedChangesGuard` from `@ethlete/components` for a form in an overlay                  |
| `injectRouterNavigationState()`         | the same function from `@ethlete/core` - see [signal utilities](/core/signal-utils)                                                                                                                                           |
| `createSwipeTracker()`                  | the same function from `@ethlete/core` - see [utilities](/core/utilities), _Gestures & input_                                                                                                                                 |
| `FLOATING_UI_PLACEMENTS`                | no successor constant; the components that take fallbacks type them as `Placement[]` from `@floating-ui/dom` directly (e.g. [overlays](/components/overlays), [menu](/components/menu))                                       |
| The [global stylesheet](#global-styles) | there is none to add: every `@ethlete/components` component injects its own CSS (inside `@layer components`), overlay positioning included. The `--ease-*` token set has no successor - copy the values you use into your app |

The unsaved-changes rewrite is the one with real API changes: `form` becomes a generic `source`, `confirm`
replaces `dismissCheckFn` and is required per call site, `refreshDefaultFormValue()` /
`restoreDefaultFormValue()` become `refreshDefaultValue()` / `restoreDefaultValue()`, and it adds a
`canDeactivate()` route bridge, browser-tab locking and one app-wide confirm at a time. This page documents
the CDK versions, which still receive bug fixes.
:::

## Navigation dismiss checker

`createNavigationDismissChecker()` guards forms against accidental dismissal - typically a form inside an overlay. It snapshots the form's default value, tracks whether the current value differs, and runs your confirmation logic only when there are unsaved changes:

```ts
import { createNavigationDismissChecker } from '@ethlete/cdk';

const dismissChecker = createNavigationDismissChecker({
  form: this.form,
  dismissCheckFn: () =>
    this.overlayService
      .show(ConfirmDiscardOverlayComponent)
      .afterClosed()
      .pipe(map((result) => !!result?.confirmed)),
});

// wire it into your overlay's close/backdrop handler:
dismissChecker.runCheck(); // resolves truthy when closing is OK
```

`runCheck()` returns `of(true)` immediately when nothing changed; otherwise it returns whatever your `dismissCheckFn` returns (value, promise or observable). The ref also exposes `hasChanges` (a signal), `refreshDefaultFormValue()` for when the form is prefilled asynchronously after opening, and `restoreDefaultFormValue()` to reset the form. Comparison is a deep equal by default, customizable via `compareFn`. Must be called in an injection context.

## Router navigation state

```ts
import { injectRouterNavigationState } from '@ethlete/cdk';

const state = injectRouterNavigationState<{ from: string }>();
```

Typed access to the current navigation's `extras.state` - returns `null` outside a navigation. Useful in components that receive context from `router.navigate(…, { state })`.

## Swipe tracking

`createSwipeTracker(startEvent)` is the low-level gesture helper behind swipeable UIs. Create it from a `touchstart`/`mousedown` event, feed move events to `update()` and finish with `end()`:

- `update(event)` returns the current movement deltas plus an `isSwiping` / `isScrolling` classification - the axis is locked on the first move, so a vertical page scroll never turns into an accidental swipe.
- `end()` adds velocities in px/s, letting you decide between "snap back" and "fling".
- `cancel()` resets the tracked movement.

## Floating UI placements

`FLOATING_UI_PLACEMENTS` - the constant list of all twelve `@floating-ui/dom` placements (`top`, `bottom-start`, `left-end`, …), handy for building fallback-placement lists.

## Global styles

Besides component styles, the [global stylesheet](/cdk/#styles) contributes: the Angular CDK prebuilt overlay/a11y/text-field CSS (with an overlay-pane grid fix), an easing token set (`--ease-*`, `--ease-out-3`, `--ease-elastic-*`, … ported from open-props), the animated active-tab underline used by the tabs, cursor-drag-scroll helper classes and base positioning for floating elements (`et-floating-element`).
