# 08 — Notification (toast) upgrades

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
variant later (this SDK's data layer is `@ethlete/query`) — don't couple the
components lib to query for v1, `firstValueFrom`/promise covers it.

## 2. Custom/dedupe id

Ids are auto-incremented (`notification-ref.ts:12-19`). Accept an optional
`id` in `NotificationConfig`; `open()` with an existing live id updates that
notification in place (equivalent to `ref.update`) instead of stacking a
duplicate. Timer restarts on update (current update semantics — verify and
keep consistent).

## 3. Second action (action + cancel pair)

`NotificationConfig.action` is a single `NotificationAction`
(`notification-config.ts:12-21`) and the template renders one button. Add
`secondaryAction?: NotificationAction` rendered with a quieter button flavor;
both dismiss-on-click by default (existing action semantics), overridable per
action. Keyboard: actions are tab-reachable already via focus-pause — verify
two buttons don't break the focus-pause logic.

## 4. Status icons

Only `loading` renders anything (spinner) — success/error/info get no glyph
(`notification.component.html:1-19`). Add default status icons (success check,
error/warn triangle, info circle) using the icon registry with
`provideIconOverrides`-friendly registration, semantic colors via theme types
(theming skill), plus `icon` in config to override per notification and
`icon: null` to opt out. Keep the icons out of the a11y name (status is
already conveyed by role/content).

## 5. Swipe-to-dismiss

No touch gesture on toasts (grep: no touch/swipe/drag in `notification/`);
mobile users expect flick-away. Build on the pointer-gesture + momentum
primitives from `01-touch-gesture-overhaul.md` (dependency — ship this item
only after 01 lands): horizontal swipe along the stack's inline edge
direction, with the same velocity-or-distance threshold + momentum exit.
Dismissal via swipe counts as manual dismissal (no auto-timer semantics
change). `touch-action: pan-y` on the toast surface.

## 6. RTL stack CSS

Covered by `02-consistency-fixes.md` §2 — coordinate, don't duplicate.

## Explicitly not doing

Per-notification position override and queue-instead-of-evict (current
evict-oldest is a fine design choice) — recorded in findings §5.

## Verification & shipping

Stories: promise flow (success + failure), dedupe id (repeat clicks), two
actions, all status icons, swipe-dismiss (mobile emulator). Docs:
`notification.md` — API tables + promise example. Changeset:
`@ethlete/components` (minor).
