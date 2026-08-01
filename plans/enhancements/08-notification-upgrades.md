# 08 - Notification (toast) upgrades

The stack's core is strong (update-in-place refs, hover/focus pause, FLIP
animation, `role="log"` live region, per-status durations, `maxVisible`).
These are the ergonomic gaps vs. Sonner-class toast systems.

## 1. Promise-based API

Today an async flow is manual: `open({status:'loading'})` + `ref.update(...)`.
Add sugar on `NotificationManager` (`notification-manager.ts:27-32`):

```ts
manager.promise(work: Promise<T> | Observable<T> /* or a query? */, {
  loading: NotificationContentInit,
  success: (v: T) => NotificationContentInit,
  error: (e) => NotificationContentInit,
}): NotificationRef
```

Opens as `loading`, transitions via the existing `ref.update()` machinery.
Decide the input type deliberately: `Promise` minimum; consider a query-aware
variant later (this SDK's data layer is `@ethlete/query`) - don't couple the
components lib to query for v1, `firstValueFrom`/promise covers it.

## 2. Custom/dedupe id

Ids are auto-incremented (`notification-ref.ts:12-19`). Accept an optional
`id` in `NotificationConfig`; `open()` with an existing live id updates that
notification in place (equivalent to `ref.update`) instead of stacking a
duplicate. Timer restarts on update (current update semantics - verify and
keep consistent).

## 3. Second action (action + cancel pair)

`NotificationConfig.action` is a single `NotificationAction`
(`notification-config.ts:12-21`) and the template renders one button. Add
`secondaryAction?: NotificationAction` rendered with a quieter button flavor;
both dismiss-on-click by default (existing action semantics), overridable per
action. Keyboard: actions are tab-reachable already via focus-pause - verify
two buttons don't break the focus-pause logic.

## 4. Status icons

Only `loading` renders anything (spinner) - success/error/info get no glyph
(`notification.component.html:1-19`). Add default status icons (success check,
error/warn triangle, info circle) using the icon registry with
`provideIconOverrides`-friendly registration, semantic colors via theme types
(theming skill), plus `icon` in config to override per notification and
`icon: null` to opt out. Keep the icons out of the a11y name (status is
already conveyed by role/content).

## 5. Swipe-to-dismiss

No touch gesture on toasts (grep: no touch/swipe/drag in `notification/`);
mobile users expect flick-away. Build on the pointer-gesture + momentum
primitives from `01-touch-gesture-overhaul.md` (dependency - ship this item
only after 01 lands): horizontal swipe along the stack's inline edge
direction, with the same velocity-or-distance threshold + momentum exit.
Dismissal via swipe counts as manual dismissal (no auto-timer semantics
change). `touch-action: pan-y` on the toast surface.

## 6. RTL stack CSS

Covered by `02-consistency-fixes.md` §2 - coordinate, don't duplicate.

## Explicitly not doing

Per-notification position override and queue-instead-of-evict (current
evict-oldest is a fine design choice) - recorded in findings §5.

## Found while implementing (2026-07-30 - all six items done)

- **Queries are in the sugar API after all.** `components` already depends on
  `@ethlete/query`, so `promise()` takes a promise, an observable _or_ a query
  (`ReadonlyQuery`), overloaded so the error callback is typed
  `QueryErrorResponse` for the query case and `unknown` otherwise. A query is
  _followed_, never executed: an `effect` on `executionState()` settles on the
  first terminal state, and declaring `progress` in the `loading` content opts
  the toast into mirroring the request's upload progress. `execute()` returns
  `void`, hence "execute, then hand the query over in the same turn".
- **Observables settle on completion with their last value** (`lastValueFrom`
  semantics, empty completion = failure). Dismissing a notification never
  unsubscribes - that would cancel the caller's HTTP request.
- **`update()` merges, an id collision must replace.** Dedupe needed a second,
  internal path on the ref (`replaceConfig`) that swaps the whole config so keys
  the new `open()` leaves out actually go back to unset, keeping the ref's own
  identity. The same path is what the promise API uses to settle.
- **Two refs may never share an id** (the stack's `@for` tracks by it), so an
  `open()` landing on an id that is already animating out drops that one
  immediately instead of letting the pair coexist.
- **The swipe reuses the sheet's `!important` trick, not a hand-rolled exit.**
  The gesture leaves its inline transform in place and the `[data-swiped-away]`
  leave-to rule overrides it with `!important`, so the existing
  animated-lifecycle drives the exit (and `markDismissed`) - animating the exit
  manually and dismissing afterwards would leave the lifecycle waiting for a
  transition that never runs. Momentum is handed over as an inline
  `transition-duration`, exactly like `applyDismissMomentum`. The drag's fade
  goes through a CSS var (`--_et-notification-swipe-opacity`) so the
  higher-specificity enter/leave rules still win.
- **`touch-action: pan-y` really is enough here** (unlike the sheet, per plan
  01): a toast never scrolls on its own dismiss axis, so no non-passive
  `touchmove` is needed. `pointerdown` also pauses the auto-dismiss timer -
  touch has no hover to pause it.
- **Actions register as a list.** `NotificationDirective.registeredAction`
  became `registeredActions`, and the action directive takes its slot from its
  own attribute value (`etNotificationAction="secondary"`); `slot` as a member
  name is banned by lint (native HTML attribute).
- Storybook's preview bundle carries a **stale ts-checker error** from
  `calendar.directive.ts` (the type it complains about does have the member -
  `nx build components` is clean). It only matters because the error overlay
  swallows clicks in Playwright; hide it and drive on.

## Verification & shipping

Stories: promise flow (success + failure), dedupe id (repeat clicks), two
actions, all status icons, swipe-dismiss (mobile emulator). Docs:
`notification.md` - API tables + promise example. Changeset:
`@ethlete/components` (minor).
