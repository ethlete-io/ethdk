# overlay — DX scan 2026-10-02

Scope: `libs/components/src/lib/` overlay, menu, tooltip, toggletip, filter-overlay, command-palette,
notification, floating-action; guides `apps/docs/components/{overlays,overlay-openers,menu,tooltip,toggletip,filter-overlay,command-palette,notification,floating-action}.md`.

| ID    | Sev    | Kind     | Decision | Title                                                                                          |
| ----- | ------ | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| OV-01 | High   | dx       | yes      | A plain dialog survives an Angular route change, and its opener's `afterClosed` is dropped     |
| OV-02 | High   | bug      | no       | A dialog opened from a menu item loses focus on close (restore target is gone)                 |
| OV-03 | Medium | bug      | yes      | Closing a query-param overlay pushes a history entry, so Back reopens it                       |
| OV-04 | Medium | bug      | no       | Without `strategies`, `directives`, `customAnimated` and the color/surface context are dropped |
| OV-05 | Medium | dx       | yes      | Notification guide promises custom toast UI the stack cannot render                            |
| OV-06 | Medium | dx       | yes      | Data in is stringly typed; `TResult` forces restating `TComponent`                             |
| OV-07 | Medium | dx       | no       | Filter overlay: dismiss yields `undefined`, not `{ didUpdate: false }`; guide uses raw manager |
| OV-08 | Medium | dx       | no       | Notification status colors need a name map; ignore the semantic `type` themes                  |
| OV-09 | Medium | test-gap | no       | Standard (non-query-param) opener lifecycle has no spec                                        |
| OV-10 | Medium | dx       | yes      | No public testing fake for `OVERLAY_REF` / `definition.injectRef()`                            |
| OV-11 | Low    | bug      | no       | `etTooltip=""` opens an empty bubble                                                           |
| OV-12 | Low    | dx       | no       | Missing `provideOverlay()` silently drops modal scroll lock                                    |
| OV-13 | Low    | dx       | no       | `OverlayRef` type exposes internal wiring (`attachRuntime`, `closeVia`, …)                     |
| OV-14 | Low    | dx       | yes      | Small API inconsistencies across the overlay family                                            |

## OV-01 A plain dialog survives an Angular route change, and its opener's `afterClosed` is dropped

- Where: `libs/components/src/lib/overlay/overlay-opener.ts:180-187`, `:222-223`;
  `libs/core/src/lib/overlay/overlay-runtime.ts:211`, `:242` (`appRef.attachView`)
- Problem: the runtime attaches the overlay to `ApplicationRef`, not to the opener's view, and nothing in
  `components/overlay` listens to the Angular `Router` (no `closeOnNavigation`; grep finds only the query-param opener
  and the overlay router). A user on a phone opens a sheet with `createOverlayOpener(def).open()`, presses the
  browser Back button: the page underneath navigates, the sheet stays open over the new route. The opener's
  component is destroyed, so the `afterClosed` callbacks subscribed with `takeUntilDestroyed(destroyRef)` never run
  when the sheet is finally closed - a save-on-close result is silently lost. The guide says callbacks are "cleaned up
  automatically with the opener's injection context" (`overlay-openers.md:96`) but not that the overlay outlives it.
  The query-param opener already closes on destroy (`overlay-opener.ts:354-365`); the standard opener does not.
- Fix: decide one of (a) the standard opener force-closes its open overlays on `destroyRef.onDestroy`, like the
  query-param opener; (b) add `closeOnNavigation?: boolean` (default `true` for modal) to `OverlayConfig`, closing
  with a new source `'navigation'` on `NavigationStart` when a `Router` is injectable. Either way document it in
  `overlay-openers.md` and add an opener spec.
- Breaking: yes (behavior). Decision: yes.
- Status: fixed (wave 2, option b: `closeOnNavigation`, default `true`, on `OverlayConfig` and `[etOverlay]`; closes on a
  `NavigationStart` to another path when `ROUTES` is provided; query-param overlays exempt; opener `afterClosed` survives a
  host destroyed mid-close; specs in `overlay-manager.spec.ts` / `overlay-opener.spec.ts`; no app-level default exists to extend)
- Review: ok (self-review; open risk: an overlay router with `syncUrl` that is destroyed while the navigation is still pending
  may run its `historyGo` cleanup against that navigation)

## OV-02 A dialog opened from a menu item loses focus on close

- Where: `libs/core/src/lib/overlay/overlay-runtime.ts:145`, `:333`;
  `libs/components/src/lib/menu/headless/menu-item.directive.ts:163-167`
- Problem: the runtime captures `document.activeElement` at mount and restores it only if it `isConnected`. The
  common "kebab menu → Edit… dialog" pattern: `<button et-menu-item (click)="edit.open()">` runs the click handler,
  then `closeAll('item')`. At the dialog's mount, focus is inside the menu (the item on Enter; the panel/item on a
  pointer press, whose mousedown is `preventDefault`ed). The menu's own restore is skipped because the dialog now owns
  focus. When the dialog closes, its captured element has been removed with the menu, so focus falls to `<body>` - a
  keyboard user is thrown to the top of the page. No story or e2e covers menu → dialog
  (`apps/storybook-e2e/src/menu`, `menu/stories`).
- Fix: in the runtime, when the captured element sits inside another overlay's host, store that overlay's own restore
  target instead (walk the chain), or fall back to the resolved `origin`/anchor element when the captured one is
  disconnected. Add a core scenario (dialog opened from a nested overlay that closes first) and a menu → dialog story
  plus e2e in `apps/storybook-e2e/src/menu`.
- Breaking: no. Decision: no.
- Status: fixed (core runtime walks a focus-restore chain; core scenario `overlay-focus-restore.scenario.spec.ts`; menu story + e2e not added)
- Review: ok (core runtime hunks only; menu story + e2e still open)
- Status (wave 2): fixed - `Components/Overlays/Menu` story `MenuToDialog` + `menu / opening a dialog` e2e (keyboard and click)
- Review (wave 2): ok (self-review; e2e passes on desktop)

## OV-03 Closing a query-param overlay pushes a history entry, so Back reopens it

- Where: `libs/components/src/lib/overlay/overlay-opener.ts:266-271`, `:304-310`
- Problem: `beforeClosed` calls `updateQueryParam(null)` without `replaceUrl`. Open via `open('42')` (push
  `?product=42`), close with the X / Escape / backdrop → push `/` again. History is `[/, /?product=42, /]`; the next
  Back lands on `?product=42` and the overlay reopens. The overlay router does the opposite on close with `syncUrl`
  ("steps back over the history entries it added", `overlays.md:454`), so the two URL-backed overlays disagree. The
  guide only covers model writes and Back (`overlay-openers.md`, "Query-param overlays"). The spec at
  `overlay-opener.spec.ts:197` checks Back, never an in-app close.
- Fix: when the open was ours (we pushed the entry), close with `location.back()` like the overlay router; otherwise
  (deep link) `replaceUrl: true`. Add a spec: open, close via `ref.close()`, `location.back()` → overlay stays closed.
- Breaking: yes (history behavior). Decision: yes (match the overlay router?).

## OV-04 Without `strategies`, `directives`, `customAnimated` and the theme context are dropped

- Where: `libs/components/src/lib/overlay/overlay-manager.ts:94-118` vs `:161-167`;
  `overlay-container.component.ts:54-57`, `:90`
- Problem: only the strategies path mounts `OverlayContainerComponent`, which is what applies `directives`
  (`componentDirectives` input), `customAnimated` (`et-with-default-animation`), and re-applies the color/surface
  provider across the portal. `overlayManager.open(Comp, { directives: [X] })` or a `defineOverlay` without
  `strategies` silently ignores `directives` (never passed to `overlayRuntime.mount`) and renders unthemed. The
  `OverlayConfig` JSDoc (`overlay-config.ts:41-48`, `:80-85`) and the "Color theme context" section
  (`overlays.md:368`) do not say a strategy is required.
- Fix: either default the no-strategies path to a centered strategy (so the container is always mounted - simplest,
  one code path), or throw a dev-mode `RuntimeError` (new `OVERLAY_ERROR_CODES` entry) when `directives` /
  `customAnimated` are set without `strategies`, and document the limitation on the JSDoc and in `overlays.md`.
- Breaking: no (the first option changes markup of strategy-less overlays slightly). Decision: no.
- Status: fixed (dev-mode `ET1211` for `directives`/`customAnimated` without `strategies`; bare mount documented)
- Review: ok (ET1211 has no clash in other slices)

## OV-05 Notification guide promises custom toast UI the stack cannot render

- Where: `libs/components/src/lib/notification/notification-stack.component.html:1-5`;
  `apps/docs/components/notification.md:213-215`
- Problem: the guide says "For fully custom toasts, build on the headless pieces … `[etNotification]`". The stack
  always renders `<et-notification [ref]="ref" />`, and `NotificationManagerConfig` has no component/template option,
  so a consumer who builds a custom toast has nowhere to plug it in: the built-in stack still renders every
  notification, and rendering `manager.visibleNotifications()` yourself shows each toast twice. There is no story for a
  custom toast.
- Fix: add `component?: Type<unknown>` (receiving `ref` as an input) to `NotificationManagerConfig`, used by the stack
  instead of `et-notification`; add a "custom toast" story and update the guide. If not wanted, cut the guide section
  down to what is possible.
- Breaking: no. Decision: yes (new API).

## OV-06 Data in is stringly typed; `TResult` forces restating `TComponent`

- Where: `libs/components/src/lib/overlay/overlay-definition.ts:83-85`; `overlay-manager.ts:21-24`;
  `apps/docs/components/overlays.md:8`, `overlay-openers.md` "Passing data into the overlay"
- Problem: the guide sells openers as "typed data in and results out", but data goes in as
  `bindings: [inputBinding('productId', () => id)]` - a misspelled input name or a wrong value type compiles and
  fails at runtime (NG0303-style). And because `TResult` has no inference site, typing the result means writing the
  component twice: `defineOverlay<ProductOverlayComponent, ProductResult>({ component: ProductOverlayComponent })`
  (same for `overlayManager.open<C, R>`). Forgetting it makes every `afterClosed` result `unknown`.
- Fix: (a) a result marker that lets both infer, e.g. `defineOverlay({ component, result: overlayResult<ProductResult>() })`;
  (b) a typed `inputs` option on `open()` derived from the component's `InputSignal` members
  (`{ productId: () => id }` mapped to `inputBinding`), keeping `bindings` as the escape hatch.
- Breaking: no (additive). Decision: yes.

## OV-07 Filter overlay: dismiss yields `undefined`, not `{ didUpdate: false }`; guide uses the raw manager

- Where: `libs/components/src/lib/filter-overlay/filter-overlay.ts:124`, `:146`, `:155-174`;
  `apps/docs/components/filter-overlay.md:16`, `:60`
- Problem: the guide says it "closes with `{ didUpdate: true, value }` - `{ didUpdate: false }` on a discard", but
  only `discard()` produces that; Escape / backdrop / drag close with `undefined`, so
  `afterClosed().subscribe((r) => r.didUpdate && …)` throws. The guide's only example calls
  `injectOverlayManager().open(...)`, which `overlays.md:5-13` tells apps not to do, and leaves the result `unknown`.
  The `provideFilterOverlay` JSDoc example calls `injectTeamFilters()` inside `@Component({ providers })` metadata,
  which is not an injection context and cannot work.
- Fix: map a dismiss to `{ didUpdate: false }` (register a close guard-free `beforeClosed` hook, or document
  `FilterOverlayResult | undefined`); rewrite the guide example with `defineOverlay<…, FilterOverlayResult<TeamFilterValue>>`
  - `createOverlayOpener` passing `provideFilterOverlay` per open; fix the JSDoc example the same way.
- Breaking: no. Decision: no.
- Status: fixed (every dismiss yields `{ didUpdate: false }`; guide + JSDoc use `defineOverlay` + `createOverlayOpener`; `provideFilterOverlay` returns `StaticProvider[]`)
- Review: ok

## OV-08 Notification status colors need a name map and ignore the semantic `type` themes

- Where: `libs/components/src/lib/notification/notification.component.ts:78-84`; `notification-config.ts:87-92`;
  `apps/docs/components/notification.md:12`
- Problem: without `statusColorMapping` an error toast gets no color theme at all (`resolvedColor` → `null`), while
  the rest of the lib resolves semantic colors by theme type (`injectSemanticColorTheme('error' | 'success')` in
  alert-dialog, query-error, table). Apps must restate their theme names here. The guide's setup snippet uses
  `'brand'`/`'danger'` without marking them as app-registered names.
- Fix: default `error` → the `type: 'error'` theme and `success` → `type: 'success'` via
  `injectSemanticColorTheme` when the mapping does not list the status; keep the map as override. Label the guide's
  names as example app themes.
- Breaking: no (visual change for apps without a mapping). Decision: no.
- Status: fixed
- Review: ok

## OV-09 Standard opener lifecycle has no spec

- Where: `libs/components/src/lib/overlay/overlay-opener.spec.ts` (suites: query-param opener `:45`, single opener
  `:266` only); `overlay-opener.ts:176-248`
- Problem: nothing covers the plain `createOverlayOpener(def).open()` path: opener + per-open callbacks both firing,
  `null` normalization of the result, config merge order (definition → opener → per-open) through `open()`, the
  fallback `viewContainerRef`, behavior when the opener is destroyed (OV-01).
- Fix: add a `describe('overlay opener')` block covering those cases.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## OV-10 No public testing fake for `OVERLAY_REF` / `definition.injectRef()`

- Where: `libs/components/src/lib/overlay/overlay-definition.ts:58-69`; `libs/components/ng-package.json` (single
  entry point; `*/testing` drivers are internal)
- Problem: an app unit-testing its dialog component hits `ET1207` from `injectRef()` unless it hand-builds an
  `OverlayRef` (a 15-member object including internals). There is no `provideFakeOverlayRef()` returning a spy-able ref
  whose `close(result)` can be asserted, nor a helper to await an opener's close in a page spec.
- Fix: export a small `createTestOverlayRef<TResult>()` + `provideTestOverlayRef(ref)` (records `close` calls, emits
  `afterClosed`) - under a `testing` export or the main entry. Coordinate with `components-rest.md` if a
  `@ethlete/components/testing` entry is proposed there.
- Breaking: no. Decision: yes (new API / entry point).
- Status: fixed (`createTestOverlayRef` / `provideTestOverlayRef` in `lib/testing/fake-overlay-ref.ts`, exported from the main entry)
- Review: fixed - removed from the main entry (internal until CR-02 adds `@ethlete/components/testing`); guide section and changeset clause dropped; scenario imports it directly

## OV-11 `etTooltip=""` opens an empty bubble

- Where: `libs/components/src/lib/tooltip/headless/tooltip.directive.ts:145-148`, `:118-128`
- Problem: only `null` suppresses the tooltip. `[etTooltip]="truncated() ? label : ''"` - a common way to write a
  conditional tooltip - shows an empty arrowed panel on hover and adds an empty description.
- Fix: treat `''` (after `trim()`) like `null` in `show()`, the auto-hide effect and `accessibleDescription`; one
  spec. Same check in `toggletip.directive.ts` for `etToggletip=""`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## OV-12 Missing `provideOverlay()` silently drops modal scroll lock

- Where: `libs/components/src/lib/overlay/overlay.imports.ts:30-36`; `overlay-scroll-blocker.ts:109-112`
- Problem: dialogs, sheets, menus and selects all open without it; the only symptom is the page scrolling behind a
  modal, which is easy to miss in development.
- Fix: in dev mode, warn once from `OverlayManager.open` when a modal overlay opens and the scroll blocker was never
  instantiated (a module flag set by the blocker's factory), naming `provideOverlay()`.
- Breaking: no. Decision: no.
- Status: fixed (warns once per document); wave 2: setup note in `overlays.md`
- Review: ok

## OV-13 `OverlayRef` type exposes internal wiring

- Where: `libs/components/src/lib/overlay/overlay-ref.ts:166-195`
- Problem: `attachRuntime`, `attachComponentInstanceOverride`, `closeVia`, `registerHeaderTemplate` are on the
  public, autocompleted ref (the lib has no `stripInternal`). Calling `ref.attachRuntime(...)` re-subscribes the
  lifecycle subjects. Also `close(result?)` vs `forceClose(source?, result?)` take the result in different positions.
- Fix: keep the internals in a non-exported `OverlayRefInternal` type (or a WeakMap side table) used by the manager,
  container and single slot; consider `forceClose(result?, source?)` for symmetry with `close`.
- Breaking: yes (removes members; `forceClose` order). Decision: no.
- Status: fixed (internals in a WeakMap side table, `forceClose(result?, source?)`)
- Review: fixed - changeset marked breaking with the migration; no ea-frontend callers

## OV-14 Small API inconsistencies across the overlay family

- Where: `overlay-opener.ts:33-36` vs `overlay-ref.ts:97-99`; `command-palette/command-palette.overlay.ts:30` vs
  `overlay/alert-dialog/alert-dialog-opener.ts`; `menu/headless/menu.directive.ts:91` vs
  `overlay/headless/overlay.directive.ts:49`; `tooltip/headless/tooltip.directive.ts:77`;
  `menu/headless/menu-item.directive.ts:47`
- Problem: opener callbacks get `TResult | null`, the ref's observables `TResult | undefined`.
  `injectCommandPalette()` returns an opener while its sibling is `createAlertDialogOpener()`. `etMenu`'s `autoFocus`
  is a boolean, `etOverlay`'s a target/selector/`false`. `showDelay` (tooltip) and `closeOnActivate` (menu item) have
  no `numberAttribute` / `booleanAttribute` transform while their siblings do, so `showDelay="500"` and a bare
  `closeOnActivate` fail to type-check.
- Fix: pick `undefined` for both result paths; rename to `createCommandPaletteOpener` (keep an alias for one
  release); add the transforms.
- Breaking: yes (result nullability, rename). Decision: yes (which names win).
