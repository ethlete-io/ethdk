# Components lib scan — noteworthy findings

Scan date: 2026-08-22 (in progress). Scope: all of `libs/components` — about 125k lines of
non-spec source under `src/lib` across 48 domains, plus the matching guides under
`apps/docs/components/`. Review agents read the source per batch; each agent verified its
claims against the code, and runtime-verified its top claims where practical.

Note: the working tree carried uncommitted changes in cascader, rich-text-editor, menu,
scrollbar and time-picker (branch `next`). The scan reviews the tree as it stands.

Model use: Opus 5 agents for the deep domain reviews, Sonnet 5 for the small domains,
Fable for batch design, synthesis and cross-checks.

## Batch status

| # | Scope | Lines | Model | Status |
| - | ----- | ----- | ----- | ------ |
| 1 | forms/rich-text-editor + multi-language-rich-text-editor | 11.4k | opus | done — 3 high / 13 medium / 12 low |
| 2 | forms/date-time | 6.8k | opus | done — 4 high / 4 medium / 10 low |
| 3 | forms/select + cascader | 8.4k | opus | done — 3 high / 6 medium / 8 low |
| 4 | forms/form-field + input + textarea + masked-input + form + description | 6.8k | opus | pending |
| 5 | forms/selection-list + choice-field + checkbox + switch + rating + selection-card | 5.4k | opus | pending |
| 6 | forms/slider + dropzone + color-input | 7.6k | opus | pending |
| 7 | forms/phone-input + otp-input + tag-input + forms/testing | 3.9k | opus | pending |
| 8 | table | 10.7k | opus | done — 3 high / 8 medium / 12 low |
| 9 | overlay | 7.5k | opus | done — 2 high / 8 medium / 10 low |
| 10 | stream | 6.9k | opus | pending |
| 11 | bracket | 7.9k | opus | pending |
| 12 | scheduler | 5.4k | opus | pending |
| 13 | grid + masonry | 4.5k | opus | pending |
| 14 | menu + command-palette + toggletip + tooltip | 5.5k | opus | pending |
| 15 | carousel + scrollable + scrollbar | 5.2k | opus | pending |
| 16 | calendar + time-picker | 4.0k | opus | pending |
| 17 | notification + tabs + accordion + tree | 5.6k | opus | pending |
| 18 | match + standings | 2.6k | sonnet | pending |
| 19 | button + chip + badge + avatar + banner + card + divider | 3.4k | sonnet | pending |
| 20 | icon + picture + skeleton + loader + empty-state | 3.4k | sonnet | pending |
| 21 | pagination + breadcrumb + progress-steps + timeline + kbd + toolbar + description-list + copy-button + focus-ring | 3.2k | sonnet | pending |
| 22 | query-error + filter-overlay + floating-action + testing + internals | 2.0k | sonnet | pending |

Severity counts so far: —

Scope note: besides defects, each batch also collects improvement ideas (features, DX,
bundle size, UI/UX, testing) per user request.

## Summary of the worst problems

(to be filled as batches complete)

---

## overlay

Scope: `libs/components/src/lib/overlay/**` (root, `headless/`, `strategies/`, `routing/`, `sidebar/`, `utils/`),
plus `apps/docs/components/overlays.md` and `apps/docs/components/overlay-openers.md`.
Runtime verification used a scratch spec in the domain folder (since deleted); the working tree is unchanged.

### High

- **A `strategies` array whose every entry declares a `breakpoint` crashes `overlayManager.open()` below the smallest one.**
  `strategies/overlay-strategy-controller.ts:112-114` reduces the *matched* entries with no initial value:
  ```ts
  const activeBreakpoints = breakpointMatchResults.filter((entry) => entry.isActive());
  return activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr)).strategy;
  ```
  The built-in presets always include one breakpoint-less entry, so nothing in the lib hits it - but
  `strategies` is public API documented as "an array of `{ breakpoint?, strategy }` entries"
  (`overlays.md:263`) with `breakpoint` optional, so a consumer array of `[{ breakpoint: 'md', strategy }]`
  is legal and throws on open, and `getHighestMatchedStrategy` is also the `linkedSignal` source
  (line 367), so the same throw can fire later on a resize down past the smallest breakpoint.
  **Runtime-verified**: opening with `strategies: () => [{ breakpoint: 'md', strategy }]` under jsdom threw
  `TypeError: Reduce of empty array with no initial value`.

- **An `origin` passed as anything but a click/touch/contextmenu event is silently discarded, so the
  full-screen dialog loses its signature animation and the anchored dialog its transform origin.**
  `strategies/overlay-origin.ts:3` identifies a pointer event by the *first character* of its type:
  `export const isPointerEvent = (event: Event): event is PointerEvent => event.type[0] === 'c';`
  `getOriginCoordinatesAndDimensions` (same file, lines 30-42) therefore returns `null` for
  `pointerdown`, `mousedown`, `keydown` or `focus` origins. Consequences:
  `strategies/fullscreen-animation.ts:399-408` (`createInitialState`) resolves no `originElement`, so
  `shouldUseReducedAnimation` (line 166) forces the reduced fade - the "animates from the origin element"
  behaviour promised at `overlays.md:212` never runs; and `strategies/anchored-dialog.strategy.ts:82-87`
  skips `applyOriginTransformOrigin`, so the pane scales from its own centre instead of the trigger
  (`overlays.md:229` documents the opposite as the `applyTransformOrigin: true` default).
  Nothing in the lib exercises it because every story binds `(click)` (`stories/components/overlay-storybook.component.ts:90-94`),
  which makes this a latent trap rather than a visible defect - and `isPointerEvent` is itself exported
  public API via `strategies/index.ts`.
  **Runtime-verified**: `{"click":{"isPointerEvent":true,"origin":true},"pointerdown":{"isPointerEvent":false,"origin":false},"mousedown":{"isPointerEvent":false,"origin":false},"contextmenu":{"isPointerEvent":true,"origin":true},"keydown":{"isPointerEvent":false,"origin":false}}`.

### Medium

- **The overlay container decides its surface elevation from `config.mode`, ignoring the strategy's own
  `hasBackdrop`, so an anchored dialog always mounts at elevation 1 instead of one above its trigger.**
  `overlay-container.component.ts:103-104`:
  ```ts
  const hasBackdrop = this.overlayRef.config.hasBackdrop ?? this.overlayRef.config.mode !== 'non-modal';
  const elevation = hasBackdrop || !parentSurface ? 1 : parentSurface.elevation + 1;
  ```
  `anchoredDialogOverlayStrategy` sets `hasBackdrop: false` on the *strategy* config
  (`strategies/anchored-dialog.strategy.ts:43`), which never reaches `overlayRef.config`; `mode` defaults
  to modal. So an anchored dialog opened from inside a dialog (elevation 1) resolves `hasBackdrop = true`
  and forces elevation 1 - the same surface as its parent, with no visual separation. The controller
  resolves the same question correctly (`strategies/overlay-strategy-controller.ts:163-165`:
  `config.hasBackdrop ?? strategyConfig.hasBackdrop ?? config.mode !== 'non-modal'`), and the scroll
  blocker reads the live backdrop element instead (`overlay-scroll-blocker.ts:26`). This also contradicts
  `overlays.md:193` ("Modal dialogs are the exception - **a backdrop** resets the visual context"), which
  describes the backdrop, not the mode. Code-verified only (needs a browser to see the resulting colour).

- **`documentClass` / `bodyClass` are added and removed unconditionally, so closing one overlay strips the
  class from another still-open overlay that needs it.**
  `strategies/overlay-strategy-controller.ts:321-327` adds them on attach and
  `:227-235` / `:354` removes them on `afterClosed`, with no reference counting. Two concurrently open
  full-screen dialogs both add `et-overlay--full-screen-dialog-document`
  (`strategies/full-screen.strategy.ts:29`) to `documentElement`; the first close removes it while the
  second is still open. The pane/host/backdrop class paths are per-element and unaffected - only the two
  shared document-level buckets have this problem. Code-verified only.

- **`OverlayBreakpointConfig.hasBackdrop`'s JSDoc states the opposite of what the code and the docs page say.**
  `strategies/overlay-strategy.types.ts:186-188`: "Only applied at mount time (the initially matched
  strategy) - it cannot change during breakpoint switches." The controller's `applyBackdrop`
  (`overlay-strategy-controller.ts:242-254`) calls `runtimeRef.updateBackdrop(resolveHasBackdrop(strategyConfig))`
  on every switch and fades a newly added backdrop in, and `overlays.md:274` documents that as a feature
  ("A switch carries the strategy's own `hasBackdrop` over too"). There is even a spec for it
  (`overlay-strategy-controller.spec.ts:168`). The JSDoc is what a consumer reads from the IDE.

- **Destroying a query-param opener clears the URL param but leaves the overlay open and orphaned.**
  `overlay-opener.ts:248-254`:
  ```ts
  destroyRef.onDestroy(() => {
    teardown();
    if (overlayRef) { updateQueryParam(null); }
  });
  ```
  Clearing the param is what normally closes the overlay, via the `effect` at line 227-246 - but that
  effect belongs to the same injection context and is destroyed in the same teardown, and the
  `router.navigate` is async anyway. The overlay outlives the opener (the runtime mounts through
  `appRef.attachView`, not the `ViewContainerRef` lifecycle), with its param already gone. Escape or a
  backdrop press still dismisses it, but an overlay opened with `disableClose: true` has no way out.
  Code-verified only.

- **The `[etOverlay]` directive gets permanently stuck reporting `open = true` when its surface template
  registers after `open` flips.**
  `headless/overlay.directive.ts:86-118`: the effect tracks only `disabled`, `open` and `overlayRef`;
  `mountOverlay()` reads `registeredSurface()` inside `untracked` (line 183-186) and returns silently when
  it is null. Since the surface registering does not re-trigger the effect and `open` never changes, the
  model stays `true` with nothing mounted - and a subsequent `show()` is a no-op because `open()` is
  already `true` (line 138-140). A surface behind an `@if`/`@defer` hits this. It self-heals after one
  full toggle (`hide()` then `show()`), and dev mode throws ET1200, which is why this is Medium.
  **Runtime-verified**: `{ openAfterMountAttempt: true, panesAfterAttempt: 0, panesAfterSurface: 0 }`
  plus `ERROR RuntimeError: ET1200`.

- **The unsaved-changes guard's `disableClose` warning can never fire on the default config.**
  `utils/overlay-unsaved-changes-guard.ts:83`:
  ```ts
  if (isDevMode() && overlayRef.config.disableClose && (dismiss.outsidePointer || dismiss.escape || dismiss.drag))
  ```
  reads the *raw* `dismissSources` rather than the resolved `guarded` map built two lines above (76-81),
  where each source defaults to `true`. With `dismissSources` omitted - the documented default
  (`overlays.md:122`) and the common case - every field is `undefined`, so the warning about escape /
  outside-pointer / drag never reaching the guard is suppressed exactly when the developer has not thought
  about it. Code-verified (pure logic).

- **`etOverlayTrigger` exposes `aria-expanded` but never links the trigger to the pane it opens.**
  `headless/overlay-trigger.directive.ts:9-13` sets `aria-expanded` and `data-overlay-open` only - no
  `aria-haspopup`, no `aria-controls`, and the runtime host element it opens carries no id the trigger
  could point at. For the directive's default non-modal mode the runtime also assigns no `role`
  (`overlay-manager.ts:100`: `role = config.role ?? (modal ? 'dialog' : undefined)`), so a screen-reader
  user is told "expanded" with nothing named or reachable. Docs (`overlays.md:310`) only claim
  "click toggles, manages `aria-expanded`", so this is a gap rather than a contradiction.

- **`back()` on a `syncUrl` overlay opened by a deep link steps the browser out of the page instead of
  closing the overlay.**
  `routing/overlay-router.ts:387-392`: with `syncUrl` set, `back()` delegates unconditionally to
  `location.back()` and returns `true`, so `[etOverlayBackOrClose]`
  (`routing/overlay-back-or-close.directive.ts:35-37`) never reaches its `overlayRef.close()` fallback.
  Normally the initial `updateBrowserUrl` (line 437) pushed an entry, so browser-back drops the param and
  the effect at line 452-454 closes the overlay. On a deep link the param is already in the URL, that
  navigation is a no-op, and the back step leaves the app page. `overlays.md:405` documents the return
  value being unreliable, but `overlays.md:367` still promises "goes back - or closes the overlay when
  there's no history". Code-verified only.

### Low

- **Unreachable throw.** `strategies/fullscreen-animation.ts:476-482` throws
  `MISSING_ANIMATION_ORIGIN` when `state.originElement` is null, but `shouldUseReducedAnimation`
  (line 166) returns `true` for exactly that case and the function has already returned at line 471.
  The error code `1209` is consequently dead.
- **`documentClass: 'et-overlay--full-screen-dialog-document'`** (`strategies/full-screen.strategy.ts:29`)
  has no matching rule anywhere in `libs/components` - it is a consumer hook, and an undocumented one
  (`overlays.md` never mentions `documentClass`/`bodyClass`).
- **Two hardcoded colours as primary values**, against the theming rule in AGENTS.md:
  `overlay-container.component.css:10` (`--et-overlay-body-divider-color: #565656`, also consumed by
  `sidebar/overlay-sidebar.component.css:12`) and `:28` (`--_et-overlay-drag-handle-color: #565656`).
  Neither is a `var(--token, <fallback>)`. Every other colour in the domain resolves from
  `--et-surface-*` correctly. (`--et-overlay-backdrop-color: rgb(0 0 0 / 0.32)` at `:368` is a scrim, so
  arguably intentional.)
- **Misplaced JSDoc.** `overlay-container.component.ts:198-203` documents "the element whose surface the
  container should visually continue … the first painted element in the rendered content" - that describes
  `resolvePaintedPaneElement` (line 268), not `parentDiSurface`, which it sits on.
- **Docs: the sidebar page component is described backwards.** `overlays.md:411` says that *above*
  `renderSidebarFrom` the sidebar renders inline "with each nav target as an `<et-overlay-sidebar-page>`".
  `OverlaySidebarPageComponent` is internal-only, mounted as a *route* by `sidebar/sidebar-overlay.ts:104-115`
  when the sidebar **collapses**, and it is never a per-nav-target element - the doc's own example
  (lines 416-421) correctly omits it.
- **Docs: "Every factory accepts a partial `OverlayBreakpointConfig`"** (`overlays.md:219`) is false for two
  entries in the table above it: `centeredOverlayStrategy` takes `CenteredOverlayStrategyOptions`
  (`strategies/anchored.strategy.ts:41-48` - classes and sizes only, no `dragToDismiss`/`hasBackdrop`/`arrow`),
  and the exported `anchoredOverlayStrategy` (same file, line 100) is missing from the table entirely.
- **Public API with no JSDoc and a name that collides with core.** `strategies/index.ts` re-exports
  `isHtmlElement`, `isTouchEvent` and `isPointerEvent` from `overlay-origin.ts`; `@ethlete/core` already
  exports `isHTMLElement`, which the controller imports two files away
  (`overlay-strategy-controller.ts:21`) while `overlay-origin.ts:1` defines its own.
- **`etOverlayTitle` wires `aria-labelledby` exactly once, from a microtask.**
  `overlay-title.directive.ts:32-41`: a later change to the `id` input is not reflected, and for a
  non-modal overlay (no `role`) the name has no host to attach to.
- **Static `type: 'button'` on selectors that match any element.**
  `routing/overlay-router-link.directive.ts:18` and `routing/overlay-back-or-close.directive.ts:21` put
  `type="button"` in static host metadata, and `overlay-close.directive.ts:12` binds `[attr.type]` with a
  `'button'` default - all three apply to an `<a>` or `<div>` host too, where the attribute is invalid.
  `OverlayCloseDirective` also listens for `click` only, so on a non-button host it is not keyboard-reachable.
- **Path asymmetry in the manager.** `overlay-manager.ts:89-140` (`open`, no strategies) never calls
  `resolveOrigin`, so the focused-element fallback applies only on the `openWithStrategies` path
  (line 150) - correctly documented at `overlays.md:59`, but the two paths reading `config.origin`
  differently is easy to trip over when reading the file.

### Spec coverage

**Well covered.** `overlay-config-merger.ts` and `strategies/overlay-strategy-config-merger.ts` (both
exhaustive, including the `undefined`-never-clobbers and explicit-`null` rules and the multiple-layout-class
throw); `get-closest-overlay.ts`'s `isTargetInsideOverlayTree` (transitive nesting, Event origins,
unrelated panes); `overlay-scroll-blocker.ts` (modal, non-modal, backdrop-on-mount and both directions of a
strategy switch); `strategies/overlay-strategy-controller.ts` (initial strategy pick, event-origin
resolution to the nearest clickable ancestor, animation delegation, backdrop add/remove on switch,
breakpoint switching, sizing style composition); `strategies/overlay-drag-to-dismiss.ts`'s
`touch-action`/interactive-target opt-outs; `utils/overlay-unsaved-changes-guard.ts` (close and route guards,
both outcomes, `dismissSources`, `refreshDefaultValue`, `destroy`); the four `headless/` directives
(registration, unregistration on destroy, anchored vs centered selection, surface `close` context);
`overlay-container.component.ts`'s colour and provider context; `overlay-template-host.component.ts`.

**Real logic with zero tests.**
- `overlay-opener.ts` (282 lines) - both openers are entirely untested: the additive merge at the call
  site, per-open lifecycle attachment, and in particular the whole query-param machinery (URL→open,
  external param change→model push, model write→URL, `beforeClosed` param clearing, the destroy path that
  produced a Medium above). The largest untested surface in the domain.
- `strategies/fullscreen-animation.ts` (770 lines) - no tests at all, including every branch of
  `startFullscreenLeaveAnimation`'s clone-state machine and the hidden-count refcounting on the origin
  element.
- `routing/overlay-router.ts` - only navigation guards are covered
  (`routing/overlay-router-navigation-guard.spec.ts`). `resolvePath` (relative `./`, `../`, the `r === '/'`
  → `'back'` special case), the in-memory history and `back()`, the animation-direction resolution
  (route hints vs route order vs navigate config) and the `nativeBrowserBackStack` forward/backward
  inference are all untested.
- `routing/overlay-router-outlet.component.ts` (focus re-application per navigation, `activePageElement`
  index alignment), `sidebar/sidebar-overlay.ts` (route add/remove and `transitionType` flips on the
  pane-width threshold), `overlay-definition.ts`, `query-param-overlay-link.directive.ts`.
- The content directives: `overlay-body/header/footer/main/title/close`. Neither ET1208 (piece without an
  `etOverlayMain`) nor ET1206 (nested mains) nor the `aria-labelledby` auto-wiring has a spec, and both are
  documented behaviour (`overlays.md:159`, `:429`).
- `overlay-manager.ts`'s `resolveOriginDocument` / `resolveZIndex` / `isValidOriginElement`, and
  `overlay-ref.ts`'s guard aggregation and `closeVia`/`forceClose` (`overlay-ref.spec.ts` only asserts the
  three initial field values).

**Wrong assertions.** None found. `overlay-strategy-controller.spec.ts:119` pins the max-size clamp
(`min(640px, var(--et-overlay-max-width, 640px))`) which is correct; the deliberate choice of clamping
`minWidth`/`minHeight` against the **max** CSS vars (`overlay-strategy-controller.ts:187-188`) is
unasserted but is intentional - there is no `--et-overlay-min-*` var anywhere.

Clean: every CSS file in the domain is wrapped in `@layer components` and none uses Tailwind; the
`:where()`/interaction-state convention is respected. The drag-to-dismiss gesture is careful - all six
listeners are scoped with `takeUntil(stop$)` **and** `takeUntil(overlayRef.afterClosed())`, the settle
timer is scoped to `stop$`, selection lock/unlock is balanced, and the snap-point math matches its docs.
The strategy controller's child `EnvironmentInjector` is destroyed on `afterClosed`, and the `linkedSignal`
+ `isFirstRun` guard correctly suppresses a switch on the initial match. `createOverlayRef`'s aggregate
close guard reading a live `Set` genuinely solves the register-before-attach ordering it documents.
`isTargetInsideOverlayTree`'s fixpoint loop over `origin` containment is the right answer for nested
popovers and is well tested. Signals-vs-RxJS discipline holds throughout: no subscribe-and-assign,
`takeUntilDestroyed` last in every pipe that has it, and the two places bridging (`toObservable` in the
scroll blocker and the sidebar, `toSignal` for the frame-delayed `currentRoute`) are correct.
`overlay-config-merger.ts` matches its documented semantics exactly.

### Improvements

#### Features (ranked)

1. **Ship a confirm/alert dialog primitive.** Every peer library has one (Material's
   `MatDialog` + `MatConfirmDialog` patterns, PrimeNG `ConfirmDialog`, Ark UI's alert dialog), and this
   lib's own flagship feature needs one: the documented `createOverlayUnsavedChangesGuard` example
   (`apps/docs/components/overlays.md:105`) tells the consumer to hand-write `ConfirmDiscardComponent`,
   and a grep of `libs/components/src/lib` finds no confirm dialog anywhere. A
   `defineOverlay`-based `confirmOverlay` with `role: 'alertdialog'`, a localizable label bundle (the
   pattern already used by `forms/select/select-labels.ts`) and a `Promise<boolean>` opener would remove
   the most-repeated overlay boilerplate in every consuming app.
2. **Add an `etOverlayDescription` counterpart to `etOverlayTitle`.** `ariaDescribedBy` exists as config
   only (`overlay-config.ts:40`, forwarded at `overlay-manager.ts:125`/`:181`), so a consumer wanting a
   described dialog has to invent and thread an element id by hand - while `aria-labelledby` gets
   auto-wired for free by `overlay-title.directive.ts`. `role="alertdialog"` in particular is close to
   useless without a description, and the directive would be ~30 lines mirroring the title one.
3. **Let an open overlay be reconfigured, not just repositioned.** `OverlayRef` exposes
   `updatePositionStrategy` (`overlay-ref.ts:51`) but nothing for size, classes or `disableClose`; the
   strategy controller already has `applySizingStyles` and `applyClassChange`
   (`strategies/overlay-strategy-controller.ts:183-206`) and calls them on a breakpoint switch, so an
   `updateSizing(config)` / `updateClasses(config)` pair is mostly plumbing. The headless directive has
   the same gap from the other side: `mountOverlay()` snapshots every input once
   (`headless/overlay.directive.ts:196-227`), so changing `placement`, `offset` or `hasBackdrop` while
   open does nothing - worth either wiring through or documenting as mount-time-only.
4. **Drag-to-move / resize for dialogs.** PrimeNG and several others ship `draggable`/`resizable`
   dialogs, and the hard part is already written: `strategies/overlay-drag-to-dismiss.ts` has a complete,
   well-factored pointer gesture with axis abstraction, selection locking, scroll-parent arbitration and
   `touch-action` deference. A move gesture is that machinery with a two-axis `DismissAxis` and no
   dismiss threshold.
5. **A `snapPoints`-aware programmatic API.** Snap points are gesture-only today
   (`strategies/overlay-drag-to-dismiss.ts:125-176`); there is no way to open a sheet *at* `0.4`, read its
   current snap index, or move it from code. Exposing `snapTo(index)` and a `snapIndex` signal on the ref
   would make the feature usable for a "peek then expand" flow, which is the main reason bottom sheets
   have snap points.

#### DX (ranked)

1. **`strategies` is a bare factory-of-array with two silent failure modes.** It is typed
   `() => OverlayStrategyBreakpoint[]` (`overlay-config.ts:57`), so an array with no breakpoint-less entry
   crashes (High #1) and an array whose entries are out of order works only by accident of the `size`
   reduce. Either give `getHighestMatchedStrategy` a fallback to the smallest entry plus a dev-mode
   `RuntimeError` naming the missing base strategy, or change the public shape to
   `{ base: OverlayStrategy, breakpoints?: [...] }` so the base case is unmissable in the type.
2. **The two `hasBackdrop` layers and the two `origin` paths need one resolver each.**
   `resolveHasBackdrop` in the controller (`overlay-strategy-controller.ts:163-165`) and the container's
   inline copy (`overlay-container.component.ts:103`) disagree (Medium #1); `overlay-manager.ts:89-140`
   and `:142-205` resolve `origin` differently. Both belong in one exported helper the three call sites
   share - this is the same class of bug twice.
3. **No test driver for the overlay domain itself.** `libs/components/src/lib/testing/` has 20+ drivers,
   but `overlay-control-driver.ts` is scoped to *form controls* backed by an overlay (it extends
   `ControlDriverOptions` and defaults its trigger to `[role="combobox"]`). Driving a plain dialog, sheet,
   opener or overlay router means re-deriving `flushFrames`/`latestPane`/`resetOverlays` by hand - which
   is exactly what `overlay-strategy-controller.spec.ts:44-49` and the container spec each do
   separately. An `createOverlayDriver(fixture)` over the existing `driver-core.ts` primitives (open via
   manager or opener, `pane()`, `backdrop()`, `escape()`, `pointerDownOutside()`, `settle()`,
   `switchBreakpoint()`) would unblock most of the untested surface listed above.
4. **`FakeMatchMedia` should live in test-helpers, not in a spec.** The 40-line fake at
   `strategies/overlay-strategy-controller.spec.ts:10-42` is the only way to test a breakpoint switch, and
   any new strategy spec has to copy it. It belongs next to the existing jsdom shims in
   `libs/components/src/test-helpers.ts`.
5. **The overlay router's path semantics deserve a doc table or a stricter type.** `resolvePath`
   (`routing/overlay-router.ts:243-284`) supports four forms (`/abs`, `./replace`, `../back`, `forward`)
   plus an unobvious special case - an absolute navigate to `'/'` is always classified `'back'`
   (line 292) - and `navigate` also accepts `(string | number)[]`, which is `join('/')`-ed. None of that
   is in `overlays.md`; the docs only say "absolute or relative paths" (line 366).
6. **`OverlayBreakpointConfig.positionStrategy` takes `(origin?: HTMLElement)` while the config's `origin`
   is `HTMLElement | Event`.** The narrowing happens in the controller
   (`overlay-strategy-controller.ts:77-82`) and again, differently, in
   `getOriginCoordinatesAndDimensions` - a custom strategy author sees only the narrowed form and has no
   documented way to reach the original event.

#### Bundle size (ranked)

1. **Split the arrow and content-chrome CSS out of `overlay-container.component.css`.** The file is 386
   lines and every overlay in the app pays for all of it, including menus and tooltips. Two clean slices,
   per the "Splitting a large stylesheet" section of AGENTS.md: the arrow block (lines 137-246, ~110
   lines - `.et-overlay-arrow` plus the four `[data-overlay-placement]` variants) is dead unless
   `renderArrow()` is true, which is already a per-strategy opt-in (`arrow` on the breakpoint config), so
   it maps exactly onto the `stylesComponent` mechanism the strategies already use; and the
   header/body/footer/main chrome (lines 248-365, ~120 lines) is only live when
   `OVERLAY_CONTENT_IMPORTS` are used, so it could be mounted by `OverlayMainDirective` via
   `injectStyleManager().mount(...)` - the pattern `etTableVirtualScroll` already follows.
2. **Every `[etOverlay]` consumer bundles floating-ui's `size`, `arrow` and `hide` middleware even with
   all three features off.** `anchored.strategy.ts:69` calls `enableAnchoredOverlayPositionExtras()`
   unconditionally from `buildAnchoredRuntimePositionStrategy`, and that function statically references
   all three (`libs/core/src/lib/overlay/overlay-position-anchored-extras.ts:10`). The headless directive
   defaults `autoResize`, `autoHide` and `arrow` to `false`
   (`headless/overlay.directive.ts:61-66`), so the common popover case pays for middleware it never runs.
   Gating the call on `options.autoResize || options.autoHide || options.arrow || options.minAvailableSpace`
   would let the three shake out of a plain-popover app.
3. **The drag handle is a permanent DOM node and stylesheet slice for one strategy.**
   `overlay-container.component.html:1` renders `<div class="et-overlay-container-drag-handle">` into
   *every* overlay pane - dialogs, menus, tooltips - and the CSS (lines 270-284) hides it with
   `display: none` for all but the bottom sheet (lines 127-130). It should be `@if`-gated on the same
   signal that decides `renderArrow`, with its five `--_et-overlay-drag-handle-*` tokens moving into
   `sheet-styles.component.css` where the rest of the sheet CSS already lives.
4. **`fullscreen-animation.ts` is 770 lines reachable only from one strategy.** It is already isolated
   behind `injectFullscreenDialogStrategy`, but `strategies/index.ts:6` re-exports it and
   `overlay/index.ts:24` re-exports that, so the whole clone/transform machinery sits in the same graph
   as `overlay-config`. Dropping the `export * from './fullscreen-animation'` (nothing outside
   `full-screen.strategy.ts` imports it) would let it shake out for apps that never open a full-screen
   dialog.
5. **Two near-identical class-list normalizers.** `normalizeClassList` in `overlay-manager.ts:26-32`,
   `normalizeClassList` in `overlay-config-merger.ts:6-12` and `normalizeClasses` in
   `strategies/overlay-strategy-controller.ts:47-51` are the same six lines three times. Trivial, but it
   is the kind of duplication that lets the three paths drift (see DX #2).

#### UI/UX (ranked)

1. **Three of the four sheets are draggable with no visible affordance.** Top, left and right sheets all
   ship a `dragToDismiss` default (`top-sheet.strategy.ts:15-17`, `left-sheet.strategy.ts:15-17`,
   `right-sheet.strategy.ts:15-17`), but the drag handle is shown only for
   `.et-overlay--bottom-sheet` (`overlay-container.component.css:127-130`). A user has no way to know a
   right sheet can be swiped away. (That rule also sets `grid-template-rows` on the handle, which is not a
   grid - probably a stray line worth removing while touching it.)
2. **Drag-to-dismiss and snap points have no keyboard path at all.** The gesture is pointer-only
   (`strategies/overlay-drag-to-dismiss.ts`), and while Escape still dismisses, a sheet with
   `snapPoints: [0, 0.4, 0.7]` is unreachable by keyboard - a keyboard user cannot get to the 0.4
   position that the UI is designed around. Arrow keys on a focusable, `aria-valuenow`-carrying drag
   handle would close this, and would give the handle from #1 a reason to be a real control.
3. **No loading or error affordance for overlay content.** An overlay whose content resolves async has
   nothing to show meanwhile: the pane mounts, `applySizingStyles` gives it its final box, and the body
   is empty until data lands. The lib already has `skeleton`, `loader` and `empty-state` domains; a
   documented pattern (or an `et-overlay-body` `loading` state driving a skeleton) would stop every app
   inventing its own.
4. **The router outlet re-applies initial focus on every navigation, including a `back()`.**
   `routing/overlay-router-outlet.component.ts:152-166` focuses first-tabbable on the newly active page
   unconditionally. Returning to a page the user already visited should restore the element they left
   from, the way `restoreFocus` does for the overlay itself - otherwise a wizard's back button dumps focus
   at the top of the previous step every time.
5. **Sheet dismissal is direction-blind to reduced motion in one place.** The reduced-motion block in
   `strategies/sheet-styles.component.css:119-137` zeroes the transition, and
   `sheet-strategy-hooks.ts:21` skips the momentum handoff - but a sheet released mid-drag still animates
   through `settleAt`'s inline `transition` (`overlay-drag-to-dismiss.ts:297-300`), which only shortens
   the duration to 100ms under reduced motion rather than jumping. Minor, but it is the one path that
   ignores the stylesheet's own reduced-motion contract.
6. **Non-modal overlays get no `role` and therefore no accessible name.** `overlay-manager.ts:100`
   assigns `role` only when modal, so a `[etOverlay]` popover (default non-modal) is an unlabelled
   `<div>` to a screen reader even with `etOverlayTitle` inside it. Defaulting non-modal overlays to
   `role="dialog"`, or documenting `role` as required for non-modal, would fix the whole headless path.

#### Testing (ranked)

1. **Cover `overlay-opener.ts` first.** It is 282 lines with zero specs and it is the API the docs push
   everyone toward ("Almost no app code should reach for `overlayManager.open()`",
   `overlays.md:5-9`). The query-param branch especially: URL→open, external param change→model push,
   model write→URL, `beforeClosed` clearing the param, and the destroy path that produced Medium #4. All
   of it is testable with the router testing harness plus the existing overlay driver primitives.
2. **Add the strategy-controller edge cases the current spec skips.** The file has good coverage of the
   happy paths but nothing for: an all-breakpoints array (High #1), two overlays sharing a `documentClass`
   (Medium #2), `min*` sizing style composition (only `max*` is asserted, at line 119), and
   `removeClassesFromDocumentAndBody` after a switch.
3. **Test the content directives' contracts.** ET1206 (nested `etOverlayMain`), ET1208 (header/body/footer
   without a main) and the `etOverlayTitle` → `aria-labelledby` auto-wiring are all documented behaviour
   (`overlays.md:159`, `:429`) with no spec. These are cheap - a host component and one `expect` each -
   and they guard the error codes the docs page links to.
4. **`routing/overlay-router.ts` needs a pure-function spec for `resolvePath` and the direction
   resolution.** Both are pure and dense (four path forms plus the `'/'` special case; hint vs route-order
   vs navigate-config precedence at lines 341-370) and both are documented behaviour
   (`overlays.md:374`). No DOM, no TestBed needed.
5. **`fullscreen-animation.ts` deserves at least a state-machine spec.** 770 untested lines whose
   `startFullscreenLeaveAnimation` branches on four clone lifecycle states (`init`, `entering`,
   `entered`, other) and refcounts a `data-et-origin-hidden-count` attribute on a shared trigger element.
   The refcounting in particular (lines 69-101) is exactly the kind of logic that breaks silently when two
   overlays share an origin - and jsdom can assert the attribute without any layout.
6. **The overlay router outlet's focus behaviour is untestable today and worth making testable.**
   `focusActivePage` (`routing/overlay-router-outlet.component.ts:186-192`) runs inside a nested
   `afterNextRender` inside an `effect`; a driver exposing `navigateAndSettle()` would make both it and
   UI/UX #4 assertable.

---

## forms/select + forms/cascader

Scope: every non-spec source file under `libs/components/src/lib/forms/select` and
`libs/components/src/lib/forms/cascader` (`.ts`/`.html`/`.css`), their spec files, and
`apps/docs/components/select.md` + `apps/docs/components/cascader.md`. The working tree was clean at
review time (the cascader changes listed in the task prompt had already been committed as
`94e4ce81a` / `c11d719a5`).

Runtime verification used two throwaway specs (`__scan-verify.spec.ts` in
`forms/cascader/headless` and `forms/select/headless`), run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`, and both
were deleted afterwards. Observed output is quoted inline.

---

### High

- **A cascader in single mode keeps displaying the previous value's breadcrumb after the value is
  changed from outside - the docs promise the placeholder instead.** `path` is only ever written by
  `commit()` (`cascader.directive.ts:1207-1218`), by a successful `resolvePath` resolution
  (`cascader.directive.ts:531-554`), and by `clearValue()`. The reset effect at
  `cascader.directive.ts:435-460` clears `path` **only when the new value is `null`/`undefined`**,
  and the `toObservable(this.value)` pipe returns `EMPTY` when the data source has no `resolvePath`
  (`cascader.directive.ts:527-529`). So a form patch that swaps one non-null value for another
  leaves the trigger showing the old chain while `value` is something else -
  `apps/docs/components/cascader.md:44` states the opposite ("the trigger shows the placeholder
  until you re-open and re-pick"). Runtime-verified: after committing `world-final` and then
  `value.set('euro-group-a')` from the host, the observed output was
  `A -> value: euro-group-a | trigger shows: "World Cup / Final"`. A wrong label on a submitted form
  value is worse than a placeholder; the effect should also clear `path` when the value no longer
  matches `path.at(-1)`.

- **A cascader level that resolves out of order destroys the deeper columns, leaving `openPath`
  claiming a drill with no column behind it.** `setColumn` rebuilds the array as
  `columns.slice(0, columnIndex)` before writing the new state
  (`cascader.directive.ts:1284-1292`), i.e. *every* write to column *n* deletes columns *n+1…*. Both
  `resetBrowseState` (`cascader.directive.ts:1345-1353`) and `browseToPath`
  (`cascader.directive.ts:1166-1167`) start the root load **and** every committed/jumped-to level
  concurrently, and `cascaderFromQuery` runs each level as its own query
  (`cascader-from-query.ts:142-156`), so the completion order is whatever the network gives. If the
  root answers after the child, the child column is dropped. Runtime-verified with a source whose
  root promise resolves after the child promise, re-opening onto a committed branch:
  `D -> columns after child resolved: 2 | after root resolved: 1`. Only the truncation on an actual
  navigation is wanted, and `truncateColumns` (`cascader.directive.ts:1220-1229`) already does it -
  `setColumn` should preserve the tail.

- **In a search-enabled cascader, <kbd>Space</kbd> no longer activates the focused node - it types a
  space into the search box.** `handleNodeKeydown` treats every single-character key as search input
  and calls `event.preventDefault()` unconditionally when a search input is registered
  (`cascader.directive.ts:885-897`); `' '.length === 1`, so Space is captured. The nodes are native
  `<button>`s (`cascader.component.html:270`), whose activation is exactly what that
  `preventDefault()` suppresses. `apps/docs/components/cascader.md:229` documents "Enter / Space -
  Select the focused node (commit or drill)", and Space is the standard activation key for
  `role="treeitem"`. Enter still works (`'Enter'.length !== 1`). Runtime-verified with a source that
  has a `search` hook: `B -> defaultPrevented: true | query: " "`. The select's equivalent handler
  guards this case explicitly (`select.directive.ts:1019-1029`: Space is left to the search input
  only when the input actually holds focus).

### Medium

- **The cascader marks the field `touched` the moment the panel opens, so validation errors appear
  while the user is still choosing.** `CascaderTriggerDirective.handleBlur` sets `touched` with no
  guard (`cascader-trigger.directive.ts:74-77`), and the cascader panel deliberately takes DOM focus
  on open (`cascader.directive.ts:345-384`), which blurs the trigger. The select's trigger has the
  guard the cascader is missing - `if (!this.select?.open()) { ...touched.set(true) }`
  (`select-trigger.directive.ts:125-131`, comment: "focus moving into the panel is not 'leaving the
  field'"). Runtime-verified: after `driver.open()` and a `blur` on the trigger,
  `C -> touched while open: true` (it is `false` before the blur).

- **A cascader cannot be labelled without a projected `<et-label>`: it exposes no `aria-label` /
  `aria-labelledby`, so the field's dev-time labelling guard throws for a control that *is*
  labelled.** `FormFieldDirective` accepts a control-supplied name only through the optional
  `hasCustomAccessibleName` member (`form-field/headless/form-field.directive.ts:206`,
  `form-field.tokens.ts:76`), which `SelectDirective` implements
  (`select.directive.ts:168-169, 242`) and `CascaderDirective` does not - its trigger only ever
  reads `cascader?.labelId()` (`cascader-trigger.directive.ts:20`). A cascader named by a shared
  caption outside its field therefore throws ET2201 in dev mode. The select's own JSDoc
  (`select.directive.ts:162-167`) describes this as the exact scenario the inputs exist for; the two
  siblings should not disagree.

- **A select's panel filter stays frozen at the last query after any close that still had one, and
  the closed-panel typeahead then only matches inside that stale filter.** `panelFilterQuery`
  freezes while `open()` is false (`select.directive.ts:407-410`), and the close-time query clear in
  `handlePanelBeforeClosed` (`select.directive.ts:1359-1363`) runs *after* `open` has already been
  set to `false` on every interactive close (`anchored-panel-controller.ts:100-106` sets
  `open` first, `select.directive.ts:752-758` likewise) - so the freeze captures the old query
  instead of the cleared one. `enabledItems` -> `visibleItems` feeds `findTypeaheadMatch`
  (`select.directive.ts:1228-1232`), which `handleClosedKeydown` uses for the native-`<select>`-style
  commit documented at `apps/docs/components/select.md:355`. Runtime-verified: after typing `gr` and
  closing with <kbd>Tab</kbd>, `query after close: "" | panelFilterQuery: "gr" | visibleItems: [
  'Grape' ]`, and a following `e` keypress committed nothing (`closed typeahead "e" committed: null`)
  even though `Elderberry` is an option. The <kbd>Escape</kbd>-<kbd>Escape</kbd> path is unaffected
  (the first Escape clears the query while still open).

- **A keyboard-only user cannot page an async select: the load-more control is not reachable.** The
  load-more button carries `tabindex="-1"` (`select.component.html:196`), the panel never receives
  DOM focus by design (`select.directive.ts:304-306`, `autoFocus: false`), <kbd>Tab</kbd> closes the
  panel (`select.directive.ts:1036-1041`) and arrow navigation deliberately does not wrap
  (`select.directive.ts:1257-1262`), so virtual focus simply stops at the last loaded option. Nothing
  else triggers `requestLoadMore()`. The add-new row has the same `tabindex="-1"`
  (`select.component.html:208`) but the template comment and
  `apps/docs/components/select.md:238-249` at least call that flow pointer-only; the load-more
  section (`select.md:197-219`) documents no such limitation, and unlike add-new there is no
  consumer-side alternative - the remaining pages are unreachable. Code-verified only (needs real
  focus/Tab semantics to demonstrate end-to-end).

- **Rebinding `[etSelectOptions]` half-applies: the query/load-more plumbing follows the new bundle,
  the async state does not.** `SelectOptionsDirective` pushes the bundle into the select once from
  `ngOnInit` (`select-options.directive.ts:75-79`) while the `queryChange`/`loadMore` subscriptions
  read `this.bundle()` on every emission (`select-options.directive.ts:47-59`). Swapping the bound
  bundle (a `@switch`-ed source, a bundle recreated per parent selection) therefore leaves
  `loading`/`error`/`hasMoreItems` wired to the dead bundle while queries drive the new one. The
  comment says a one-time push is enough because the factory bundle is a field initializer - true for
  the documented usage, but the input is public and its change is silently ignored. An `effect`
  mirroring `this.bundle()` into `asyncOptions` would cost nothing.

- **`cascaderFromQuery` reports "No matches" for a query that was never sent.** Below
  `minQueryLength` the `search` hook returns `[]` (`cascader-from-query.ts:163-168`), but
  `isSearching()` is already true for any non-blank query (`cascader.directive.ts:285`), so the panel
  swaps the columns for the flat result list and `searchState` settles as
  `{ status: 'loaded', results: [] }` -> the empty row at `cascader.component.html:225`. With
  `minQueryLength: 3` the first two characters therefore read as "nothing found" rather than "keep
  typing". Code-verified only.

### Low

- **`CascaderNodeSignal` is a dead public export.** Declared at
  `cascader.directive.ts:1392`, re-exported through `headless/index.ts` -> `cascader/index.ts`, and
  referenced nowhere in `libs/` or `apps/`.

- **Two cascader directives inject `DestroyRef` only to discard it.**
  `cascader-node.directive.ts:37` + `:102` (`void this.destroyRef;`) and
  `cascader-column.directive.ts:21` + `:39`. The comment above the latter ("a keydown that bubbled up
  from a node without being handled (rare) is ignored here") describes code that does not exist in
  the file - it is not one of the four allowed comment cases in AGENTS.md.

- **Stale comment on the cascader trigger's Escape case.**
  `cascader-trigger.directive.ts:97-99` says Escape is "handled by the overlay runtime while open",
  but the panel config sets `closeOnEscape: false` and `handlePanelKeydown` owns Escape via the
  controller's document listener (`cascader.directive.ts:324-326, 1302-1323`).

- **Neither domain uses `:where()` for its config modifiers, unlike the rest of the library.**
  `select.component.css:30,34,111,119-120`, `select-option.component.css:39`,
  `cascader.component.css:22,27,39,46`, `cascader-panel.component.css:281,322,529,534` all attach
  `[data-disabled]` / `[data-readonly]` / `[data-placeholder]` / `[data-mixed]` / `[data-selected]`
  bare, so they outweigh the base rule and source order stops deciding. `:where([data-…])` is the
  documented pattern (AGENTS.md "Component styling") and is used by `button` (17 occurrences),
  `chip`, `card`, `calendar`, `tree`, `pagination`, the form-field shells and others; select and
  cascader have zero. Both files are correctly wrapped in `@layer components` and use no hardcoded
  colour as a primary value (every literal is a `var(--et-…, fallback)` fallback; the panel
  `box-shadow` literals match every other panel in the lib).

- **`apps/docs/components/select.md:70` promises chip keyboard removal that cannot happen inside a
  select.** "a chip's remove button (or Backspace/Delete on a chip) deselects that value" -
  `ChipDirective` does bind `keydown.backspace`/`keydown.delete` (`chip/headless/chip.directive.ts:10-11`),
  but neither the chip host nor its remove button is focusable in this context (`tabindex="-1"` on
  the remove button, no tabindex on the host), which the same page states correctly at line 362.
  In a select the reachable path is Backspace on the empty search input
  (`select-search.directive.ts:269-294`).

- **Doc gaps in the cascader Options table** (`cascader.md:135-148`): unlike the select page, it never
  mentions the standard form-field contract inputs it forwards (`disabled`, `readonly`, `invalid`,
  `errors`, `required`, `name`, `touched`, `open` - all in the `hostDirectives` list at
  `cascader.component.ts:54-75`), and `clearable`, `clearLabel` and `backLabel`
  (`cascader.component.ts:92-94`) are undocumented (`backLabel` only appears in footnote ¹).
  `clearable` (`select.component.ts:100`) is likewise absent from the select page. Line 151 calls
  `path` a computed - it is a public `WritableSignal` (`cascader.directive.ts:214`).

- **`deselectOption(item)` is public API with no documentation** (`select.directive.ts:872-879`); it
  appears only in an old CHANGELOG entry and is used nowhere in the repo, while the documented path
  is `deselectValue`.

- **`selectOptionsFromQuery`'s JSDoc states the pagination contract twice** in near-identical wording
  (`select-options-from-query.ts:104-106` and `:111-115`).

### Spec coverage

Well covered (behaviour-level, through the shared drivers):

- `select.directive.ts` - 1607 lines of spec across single/multi/search/custom-value/mixed/pickOnly
  suites, including the mixed-state contract, `maxSelection` (incl. zero), separator commits, paste
  splitting, `commitCustomValueOnClose`, the three loading presentations, pointer-vs-keyboard active
  source, and the searchable custom-value-template edit mode.
- Data-driven options / virtualization (`select-virtual-options.spec.ts`): window slicing, paddings,
  the unwindowed short list, keyboard nav across the full data set, in-place item updates,
  `etSelectOptionTemplate`.
- `select-options.directive.ts`, `select-option-group.directive.ts`, the nested-overlay case,
  `selectOptionsFromQuery` / `selectOptionsFromV2Query` (incl. every `endsPagination` branch).
- `cascader.directive.ts` - browse/drill/commit/truncate, roving focus, multi mode with
  indeterminate + ancestor promotion, deep nesting and breadcrumb window behaviour, flat search
  (results, branch-only re-root, Escape, focus cycling, error+retry, empty), async promise source,
  both mixed-state contracts. Plus `cascader-tree.ts` and `cascaderFromQuery`.

Real logic with **zero** tests:

- `CascaderPanelComponent` entirely: `isSheet()` and the whole bottom-sheet branch of
  `cascader.component.html` (`sheetBrowse`, the header/title animation, `goBack()`,
  `titleAnimation`), the `role` swap tree<->listbox, the `panelId` set/clear lifecycle, and
  `focusin`/`focusout` -> `focusInside`.
- `retryColumn()` (the search retry *is* tested, the column retry only renders its button).
- Single-mode `resolvePath` (only the `multiple` variant is tested) - which is precisely the gap that
  let High #1 through, since the docs' promise for that path is never asserted.
- `SelectViewportDirective`'s width-floor logic (`locksWidth`/`widthFloor`/`minInlineSize`).
- `select-labels.ts` / `cascader-labels.ts` provider+inject functions (no spec references
  `provideSelectLabels` / `provideCascaderLabels`).
- `SelectPanelComponent` / `SelectOptionGroupComponent` are only exercised incidentally through the
  directive specs.

No existing spec asserts a behaviour I believe to be wrong.

---

Clean: the async-panel controller wiring (`createAnchoredPanelController`) is leak-free for both
domains - document `pointerdown`/`focusin`/`keydown` listeners are detached on `beforeClosed` and on
destroy, and `createVirtualWindow` / `createTypeahead` both unsubscribe via `takeUntilDestroyed` /
`destroy()` called from `DestroyRef.onDestroy`. Every RxJS pipe in both directives ends with
`takeUntilDestroyed()` and none subscribe-and-assign; synchronous state is signals throughout, and
both controls are `FormValueControl` implementations (no `ControlValueAccessor` anywhere). The
`options`-reconciliation effect correctly reuses items, prunes the registry, and drops the active /
pending-scroll references for removed entries; the label cache prunes to the selected values only.
The select's ARIA hand-off between trigger and inline search input is complete and consistent
(`role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-required`, `aria-invalid`,
`aria-describedby` all move to the input, the trigger drops them), listbox extras correctly live
outside the `role="listbox"` element, and the mixed-state masking is applied pull-side
(`isValueSelected`) so no option ever reports `aria-selected="mixed"`. `maxSelection` disabling,
`pickOnly`, custom values, separators and paste splitting all match the documented behaviour. Both
CSS trees are wrapped in a single `@layer components`, contain no Tailwind, and every documented
design-token default matches its `@property initial-value` (`40vh`, `6px`, `36px`, `10px`, `8px`,
`6px`, `14px`, `16px`, `12px`, `220px`, `320px`, `36px`), as does the content-width cap
`min(400px, 100vw - 24px)` documented at select.md:44. The `!important` transforms in both panel
stylesheets are scoped to the overlay's own animation classes. `endsPagination` is shared correctly
by both query factories, and `cascaderFromQuery` destroys each per-level query in `finalize`.

### Improvements

Ideas, not verified defects. Ranked within each category.

#### Features

1. **Give the select a `compareWith`, like the cascader already has.** `isValueSelected` /
   `selectedEntries` compare with `===` and `Array.includes` (`select.directive.ts:734-742, 544`),
   so object values only work if the consumer re-binds the identical instances -
   `apps/docs/components/select.md:64` has to document that as a caveat. The cascader solved the same
   problem with a `compareWith` input (`cascader.directive.ts:111`, `defaultCompareWith` in
   `internals/cascader-tree.ts:63`), Material's `mat-select` ships it, and the select's comparison is
   funnelled through few enough places (`isValueSelected`, `effectiveValues`, `selectedEntries`,
   `commitOption`, `deselectValue`) to retrofit cleanly.
2. **Ship a "Select all" row for multi selects - the machinery is already built and unused.**
   `createSelectionState` returns `allSelected`, `someSelected` and `toggleAll`
   (`selection-list/headless/internals/selection-state.ts:206-241`), the select creates the state
   (`select.directive.ts:276-280`) and then never reads any of the three; the selection list drives
   the same helper from a control directive
   (`selection-list/headless/selection-list-control.directive.ts:38`). A `selectAll` input rendering a
   tri-state row above the listbox is close to free and is table stakes for filter-bar selects.
3. **Let data-driven options carry a group.** Option groups only wrap *projected* options
   (`select-option-group.directive.ts`), which `apps/docs/components/select.md:332` has to call out as
   a limitation - so the moment a list is long enough to want `options`/virtualization it loses its
   sections. A `group?: string` on `SelectOptionData` (`select.tokens.ts:8-12`) plus group headers as
   windowed rows would make the two features compose.
4. **Virtualize cascader columns by reusing the select's window.** A column renders every node with a
   plain `@for` (`cascader.component.html:269`) - a 2000-player level renders 2000 buttons - while
   `internals/virtual-window.ts` already provides exactly the uniform-row windowing the select uses
   (`select.directive.ts:448-468`) and `--et-cascader-node-height` is a fixed token
   (`cascader-panel.component.css:17-20`). One `createVirtualWindow` per visible column would drop the
   worst cascader case to a constant.
5. **Add a cascade check strategy to cascader multi mode.** `toggleValue` only ever toggles the one
   node (`cascader.directive.ts:739-775`); `isFullySelected` (`:1104-1121`) *reads* whole-branch
   selection but nothing can *produce* it in one gesture. A `checkStrategy: 'node' | 'branch'` input
   that toggles the loaded subtree is the defining feature of the Ant Design / PrimeNG cascader and
   the natural completion of the indeterminate/promotion display that already exists.
6. **Page a long cascader level.** The select has `hasMoreItems`/`loadMore`/`loadingMore`
   (`select.directive.ts:149-150, 396-400, 845-854`); a cascader column has only
   `loading | loaded | error` (`cascader.tokens.ts:4-11`), so a level with thousands of children must
   arrive in one response. Extending `CascaderColumnState` with `hasMore` plus a
   `loadChildren(parent, page)` overload would bring the two siblings level.

#### DX

1. **Make `et-select` and `et-cascader` generic over their value type.** `SelectComponent` has no type
   parameter and `SelectDirective.value` is `model<unknown | unknown[] | null>`
   (`select.directive.ts:99`); `CascaderDirective<T>` *is* generic but `CascaderComponent` erases it
   (`cascader.component.ts:88`, `inject<CascaderDirective>` with no argument), so `(pickOption)` and
   `(valueChange)` hand the consumer `unknown` and every template does a cast. Threading `T` through
   the two components (and `SelectItem<T>`, which is already parameterized) removes the most common
   friction in both APIs.
2. **Drop the cascader's structural stand-in types and import the real directives.**
   `CascaderSurfaceLike` / `CascaderTriggerLike` / `CascaderSearchLike`
   (`cascader.directive.ts:58-65`) mean `registeredTrigger()` hands a headless consumer
   `{ elementRef }` and `registeredSearch()` a four-method shape, while the select registers the real
   classes (`select.directive.ts:38-45`, `registeredSearch: signal<SelectSearchDirective | null>`).
   The cascader's sub-directives already import the directive, so the cycle the stand-ins avoid can be
   broken the same way the select does it.
3. **Add `aria-label` / `aria-labelledby` (+ `hasCustomAccessibleName`) to the cascader.** See the
   Medium finding: it is a one-line parity fix (`select.directive.ts:162-169, 242`) that turns a
   dev-mode ET2201 throw into a supported labelling path.
4. **Retire the `etSelectOptionTemplate [options]` type witness.** The directive documents an input
   that exists only to carry a type and is "never read"
   (`select-option-template.directive.ts:35-36`), and the docs have to explain the trick
   (`select.md:318-326`). A generic `et-select` (DX #1) or a `selectOptions<T>(...)` identity helper
   would let `let-option` infer without the consumer binding the same array twice.
5. **Make the cascader's missing-`dataSource` failure survivable.** `loadColumn` throws
   `MISSING_DATA_SOURCE` from inside the mount path in dev
   (`cascader.directive.ts:1231-1244`), i.e. from within an effect during overlay mount, which
   surfaces as an Angular error with the panel half-open. Rendering the column's existing error row
   with that message would be both friendlier and consistent with how every other load failure is
   reported.

#### Bundle size

1. **Split the async/action slice out of `select-panel.component.css`.** Lines 119-264 (busy bar and
   its `et-select-busy-sweep` keyframes, the state rows, load-more and add-new) are ~145 of the file's
   278 lines and apply only to a select that is loading, erroring, paging or offering add-new - a
   plain client-side select ships them for nothing. This is the textbook case for the styles-only
   component pattern in AGENTS.md: mount from `SelectDirective` the first time
   `loading()`/`error()`/`hasMoreItems()`/`allowAddNew()`/`asyncOptions()` turns on, exactly as
   `etTableVirtualScroll` mounts `TableVirtualScrollStylesComponent`.
2. **Move the sheet chrome out of `cascader-panel.component.css` into the sheet styles component that
   already exists.** `CascaderSheetStylesComponent` is mounted on demand below `md`
   (`cascader-panel.component.ts:69-76`, 63 lines of CSS), yet the sheet header, Back bar and the
   whole title cross-slide animation live in the always-loaded panel sheet
   (`cascader-panel.component.css:108-215`, plus the `[data-sheet]` rules at `:368-446`) - roughly
   200 of its 750 lines that a desktop-only app never uses.
3. **Second split candidate: the cascader breadcrumb block.**
   `cascader-panel.component.css:217-294` only ever applies once a drill overflows
   `maxVisibleColumns`, and the template already gates the row behind
   `@if (cascader.breadcrumbPath().length)` (`cascader.component.html:84`) - a natural mount point for
   a `CascaderBreadcrumbStylesComponent`.
4. **De-duplicate the two panel enter/leave animation blocks.**
   `select-panel.component.css:14-65` and `cascader-panel.component.css:22-75` are the same
   placement-aware overlay transition with different class names, and both re-declare the
   reduced-motion override. A shared anchored-panel animation stylesheet (or a shared class the
   overlay strategy already applies) would remove one copy and keep the two panels from drifting.
5. **`cascaderFromQuery` and `selectOptionsFromQuery` duplicate their error mapping.**
   `firstErrorMessage` is written twice, character for character
   (`cascader-from-query.ts:61-65`, `select-options-from-query.ts:66-70`, and a third variant in
   `select-options-from-v2-query.ts`). Sharing it the way `select-options-paging.ts` is already shared
   between the two select factories saves a little code and one drift risk.

#### UI/UX

1. **Reach the next page from the keyboard.** Beyond the Medium defect, the fix that fits the existing
   model is to have `moveActive(1)` past the last option call `requestLoadMore()`
   (`select.directive.ts:1234-1263`, `:845-854`) - the same "arrow into the next page" behaviour
   Material and PrimeNG use - and/or auto-load when the viewport nears its end, which is cheap because
   `createVirtualWindow` already tracks the live scroll offset (`internals/virtual-window.ts:96-113`).
2. **Give the select panel the themed scrollbar the cascader just got.** `SelectPanelComponent`
   scrolls a bare `.et-select-panel-scroller` (`select-panel.component.ts:14-22`, no `et-scrollbar`
   anywhere in the domain) while the cascader wraps its columns, results and sheet area in
   `<et-scrollbar autoHide>` (`cascader.component.html:169, 231, 287`) as of the recent retrofit -
   two sibling panels with visibly different scrollbars.
3. **Collapse overflowing multi-select chips.** Every selected value becomes a chip
   (`select.component.html:20-30`) and the docs accept that "the chips row wraps, growing the field"
   (`select.md:70`); with twenty selections the field swallows the form. A `maxVisibleChips` with a
   "+n more" chip (PrimeNG's `maxSelectedLabels`, Material's `selectedItemsLabel`) keeps the field a
   fixed height.
4. **Keep per-column typeahead alive when a cascader search exists.** Today registering a search
   input replaces column typeahead wholesale (`cascader.directive.ts:889-897`) - which is also what
   breaks Space (High #3). Routing only characters that are not Space, and only when the query is
   empty, into the search box would keep both affordances.
5. **Make the cascader panel's inner buttons roving, not tab stops.** The breadcrumb buttons
   (`cascader.component.html:92`) and retry buttons (`:194, :262`) are natively focusable inside a
   non-modal pane that lives at the end of `<body>`, so Tab from a node walks the crumbs and then
   leaves the pane and closes it. `tabindex="-1"` plus keyboard access through the existing roving
   model (`showColumn`, ArrowLeft) matches the tree pattern the panel claims.
6. **Template the multi-select chips.** The panel rows can be fully templated
   (`etSelectOptionTemplate`, `etSelectValue`) but a chip is always plain text
   (`select.component.html:27`), so a country select shows a flag in the list and a bare name in the
   field. An `etSelectChip` template with the `SelectSelectedEntry` as context closes the gap.
7. **Highlight the matched substring in cascader search results.** Each result renders its full
   ancestor chain plus the label (`cascader.component.html:213-221`) with no indication of *why* it
   matched; the query is right there on the directive (`searchQuery()`), and marking the match is the
   convention for flat-search-over-a-tree.

#### Testing

1. **Add a breakpoint harness so the cascader's bottom sheet can be tested at all.** `isSheet` comes
   from `injectObserveBreakpoint({ max: 'sm' })` (`cascader-panel.component.ts:61`) and no spec can
   currently force it, which is why the entire sheet branch - `goBack()`, the Back bar, the title
   cross-slide, `titleAnimation`, the sheet column area - has zero coverage. A providable fake
   breakpoint observer (or a `mountCascader(..., { sheet: true })` option on the existing driver,
   `forms/testing/cascader-driver.ts`) unlocks a whole presentation.
2. **Write a shared overlay-control contract describe-block.**
   `forms/testing/mixed-state-contract.ts` is the precedent: a contract suite every control runs. A
   sibling `describeOverlayControlContract` asserting touched-on-blur-but-not-on-panel-open,
   Escape-then-close, outside-pointer close, focus return and `expanded()` would have caught the
   cascader `touched` divergence (Medium) mechanically, and would pin the two panels to one behaviour.
3. **Cover the async ordering that High #2 exposes.** A regression spec with a data source whose root
   level resolves after a child level - the pattern `cascaderFromQuery` produces
   (`cascader-from-query.ts:142-156`) - plus single-mode `resolvePath` (only the `multiple` variant is
   tested today) protects the two most consequential bugs found in this pass.
4. **Cover the select's viewport width floor.** `SelectViewportDirective`'s
   `locksWidth`/`widthFloor`/`minInlineSize` interaction (`select-viewport.directive.ts:38-65`) is
   subtle, documented as a guarantee (`select.md:331`), and untested; `signalElementDimensions` can be
   driven in jsdom by writing the element's box, as other specs do.
5. **Assert the two label sets.** No spec references `provideSelectLabels` or
   `provideCascaderLabels` (`select-labels.ts`, `cascader-labels.ts`), so a renamed key or a lost
   fallback in the panel's own strings (loading, empty, load-more, add-new, create, retry, back,
   search) would ship silently.

---

## Table (`libs/components/src/lib/table`)

Scope: every non-spec `.ts` / `.html` / `.css` in `libs/components/src/lib/table` and
`libs/components/src/lib/table/headless` (≈14 k lines), the spec files, and
`apps/docs/components/table.md`.

Runtime verification used a scratch spec (`__scan-verify.spec.ts`, since deleted) run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts …`. The working
tree was left exactly as found (`git status --porcelain libs/components/src/lib/table` → empty).

---

## High

- **`etTableReorder`'s edge auto-scroll `requestAnimationFrame` loop outlives the table's
  destruction and never stops.** `syncAutoScroll` starts `stepAutoScroll`
  (`table-reorder.directive.ts:251`), which re-queues itself every frame
  (`table-reorder.directive.ts:270`) and is only stopped from `end()` / `cancel()`
  (`table-reorder.directive.ts:197`, `:187`). Those are driven by `dragGestureFrom` through
  `takeUntilDestroyed()` (`table-reorder.directive.ts:140`), and an unsubscribed observable emits
  nothing — so if the table is destroyed while a drag is held in the edge zone (a route change, an
  `@if` flipping, a refetch that swaps the component), no `end`/`cancel` ever arrives and
  `stopAutoScroll` is never called. There is no `DestroyRef.onDestroy` anywhere in the file. The
  loop then keeps writing `scrollLeft` on a detached element and calling `resolveDropTarget` /
  `previewLandingOrder` into the destroyed table forever, retaining the directive, the table and
  every cell element it touches.
  *Runtime-verified*: with a manual rAF queue, after `fixture.destroy()` the queue still held a
  frame and every step re-queued another — 5/5 stepped, `still queued: 1`, and `scrollLeft` kept
  moving (`-14.8` → `-88.7`) on the detached host.

- **A hand-rolled `rowsSource` that has `setSort`/`setFilters` but no `sort`/`filters` signal
  leaves the sort and filter UI permanently stuck, silently.** `applySort`
  (`table.component.ts:1929-1937`) hands the sort to `source.setSort(...)` and **returns without
  writing `this.sort`**; the value only comes back through the mirror effect
  (`table.component.ts:1166-1178`), which reads `source.sort?.()` and does nothing when the source
  publishes none. `setFilterValues` (`table.component.ts:1606-1614`) is the same shape. Since
  `TableRowsSource.sort` / `.filters` are optional (`headless/table-rows-source.ts:43-49`) and the
  docs state outright that "a hand-rolled object works too"
  (`apps/docs/components/table.md:675`), this is a supported configuration.
  *Runtime-verified*: a source with only `rows` + `setSort`, clicking the sortable header →
  `setSort` called with `[{key:'name',direction:'asc'}]`, but `table.sort()` stayed `[]`,
  `aria-sort` stayed `"none"`, and the **second** click asked for `asc` again — the column can
  never reach descending or be cleared, and `state()` never records the sort either.

- **A stored or linked table state crashes `restoreState` instead of "degrading to no restore",
  which is the opposite of what the code and the docs promise.** `deserializeTableState`
  (`headless/table-state-url.ts:20-40`) validates only `v ∈ {1,2,3}` and `Array.isArray(columns)`
  and then casts; its own JSDoc says a "stale or hand-edited link degrades to 'no restore' instead
  of throwing" (`headless/table-state-url.ts:16-19`), and the docs repeat it
  (`apps/docs/components/table.md:1770`). `restoreState` then does
  `next.columns.map((column) => ({ key: column.key, … }))` (`table.component.ts:1512`) and throws
  on any non-object entry. The persistence directive calls it un-guarded from `afterNextRender`
  (`headless/table-state-persistence.directive.ts:62-64`) — `createTableStateStorage.load()`'s
  `try/catch` (`headless/table-state-storage.ts:63-68`) only covers the parse, not the restore —
  so one hand-edited `localStorage` value (or a shared URL) hard-fails the table's first render,
  leaving `restoredColumns` already mutated and the rest of the restore skipped.
  *Runtime-verified*: `deserializeTableState('{"v":3,"columns":[null]}')` returned the object
  unchanged; `restoreState({v:3,columns:[null]})` threw
  `TypeError: Cannot read properties of null (reading 'key')`.

## Medium

- **`etTablePageStickyHeader` breaks the ARIA grid structure the docs promise.** In that layout the
  host takes `role="grid"` (`table.component.ts:254`) and the two grids become `role="rowgroup"`,
  but they sit behind role-less wrappers: `div.et-table-header-strip` → `div.et-table-header
  [role=rowgroup]` and `div.et-table-scroller` → `div.et-table [role=rowgroup]`
  (`table.component.html:381-396`). A `grid` must own `row`/`rowgroup` children; with generic divs
  in between the grid has no rows in the accessibility tree. The regular layout is correct
  (`role="grid"` directly on `.et-table`, `table.component.html:398`), so the two layouts disagree,
  and `apps/docs/components/table.md:1855-1858` documents only the correct one.
  *Code-verified only* (needs a real AT / accessibility-tree dump).

- **`rowInteractive` + `etTableKeyboardNav`: `Enter` on a focused cell emits `rowClick` on top of
  whatever the key was meant to do.** The row carries `(keydown.enter)="activateRow(...)"`
  (`table.component.html:182`) and the nav directive listens on the table host
  (`table-keyboard-nav.directive.ts:52`), so the row's handler always runs first (bubbling
  cell → row → host). `originatesFromInteractive` (`table.component.ts:1947-1962`) walks from the
  event target — the *cell*, a plain `div` — so it never bails, and `rowClick` fires before
  `handleKeydown` decides between `editCell` and `drillInto`
  (`table-keyboard-nav.directive.ts:177-184`). The directive's own comment claims the row handler
  only sees the event "when the cell has nothing focusable in it"
  (`table-keyboard-nav.directive.ts:179-181`), and the docs describe `Enter` purely as "into the
  cell's own control" (`apps/docs/components/table.md:1562`, `:1590`).
  *Runtime-verified*: `Enter` on the cell holding a `<button>` produced `rowClick emissions: 1`.

- **Binding any serializer option on `etTableCsvExport` makes every later `export({ file })` throw
  `ET3507`.** `export()` merges the bound config under the per-call overrides
  (`table-csv-export.directive.ts:83`), and `assertFileOptions`
  (`headless/table-csv-export.ts:293-304`) rejects `file` whenever `rows|columns|header|delimiter|
  formulaGuard|bom` is merely *present*. The docs advise exactly the combination that breaks —
  "set `bom: false` on the directive and be done with it" (`apps/docs/components/table.md:1428`),
  and `delimiter: ';'` is the documented Excel-locale fix — while also stating the directive's
  config is just "the defaults every `export()` call starts from"
  (`headless/table-csv-export.ts:14`, `apps/docs/components/table.md:1391`). The assert should look
  at what the *call* passed, not at the merged object.
  *Runtime-verified*: `[etTableCsvExport]="{ bom: false }"` + `csv.export({ file: of('a,b') })`
  threw `ET3507: … was given \`file\` together with \`bom\``.

- **The selection and expansion state slices write `"[object Object]"` for a table without a
  `rowKey`, contradicting their own comments and the docs.** Both `read()`s do
  `keys.map(String)` unconditionally (`table-selection.directive.ts:113-116`,
  `table-row-expansion.directive.ts:98-101`) while the comment right above each claims "a table
  without a `rowKey` … has nothing stable to write, so it contributes nothing"
  (`table-selection.directive.ts:108-110`, `table-row-expansion.directive.ts:94-95`); the docs say
  the same ("set a `rowKey` for them to be captured at all",
  `apps/docs/components/table.md:1733`). The junk then lands in `localStorage` / a shared URL and
  restores to a `Set` that matches nothing.
  *Runtime-verified*: `state().features` → `{"selection":["[object Object]"]}`, and after a
  round-trip through `restoreState` the selection was empty (`selectedRows().length: 0`) while the
  stored payload stayed polluted.

- **A cancelled resize drag leaves a width override behind, turning a flexible column rigid.**
  `cancel()` calls `setColumnWidth(key, startWidth)` (`table-resize.directive.ts:76`) rather than
  `resetColumnWidth`. `startWidth` is the *rendered* width (`:54`), so a column that had no
  override before the drag now has one: it stops sharing leftover space, `state()` records a
  `width`, and the column menu's "Reset width" appears
  (`hasColumnWidthOverride`, `table.component.ts:1593`). The doc comment says the cancel puts the
  column "back to the width it was grabbed at" — which is true in pixels and wrong in behaviour.
  *Code-verified only.*

- **`etTableCellErrorTooltip`'s mark is a tab stop inside the grid body, breaking the single-tab-stop
  promise.** `TableCellErrorMarkComponent` renders `[attr.tabindex]="message() ? 0 : null"`
  (`table-cell-error-mark.component.ts:28`). With `etTableKeyboardNav` on, the table renders every
  body cell at `tabindex="-1"` and the feature places exactly one `0`
  (`table-keyboard-nav.directive.ts:255-263`, `headless/table-features.ts:256-262`) — so every
  errored cell adds another Tab stop, which is what the base table's own mark deliberately avoids
  (`table.component.html:239-246`, no tabindex). The docs promise "the body becomes a **single tab
  stop**" (`apps/docs/components/table.md:1554`). The mark is also an `<i>` with `aria-label` and no
  `role`, which is not reliably announced.
  *Code-verified only.*

- **`etTableStatePersistence`'s `enabled` can never turn persistence *on* after the first render.**
  The restore runs once from `afterNextRender` and bails when `enabled` is false at that moment
  (`headless/table-state-persistence.directive.ts:58-67`); nothing re-attempts it. The saving effect
  has no such gate (`:71-85`), so flipping `enabled` on later starts *overwriting* the stored setup
  with the table's current one without ever having read it — the directive's own example advertises
  the runtime switch (`headless/table-state-persistence.directive.ts:26`,
  `apps/docs/components/table.md:1750`).
  *Code-verified only.*

- **Column resizing moves the wrong way in RTL.** `update()` adds the pointer's raw `totalDx` to the
  start width (`table-resize.directive.ts:63`), so in an RTL table dragging the trailing-edge grip
  *inward* widens the column. Every other measurement in the domain is direction-aware — the table
  explicitly handles RTL `scrollLeft` (`table.component.ts:1192-1194`) and the CSS is entirely
  logical-property based — so this is the one gesture that isn't.
  *Code-verified only* (needs a real RTL layout).

## Low

- **Three `{@link exportTableToCsv}` references point at a symbol that does not exist** (renamed to
  `injectTableCsvExport`): `table.imports.ts:71`,
  `headless/table-csv-export.ts:76` and `:204`. Nothing in `libs/components/src` or `apps/docs`
  exports or defines that name.

- **An orphaned JSDoc block documents nothing.** `table.component.ts:90-98` ("The rendered shape of
  the table…") is immediately followed by a second `/** … */` for `TableLeadCellVm`
  (`table.component.ts:99`), so only the second one attaches. The prose is also pure rationale for a
  mechanical choice, which the comment policy lists under "always delete".

- **A banned section header, in the wrong place.** `// ── Render models ───` plus its two-line
  restatement sits at `table.component.ts:1940-1942` — directly above
  `originatesFromInteractive`, which is not a render model (the `…Vm` types are at the top of the
  file). Section dividers are explicitly on the always-delete list.

- **Migration narration in `table-errors.ts:1-3`** ("3500 is retired: it was a duplicate-column-key
  check…") — history, which git already has.

- **Comment volume far above the repo policy.** 2 847 of 8 371 lines (34 %) in the domain's
  non-spec TypeScript are comment lines. A large share is legitimate public-API JSDoc (case 4), but
  much of it is design rationale ("Written here rather than bound in the table's template
  because…", `table-keyboard-nav.directive.ts:252-254`; the `defaultTrack`/`FILLER_TRACK`/
  `isFlexibleTrack` essays, `table.component.ts:173-220`; the module preamble in
  `headless/table-column-state.ts:1-11` and `headless/index.ts:1-9`), and
  `table.component.html` / `table.component.css` are commented at a similar rate. Flagging the
  aggregate rather than every instance — it reads as a deliberate house style for this domain, but
  it is not what `AGENTS.md` allows.

- **Docs gaps and one contradiction.**
  - The Inputs table (`apps/docs/components/table.md:106-129`) omits `rowsSource`, which is a public
    input and the recommended binding (`table.component.ts:283`).
  - `loading`'s row says "Placeholder rows when there are no rows yet" — the base table draws
    nothing without `etTableSkeleton` (`table.component.html:161-167`), as the same page later
    states correctly (`:1133`).
  - `cellState`'s signature in that table omits the `{ state, message }` form that
    `TableCellStateValue` allows (`table.types.ts:72`).
  - "A row link is one `<a href>` **inside the row's identity cell**"
    (`apps/docs/components/table.md:1860`) is the opposite of the implementation, which deliberately
    makes the anchor a child of the *row* and only names it from that cell — the template comment
    explains why (`table.component.html:274-291`).

- **`TableRowsFromQuery.rows`' JSDoc still tells callers to "Bind to `<et-table [data]>`"**
  (`headless/table-rows-source.ts:53`) although the one-binding `[rowsSource]` path is now the
  documented default.

- **The group-header row's measured height is never cleared.** `TableGroupHeaderRowComponent` sets
  `feature.rowHeight` in its constructor (`table-group-header-row.component.ts:62`) with no
  counterpart on destroy, so after the feature is switched off at runtime the host keeps writing
  `--_et-table-group-h` from a signal owned by a destroyed view
  (`table-group-headers.directive.ts:28,45-47`), which would offset the sticky header row by a
  phantom row. *Unverified* — jsdom has no `ResizeObserver` data, so my attempt measured `0px` in
  both states and neither confirms nor refutes it.

- **Shadow colours are hardcoded as primary values**: `box-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 6px
  16px rgb(0 0 0 / .06)` (`table.component.css:178-180`) and `0 8px 24px rgb(0 0 0 / .18)`
  (`table-reorder-overlay.component.css:37`). Every other colour in the domain resolves from
  `--et-surface-*` / `--et-theme-color-*` with the literal only as a `var()` fallback — including
  the neighbouring pin/fade marks, which explicitly avoid a fixed black because it is invisible on a
  dark table (`table.component.css:108-123`, `:528-534`). `font-size: 14px` in the drag ghost
  (`table-reorder-overlay.component.css:29`) is likewise a one-off.

- **A forced layout read per header cell on every scroll tick while pinning is active.**
  `syncScrollState` → `syncObscuredColumns` (`table.component.ts:1212`) calls
  `getBoundingClientRect()` on the scroller plus each visible header cell
  (`table.component.ts:1891-1906`). Deliberate and explained in place, but it means the scroll
  handler of a wide pinned table does O(columns) sync layout reads per event.

- **The empty/error message row is a single `role="gridcell"` in a multi-column grid** with no
  `aria-colspan` (`table.component.html:149-159`, `:304-312`); it spans visually via CSS only.

## Spec coverage

**Well covered.** `table.component.spec.ts` (1 470 lines) is thorough: tracks/filler, min widths,
autosize, sort (client/server, multi, `setSort`, `toggleSort`, nullish sinking), filters
(client/server), column reorder + visibility + reconciliation across an identity change of
`columns`, `state()`/`restoreState()` round-trips (including a restore landing before the columns
input), appearance/density, loading/error/cell states, labels + locale re-resolution, `rowsSource`
(modes, mirroring, layout-only restore), footer slot, pointer-gesture claims and `rowClick`'s
interactive-descendant filtering. The feature specs are equally good for expansion, virtual scroll,
sticky columns, inline edit (including both host-listener orders for `Enter`), filters, skeleton,
group headers, selection, keyboard nav, page-sticky header and card surfaces. The headless layer has
solid specs for CSV serialization + download, `tableCsvRowsFromPages`, the state URL adapter, the
state storage + persistence directive, and both query adapters.

**Real logic with zero tests.**
- `table-reorder.directive.ts` (445 lines) — the largest untested file in the domain, and the one
  carrying the rAF leak above, the drop-target hysteresis, the landing-order preview and the edge
  auto-scroll. Nothing exercises any of it.
- `table-drag-scroll.directive.ts` (199) — `hasOwnScroller`, the claim hand-off with reorder, the
  swallowed click.
- `table-resize.directive.ts` (83) — only its *result* is tested, through
  `table.component.spec.ts`'s restored-width case; `start`/`update`/`end`/`cancel` and the grip are
  never driven.
- `table-column-menu.directive.ts` + `table-column-menu-trigger.component.*` — every action
  (`sortAscending`, `autosizeAll`, `canResetWidth`, `canHide`) is untested.
- `table-column-chooser.component.*` — `isLastVisible`, `hasHidden`, the keep-open behaviour.
- `table-csv-export.directive.ts` — the config/override merge (the ET3507 bug above), the counted
  `exporting` signal, `toCsv`.
- `table-row-router-link.directive.ts` — `href` resolution and the modified-click bail-out.
- `table-cell-error-tooltip.directive.ts` / `table-cell-error-mark.component.ts`.
- `headless/table-templates.ts` — registration is exercised indirectly; `unregisterColumnTemplate`
  on view destroy is not.
- `headless/table-column-state.ts` — the three reconcilers are only reached through the component
  spec; `reconcileColumnOrder`'s predecessor-slotting has no direct unit test.

**Specs asserting a shape that is itself wrong.**
`table-page-sticky-header.directive.spec.ts:60-63` asserts `role="grid"` on the host and finds
`role="rowgroup"` with an unscoped `querySelector`, so it passes over the role-less
`.et-table-header-strip` / `.et-table-scroller` wrappers and locks in the broken grid structure
reported above. (The regular-layout assertion at `:72` correctly uses `:scope >`.) No other spec
asserts a behaviour I believe to be wrong.

---

**Clean:** the pure transforms (`table-sort.ts`, `table-filter.ts`, `table-column-state.ts`) are
correct and honest about stability/nullish ordering; CSV quoting, the formula guard, the BOM `'auto'`
heuristic and `tableCsvRowsFromPages`' `expand` page arithmetic all check out; every one of the 15
CSS files is wrapped in `@layer components`, contains no Tailwind, and resolves colours from
`--et-surface-*` / `--et-theme-color-*` with literals only as `var()` fallbacks (the two shadows
above excepted); reduced-motion is handled for the scroll fades, the busy bar, the detail-row
animation and the reorder preview; the feature-host registration seam is consistently
signal-gated (`enabled`) and keeps the menu/tooltip/checkbox/skeleton/router dependencies out of the
base bundle exactly as the imports arrays claim; `signalDeferredLoading`, `linkedSignal` and
`toSignal`-style bridging are used per the reactive-state rules with `takeUntilDestroyed` last in
every pipe; `injectStyleManager().mount(...)` is used correctly for the five styles-only components;
`claimPointerGesture` releases off the document with `take(1)` and no leak; `deserializeTableState`,
`createTableStateStorage` and the `NOOP_STORAGE` fallback are SSR/blocked-storage safe; and all 17
`<StoryEmbed>` ids in `apps/docs/components/table.md` resolve to existing story exports in
`stories/table.stories.ts`.

---

## Improvements

Ideas, not verified defects. Ranked within each category; every one is grounded in the files read
above.

### Features

1. **Ship a "pin this column" action, since the measuring already exists.**
   `etTableStickyColumns` computes and stacks offsets dynamically
   (`table-sticky-columns.directive.ts:97-194`) and the table already answers `effectiveStickyOf`
   (`table.component.ts:1742`), but pinning can only be *declared* on a column
   (`table.types.ts:226`). There is no `setColumnSticky`, no `sticky` field in `TableColumnState`
   (`table.types.ts:293-307`), and no entry for it in `TableColumnMenuConfig`
   (`table-column-menu.directive.ts:11-18`) beside autosize / reset-width / hide. Material,
   PrimeNG and AG Grid all let the user pin at runtime, and here it is one signal plus one state
   field away.

2. **Surface multi-sort priority in the header.** `multiSort` accumulates sorts
   (`table.component.ts:1567-1579`) and `state()` serializes `sortPriority`
   (`table.component.ts:836`, `table.types.ts:302`), but `headerCellVms` exposes only
   `direction` (`table.component.ts:977-1008`) — so a three-column sort renders three identical
   arrows and the user cannot tell which one leads. A small ordinal beside the arrow (the peer-lib
   convention) needs only the index that `state()` already computes.

3. **Give filtering operators, or at least a table-wide quick filter.** `filterRows` matches with
   `===` against a value set (`headless/table-filter.ts:29`), so "contains", numeric/date ranges and
   "is empty" all have to be hand-rolled into `filterValue`. A `TableFilter` variant carrying an
   operator, plus a `globalFilter` input searching every column's `filterValue`, would cover the
   two cases every peer library ships and would not disturb the existing set semantics.

4. **Row grouping / tree rows as a feature, reusing the row-detail seam.** The table can expand a
   row into a detail template (`headless/table-features.ts:225-234`) but cannot render a
   hierarchy or grouped bands. `TableRowDetail` (stamped per open row) and `TableRowWindow`
   (`:241-254`) are already the right shape for a `TableRowGrouping` registration that contributes
   group-header rows and an indent level — the base table would need no new concept.

5. **Range selection and cell-range copy.** `setSelected` is strictly one row
   (`table-selection.directive.ts:130-141`), so shift-click across 200 rows is 200 clicks.
   `etTableKeyboardNav` already tracks a cell coordinate it exposes as `activeCell`
   (`table-keyboard-nav.directive.ts:79`), which is exactly the anchor a Shift+Arrow range and a
   Ctrl+C-to-clipboard would extend from — and `tableToCsv` is already the serializer for it
   (`headless/table-csv-export.ts:215`).

6. **Drag-to-reorder rows.** Columns can be dragged with a ghost and a live landing preview
   (`table-reorder.directive.ts`), and the `TableLayer` seam already hosts floating UI for a
   feature with no view (`headless/table-features.ts:118-124`); a row-reorder feature would reuse
   both wholesale.

7. **A pinned totals row.** Footer cells are per column and sit in a sticky footer row
   (`table.component.html:337-378`), but there is no way to pin a *data* row (a totals or "all"
   row) to the top or bottom of the body — a common request for financial tables, and adjacent to
   the existing `TableHeaderRow` registration.

8. **Autosize on grip double-click, not reset.** `(dblclick)="resize.reset(column())"`
   (`table-resize-grip.component.ts:23`) drops the override; every peer library fits the column to
   its content on that gesture, and `autosizeColumn` already exists
   (`table.component.ts:1834`). Reset would still live in the column menu.

### DX

1. **Write a `TableDriver` test harness — the domain is the largest holdout from the repo's own
   driver convention.** Every spec re-implements the same DOM plumbing: cell/row query helpers and
   a `focused()` reader in `table-keyboard-nav.directive.spec.ts:48-60`, synthetic pointer
   sequences in the sticky-columns and page-sticky specs, `.et-table-header-label--sortable`
   selectors scattered through `table.component.spec.ts`. One driver exposing
   `rows()/cell(r,c)/header(key)/sort(key)/dragColumn()/openMenu()` would delete hundreds of lines
   and make the missing specs below cheap to write.

2. **Make a partial `rowsSource` impossible, or say so loudly.** Every member but `rows` is
   optional (`headless/table-rows-source.ts:28-50`), and a source with `setSort` but no `sort`
   breaks the header permanently (High #2). Either narrow the type so the setter and the signal
   come as a pair, or add a dev-mode `RuntimeError` from the mirroring effect
   (`table.component.ts:1166-1178`) when one is present without the other — the domain already has
   an error-code convention for exactly this kind of misuse (`table-errors.ts`).

3. **Blame the call site, not the merged object, in `ET3507`.** `assertFileOptions` reports which
   options are "ignored" (`headless/table-csv-export.ts:293-304`) without saying that they came
   from the directive's bound config rather than from the `export()` call — the reason Medium #3
   reads as a broken option. Checking only the overrides, and naming the config in the message when
   it is the source, turns a false positive into a useful sentence.

4. **`TableRowKey` is a dead export.** `table.types.ts:352` is exported from the public barrel and
   referenced nowhere in `libs/components/src`; `rowKey` is typed inline instead
   (`table.component.ts:292`). Either use it there or drop it.

5. **A `defineTableColumns<T>()` helper would replace the `satisfies` ritual.** Every example, story
   and spec writes `} satisfies TableColumns<Person>` (`table.types.ts:274-279`,
   `stories/table-storybook.data.ts`, every spec) purely to get `row` inferred in the accessors. A
   generic factory gives the same inference, a better error when an accessor is wrong, and one less
   thing to explain in the docs' first code block.

6. **Type the commit payload.** `TableCellEditCommit.previous`/`next` are `unknown`
   (`table-inline-edit.directive.ts:24-33`), so every consumer casts — including the docs' own save
   handler (`apps/docs/components/table.md:1660-1670`). The column carries `TValue`
   (`table.types.ts:166`), so at least a `TableCellEditCommit<T, TValue>` overload for the
   single-column case is reachable.

7. **Let `<et-table-column-chooser>` find its table by DI when it is inside one.** It requires an
   explicit `[table]` template-ref binding (`table-column-chooser.component.ts:60`,
   `apps/docs/components/table.md:586`), which is boilerplate for the common case of putting it in
   the `[etTableFooter]` slot — where `inject(TABLE_FEATURE_HOST, { optional: true })` would find
   it, keeping the input as the escape hatch for a toolbar outside the table.

8. **Nineteen imports arrays is a lot of ceremony for a prototype.** `table.imports.ts` exports one
   array per feature (correct for bundle size), but there is no `TABLE_ALL_IMPORTS` for a spike and
   no grouped preset (e.g. "the interactive set": filters + column menu + resize + reorder). A
   documented all-in constant with an explicit "for prototyping only" note would save a lot of
   copy-paste without weakening the default.

### Bundle size

1. **Split `table.component.css` (1 166 lines) — roughly 40 % of it serves a minority of tables.**
   The sheet's own section markers give the slices: **card rows** `717-898` (~182 lines, only for
   `appearance="cards"`), **sticky columns** `409-475` (~67, only with `etTableStickyColumns`),
   **row links + row box** `624-716` (~93, only with `rowLink`), **loading/busy bar** `1092-1166`
   (~75), **error state** `1058-1091` (~34), **sticky footer row** `476-506` (~31). The
   sticky-columns block is the cleanest win: the feature is already a separate directive that
   currently mounts no styles at all, so moving those rules into a
   `TableStickyColumnsStylesComponent` and `injectStyleManager().mount(...)`-ing it from
   `table-sticky-columns.directive.ts` follows the exact pattern
   `etTableVirtualScroll` → `TableVirtualScrollStylesComponent` already uses. Card rows and row
   links are input-driven rather than feature-driven, so they fit the "mount on demand from an
   effect" variant AGENTS.md describes for the detail-row animation — that saves injection and
   style recalc rather than bytes, but 182 lines of `color-mix` card chrome is a real recalc cost
   on every table in an app that never uses cards. Worth noting AGENTS.md names `form-field` as the
   next splitting candidate while this sheet is larger.

2. **Split the filter trigger by selection mode.** `TableFilterTriggerComponent` statically imports
   both the radio and the checkbox menu groups (`table-filter-trigger.component.ts:36-49`) and
   renders one or the other from `filterSelection`, which "never changes at runtime" by its own
   template comment (`table-filter-trigger.component.html:28-31`). Two components stamped per
   column — or the single-select one behind its own imports array — would let the (majority) app
   that only ever uses checkbox filters drop `MenuRadioGroupComponent` /
   `MenuRadioItemComponent` entirely.

3. **The column menu provides six icons unconditionally.**
   `table-column-menu-trigger.component.ts:40-49` registers `ellipsis`, `arrow-up`,
   `arrows-left-right`, `times`, `rotate-right` and `eye-slash` even for
   `{ autosize: false, resetWidth: false, hideColumn: false }`, where only the trigger's own glyph
   and the sort arrows can ever render. Icon payloads are small individually, but this is the one
   place in the domain where a config that switches features off does not shrink what ships.

4. **Verify `table.imports.ts` really tree-shakes.** One module statically references all twenty
   feature directive classes (`table.imports.ts:1-30`), and this repo has already measured a
   ~90 kB import floor from exactly this kind of tuple-of-providers pattern (see
   `plans/tree-shaking-opportunities.md` and `tools/treeshake/goldens.json`). A golden that imports
   only `TABLE_IMPORTS` and asserts the menu/tooltip/checkbox/router are absent would turn the
   architecture's central claim into a test.

### UI/UX

1. **Add `aria-rowcount` / `aria-colcount` / `aria-rowindex` — without them a virtualized table is
   unnavigable with a screen reader.** No file in the domain sets any of them (grepped), so with
   `etTableVirtualScroll` an AT sees only the ~20 windowed rows and no total, and `Ctrl+End`
   "lands on the real last cell" (`apps/docs/components/table.md:1580`) with nothing announcing
   where that is. Everything needed is already computed: `totalRows()`
   (`table.component.ts:912`), `rows().length`, `rowIndexOffset()` (`:895`) and
   `visibleColumns()`.

2. **Announce the result of a sort or filter.** The sortable header's `aria-label` announces what
   the *next* activation will do (`headless/table-labels.ts:26-30`) — good — but after activation
   nothing says the table re-sorted, and `aria-sort` alone is not announced by every AT on change.
   A polite live region carrying "Sorted by Name, ascending" / "12 of 340 rows" would also cover
   filtering, which currently changes the body silently. The label set is the natural home for the
   strings.

3. **The header has no arrow-key navigation, and a fully-featured column is three tab stops.**
   `etTableKeyboardNav` deliberately covers body cells only (it works from
   `bodyCellElements()`, `table-keyboard-nav.directive.ts:232`), so a table with filters + column
   menu + resize gives every column a sort button, a filter trigger and a menu trigger in the tab
   order — 30 stops for a ten-column table. The ARIA grid pattern puts header cells in the same
   arrow-key plane as body cells; `headerCellElements()` already exists
   (`table.component.ts:1730`) to extend the roving tabindex upward.

4. **Shift-click range selection is the missing half of row selection.** See Features #5; from a
   pure UX angle, a selection column whose only gesture is one checkbox at a time is the thing
   users notice first on a 200-row page.

5. **Column reorder has no touch story.** Drag-to-scroll deliberately skips touch pointers
   (`table-drag-scroll.directive.ts:141`, so native panning survives), but
   `etTableReorder`'s delegated `pointerdown` filters only on `button !== 0`
   (`table-reorder.directive.ts:147`) — so on a touch device a header press-and-drag competes with
   the browser's own scroll instead of requiring a long-press to arm. A press-and-hold threshold
   for `pointerType === 'touch'` would make the two gestures distinguishable.

6. **The empty and error rows are a single cell in a multi-column grid with no `aria-colspan`**
   (`table.component.html:149-159`, `:304-312`); they span visually through CSS. Cheap to add, and
   it is what makes the message read as covering the table rather than as column one's value.

7. **A resized column has no visible "this is customised" affordance.** The column menu offers
   "Reset width" only once an override exists (`table-column-menu.directive.ts:87-89`), which is
   correct, but nothing on the header itself says the column is no longer auto — and a cancelled
   drag silently creates one (Medium #5). A subtle grip state would make both discoverable.

### Testing

1. **Spec `table-reorder.directive.ts` first — 445 lines, zero tests, and it holds the one
   confirmed leak.** The scratch spec in this scan already proves the whole gesture is drivable in
   jsdom (`pointerdown` on a header cell + `pointermove` on `document`, with `scrollLeft` defined
   via `Object.defineProperty`). Cover: the pinned-column exclusion (`:160`), the drop-target
   hysteresis (`:349-358`), the landing-order preview signature short-circuit (`:384`), the commit
   path vs the animated snap-back (`:210-220`), and edge auto-scroll start/stop.

2. **Add a "destroyed mid-gesture" case to all three drag features.** Reorder leaks a rAF loop
   today; drag-scroll (`table-drag-scroll.directive.ts:151-176`) and resize
   (`table-resize.directive.ts`) share the same "gesture outlives the view" shape and are only safe
   by accident of having no timer. One shared helper — start a gesture, `fixture.destroy()`,
   assert nothing further runs — would pin all three.

3. **Cover the untested feature directives, in value order:** `table-csv-export.directive.ts`
   (the config/override merge that produces Medium #3, plus the counted `exporting` signal and
   `toCsv`), `table-column-menu.directive.ts` (every action, and the `canHide` last-column guard),
   `table-column-chooser.component.ts` (`isLastVisible`, keep-open), `table-resize.directive.ts`
   (the cancel path, Medium #5), `table-row-router-link.directive.ts` (`href` resolution and the
   modified-click bail-out), and `headless/table-column-state.ts`'s three reconcilers directly
   rather than only through the component.

4. **Test feature *composition*, not just features.** Every feature registers into a shared list on
   the table (`table.component.ts:483-575`) and several read each other indirectly through it
   (pinning ↔ reorder ↔ drag-scroll ↔ filler track; keyboard nav ↔ inline edit ↔ virtual scroll).
   Only inline-edit × keyboard-nav is tested as a pair
   (`table-inline-edit.directive.spec.ts`, "with keyboard navigation"). A matrix spec mounting
   selection + expansion + sticky columns + virtual scroll + keyboard nav on one table would catch
   the lead/trail-column index arithmetic and the `bodyCellElementAt` rows-major assumption
   (`table.component.ts:1463-1473`), which nothing currently exercises with utility columns
   present.

5. **Add an a11y-tree assertion for the two layouts.** The page-sticky spec's
   `querySelector('.et-table-header')` (`table-page-sticky-header.directive.spec.ts:63`) passes
   over the role-less wrappers that break the grid structure (Medium #1). Asserting the
   `role="grid"` element's *direct* row/rowgroup children in both layouts would have caught it, and
   would guard the fix.

---

## rich-text-editor / multi-language-rich-text-editor

Scope: `libs/components/src/lib/forms/rich-text-editor` (~14.3k lines), `libs/components/src/lib/forms/multi-language-rich-text-editor` (~0.6k lines), `apps/docs/components/rich-text-editor.md`. Reviewed with the uncommitted working-tree changes in place (the `et-scrollbar` retrofit of the docked toolbar).

Runtime verification used a scratch spec at `libs/components/src/lib/forms/rich-text-editor/__scan-verify.spec.ts`, run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts src/lib/forms/rich-text-editor/__scan-verify.spec.ts`, then deleted. Working tree left as found.

### High

- **An empty `<u>` or `<code>` shell survives every prune and lands verbatim in the Markdown value.** `pruneEmptyInline` at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-dom-inline-marks.ts:326` declares `const tags: InlineTag[] = ['strong', 'em', 'del'];` even though `InlineTag` is `'strong' | 'em' | 'del' | 'u' | 'code'`, and the directive's second line of defence at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts:760` sweeps only `clone.querySelectorAll('strong, em, del, a')`. `insertInlineText` → `splitInlineAncestorsAtCaret` (same file, `:401-432`) empties the original mark element whenever the caret sits at its start, then calls `pruneEmptyInline()` at `:482` — which skips `u`/`code`. Concrete scenario: place the caret at the start of underlined (or inline-code) text, toggle a mark off so stored marks are pending, and type one character.
  **Runtime-verified.** Observed output:
  - `<u>abc</u>` + caret at 0 + `insertInlineText('X', [])` → DOM `<u></u>X<u>abc</u>`, value `"<u></u>X<u>abc</u>"` — raw HTML leaks into the Markdown the form field emits.
  - `<code>abc</code>` → DOM `<code></code>X<code>abc</code>`, value `` "``X`abc`" `` — a stray empty code span.
  - Control with `<strong>` (which *is* pruned) → DOM `X<strong>abc</strong>`, value `"X**abc**"`.
  Both corrupted values then round-trip: `markdownToHtml` re-renders the `<u></u>` and the `` `` `` on the next external write/undo.

- **The trigger popup opens when the caret is placed *before* an existing trigger char, and picking an item then leaves the literal text behind.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-trigger-detection.ts:56` does `const charOffset = text.lastIndexOf(trigger.char, caretOffset - 1);`. With `caretOffset === 0` the negative `fromIndex` is clamped to 0 by `String.prototype.lastIndexOf`, so index 0 still matches — the guard `charOffset === -1` never fires. `insertItem` at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:319-323` then builds `setStart(textNode, match.charOffset)` / `setEnd(textNode, Math.min(match.caretOffset, …))` = `setStart(node, 0)` / `setEnd(node, 0)` — a **collapsed** range, so `insertAtomicToken` inserts the chip without replacing anything. Scenario: type `#alpha`, press Home (or ArrowLeft to the line start) — the popup opens with an empty query; picking a row yields `«chip»#alpha`.
  **Runtime-verified**: `resolveTriggerMatch` returned `{"charOffset":0,"caretOffset":0,"query":""}` for a caret at offset 0 of `#alpha`.

- **A required rich text editor never announces that it is required.** The editable at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.html:39-61` binds `aria-invalid`, `aria-describedby`, `aria-labelledby`, `aria-disabled` and `aria-readonly` — but not `aria-required`, even though `RichTextEditorDirective.required` exists (`headless/rich-text-editor.directive.ts:74`) and is forwarded through the component's `hostDirectives` inputs. Every sibling control in the same folder binds it: `rating/headless/rating.directive.ts:35`, `checkbox/headless/checkbox.directive.ts:24`, `switch/headless/switch.directive.ts:27`, `select/headless/select-trigger.directive.ts:16`, `cascader/headless/cascader-trigger.directive.ts:18`, `tag-input/headless/tag-input-field.directive.ts:14`, `phone-input/headless/phone-input-field.directive.ts:16`, plus both date-time input fields. The visual `*` marker the docs cite (`apps/docs/components/rich-text-editor.md`, Accessibility) is not exposed to assistive tech, so a screen-reader user gets nothing. The multi-language wrapper inherits the same gap (it forwards `required` into the embedded editor). **Code-verified only.**

### Medium

- **The table tool and the alignment tool commit their edits without a history boundary, so the next keystroke swallows them.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-table-tool.component.ts:214` (`insert`) and `:248` (`mutate`, which backs add/remove row/column/table), and `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-align-tool.component.ts:100` (`select`) all call `editor.syncFromDom()` with no `{ boundary: true }`. Every other programmatic rewrite passes it — the invariant is stated twice, at `headless/rich-text-editor.directive.ts:283-285` ("Every programmatic rewrite (paste, autoformat, a tool, a token insert) passes `true`") and at `headless/internals/rich-text-editor-history.ts:84-87`. Without the boundary, `commit` leaves `burstOpen = true` (`rich-text-editor-history.ts:111`), so a keystroke landing inside the 500 ms `COALESCE_WINDOW_MS` *replaces* the tool's entry rather than pushing a new one. A second consequence: `syncFromDom` runs `repairCodeBlock()` / `repairEmptyQuotes()` only on the non-boundary path (`rich-text-editor.directive.ts:293-296`, commented "only the browser produces those"), so a table/alignment edit takes the native-repair path it was never meant to.
  **Runtime-verified** against `createRichTextEditorHistory`: with `boundary: true` on the tool commit, one undo after typing one char yields `"TABLE"`; with `boundary` omitted (current behaviour) the same undo yields `""` — the table insert is gone in the same step.

- **`MultiLanguageRichTextEditorLanguage.icon` is documented public API that renders nothing.** Declared at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor-config.ts:12-13` as "Optional icon token (e.g. a flag) rendered next to the label in the dropdown", and repeated in the docs (`apps/docs/components/rich-text-editor.md`: "Each language `{ code, label, icon? }` …"). The switcher template at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.html:26` binds `[icon]="activeIcon(language.code)"` — which returns only `'et-check'` or `null` (`…-language-tool.component.ts:44-46`). `grep -rn '\.icon' multi-language-rich-text-editor/` returns **no** hits, so the field is read nowhere. A consumer passing flags sees them silently dropped.

- **Hardcoded English in a shipped ARIA label, in an otherwise fully localizable component.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.html:30`: `[attr.aria-label]="isFilled(language.code) ? 'has content' : 'empty'"`. `RichTextEditorLabels` (`rich-text-editor/rich-text-editor-labels.ts`) has no key for either string, so `provideRichTextEditorLabels` cannot reach them — while the docs promise "Every string the editor renders - … - comes from `RICH_TEXT_EDITOR_LABELS`" (Localization section). A German app announces the per-language status dots in English.

- **The link editor accepts any URL scheme; the resulting link silently degrades to literal text on the next re-render.** `RichTextEditorLinkEditorComponent.save()` (`/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor-link-editor.component.ts:94-100`) only trims and checks non-empty, and `applyLink` writes it straight to the anchor (`headless/internals/rich-text-editor-dom-links.ts:112`, `:118`). The editor's own Markdown renderer refuses it (`libs/core/src/lib/utils/markdown.ts:152`, `isSafeUrl`), so the link exists in the DOM and in the form value but not after an undo / external write.
  **Runtime-verified** with `applyLink('javascript:alert(1)')`: DOM `<a href="javascript:alert(1)">click me</a>`, value `"[click me](javascript:alert(1))"`, and `markdownToHtml` of that value → `"<p>[click me](javascript:alert(1))</p>"` (no `<a>` at all). Two defects in one: the link vanishes on undo, and the persisted value carries an unsanitized `javascript:` URL for any consumer that renders the Markdown with something other than `@ethlete/core`.

- **The soft-keyboard tracker runs on every editor instance, including pointer-only devices where the docked bar can never appear.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.ts:159` calls `this.trackKeyboardInset()` unconditionally; the only bail-out inside is `if (!view || !viewport) return;` (`:414`). It then appends a probe `<div>` to `document.body` (`:442-451`), calls `kick()` immediately (`:502`) — which starts a rAF loop that runs up to 30 frames measuring `probe.getBoundingClientRect()` — and subscribes to `resize` + `scroll` on the visual viewport *and* the window (`:532-543`), each event re-kicking the same 30-frame loop. `dockedToolbar` requires `hasTouchInput()` (`:153`), so on a desktop page every scroll pays ~30 frames of forced layout per editor for a bar that is never shown. The fix is a `hasTouchInput()` guard around the whole method. **Code-verified only** (needs a real layout to time).

- **The new `et-scrollbar` is instantiated on desktop too, where the toolbar wraps and can never overflow.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor.component.html:35` renders `<et-scrollbar [for]="toolbarElement" orientation="horizontal" autoHide />` unconditionally, but `overflow-x: auto` / `flex-wrap: nowrap` are applied only under `&.et-rich-text-editor--touch .et-rte-toolbar` (`rich-text-editor.component.css:144-153`) — on desktop the toolbar keeps `flex-wrap: wrap` (`:71`). Per editor that costs a `signalElementDimensions` ResizeObserver plus a `signalElementScrollState` MutationObserver (`libs/components/src/lib/scrollbar/headless/scrollbar.directive.ts:112-116`) and three event subscriptions (`scroll`, `pointerenter`, `pointerleave`, `:100-173`), and it stamps `et-scrollbar-host` on the toolbar (`:218`), suppressing its native scrollbar for good. Wrapping the element in `@if (hasTouchInput())` would keep it off desktop entirely. (Note: the mutation filter is `['class','hidden']` and `pressed` renders as `data-pressed`, so this does *not* thrash on every keystroke — the cost is instantiation, not per-edit work.)

- **`createRichTextEditorTriggerWithQuery` shows the previous query's results when `args` returns `null`, contradicting its own doc.** The JSDoc at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor-trigger-with-query.ts:37-39` says: "Return `null` to skip a request (e.g. for an empty query) so the popup shows no results without hitting the backend." But `items` (`:97-116`) subscribes to `query.executionState.asObservable()` and takes the first non-`loading` state. `asObservable` is `toObservable(source)` (`libs/query/src/lib/http/observable-signal.ts:17`), which replays the signal's current value to every new subscriber. With `null` args the query never re-executes, so the replayed value is still the *previous* `success` state and `toItems` maps the stale response. The domain's own spec (`rich-text-editor-trigger-with-query.spec.ts`) fakes `executionState` with a bare `Subject` (no replay), which is exactly why this is invisible to it. **Code-verified only.**

- **Clicking a second image while an image popover is open closes it without opening the new one.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-image.provider.ts:278-282`: `openEditor` starts with `if (overlayRef) { close(); return; }` — intended as a toggle for re-clicking the *same* image, but it does not compare which image. `overlayRef` is only cleared in `afterClosedEvent()` (`:345`), which fires after the close animation, so the `closeOnOutsidePointer` dismissal triggered by pressing image B has not cleared it yet when `handleClick` runs. Net effect: the user must click image B twice. **Code-verified only** (needs the overlay runtime).

- **`restoreSelection` re-applies a stale range without checking it still lives in the editor, unlike `ensureCaret`.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-dom-core.ts:84-94` does `el.focus(); removeAllRanges(); addRange(lastRange)` with no containment test, while `ensureCaret` in the same file guards with `if (lastRange && el.contains(lastRange.commonAncestorContainer))` (`:375`). `writeValueToDom` replaces `root.innerHTML` wholesale (`headless/rich-text-editor.directive.ts:855`) and never invalidates `lastRange`, so after a programmatic value write / undo every `restoreSelection` caller (`toggleMark` `:781`, `runCommand` `:824`, the image tool `:227`, the link editor `:111`) hands the browser a detached range. Browsers ignore an `addRange` whose root is detached, so the practical result is the caret jumping to the start of the editor rather than back to where the user was.

- **The trigger popup's own inserts also skip the history boundary.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:334` (`this.editor.syncFromDom()` after appending the trailing nbsp) and `:370` (`deletePrecedingChip`) both omit `{ boundary: true }`, unlike the equivalent public path `insertChip` (`headless/rich-text-editor.directive.ts:735`). Same mechanism as the table/align finding: the next keystroke within 500 ms can merge the chip insert (or the chip deletion) into its own entry.

- **Every image upload and every file-picker open registers a `destroyRef.onDestroy` callback that is never removed.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-image.provider.ts:205` (`destroyRef.onDestroy(() => run.cancel())`, inside `uploadOne`) and `:155` (`destroyRef.onDestroy(() => input.remove())`, inside `pickFiles`) run per call, so the injector's teardown list grows monotonically with the number of images a user uploads in one session — each closure pinning its `File`, `run` handle and (for the picker) the `<input>` element. A long editing session with dozens of images keeps every one of them alive until the editor is destroyed.

- **`hydrate`'s async label resolvers are never unsubscribed.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-token.ts:198-204` does `void resolved.then(apply)` / `resolved.pipe(take(1)).subscribe(apply)` with no `takeUntilDestroyed` and no teardown handle. `hydrate` runs on every `writeValueToDom` (`headless/rich-text-editor.directive.ts:856`), every paste (`:615`, `:644`) and every `insertChip` (`:733`), once per chip — so a document with N chips creates N subscriptions per render. A `resolveItem` returning an observable that never emits (a store selector waiting on a fetch, a `NEVER`-ish stream) leaks one subscription per chip per render for the editor's lifetime. The `chip.isConnected` guard at `:188` protects correctness, not the subscription.

- **The alignment tool queries every table cell in the document on every selection change.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/tools/rich-text-editor-align-tool.component.ts:80-87` subscribes to `document`'s `selectionchange` and calls `readAlign()` → `targetBlocks()` (`:118`), whose first statement is `[...root.querySelectorAll<HTMLElement>('th, td')].filter((cell) => range.intersectsNode(cell))`. That is a full-subtree query plus an `intersectsNode` per cell on every caret movement, for every alignment-tool instance. Two further consequences: with two editors on one page, moving the caret in editor A resets editor B's alignment indicator to `'left'` (`getSelection()` returns `null` outside its own root → `readAlign` returns `'left'`), and the query runs even when the document holds no table at all.

### Low

- **The ```` ``` ```` autoformat rule is the only one that skips the reserved-character check.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-dom-autoformat.ts:79`: `} else if (codeBlock && prefix === '```') {` — no `isReserved` call, while the `-`/`*`/`+`, `\d.`, `#` and `>` rules all have one (`:73-81`) and the inline `` ` `` rule does too (`:135`). The `autoformat` input's JSDoc (`headless/rich-text-editor.directive.ts:85`) states flatly "Registered token-trigger characters never autoformat". In practice `autoformatSuppressed` usually covers it (a backtick trigger would have an active match), so this is a latent inconsistency rather than a live bug.

- **`aria-controls` and `aria-haspopup` are left on the editable forever after the popup's first open.** `setAriaExpanded` at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor-triggers.directive.ts:483-494` sets all three when opening but removes none when closing — only `aria-expanded` flips to `"false"`. `aria-controls` then points at a listbox id that is no longer in the document.

- **`aria-activedescendant` points at a nonexistent option whenever the popup has no rows.** Same file, `:161-175`: the effect writes `${listboxId}-option-${index}` whenever `overlayRef()` is set, but the template only renders options when `items().length > 0` (`rich-text-editor-token-popup.component.html`), so during loading / empty / error states the attribute references nothing.

- **`RICH_TEXT_EDITOR_ERROR_CODES` is not part of the domain's public surface.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/index.ts` has no `export * from './rich-text-editor-errors'`, while every sibling domain exports its own — `multi-language-rich-text-editor/index.ts`, `forms/cascader/index.ts`, `menu/index.ts`, `scrollbar/index.ts`, `time-picker/index.ts` all do. The docs (`apps/docs/components/rich-text-editor.md`, "Error codes") tell consumers to expect `ET25xx`, but they cannot import the constant.

- **Stale comment in `pruneEmptyInline`.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-dom-inline-marks.ts:317`: "That empty shell can be of any of the three inline tags" — there are five (`InlineTag` at `rich-text-editor-dom-core.ts:7`). The comment is describing the very gap that produces the first High finding.

- **The language switcher's trigger has no pressed state, unlike its three sibling menu triggers.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/tools/multi-language-rich-text-editor-language-tool.component.html:2-11` is a bare `<button class="et-ml-rte-lang-trigger" etMenuTrigger>` with no `#menu="etMenu"` reference and no `[pressed]`, whereas the heading (`tools/rich-text-editor-heading-tool.component.html:4`), alignment (`…align-tool.component.html:4`) and table (`…table-tool.component.html:4`) triggers are all `et-icon-button` with `[pressed]="menu.open()"` and `emitAriaPressed="false"`.

- **The selection toolbar carries `role="toolbar"` while being unreachable by keyboard.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/rich-text-editor-floating-toolbar.component.ts:34` sets the role, and every button in `rich-text-editor-floating-toolbar.component.html:18` is `tabindex="-1"` with no roving-tabindex handling. This is deliberate (`headless/rich-text-editor-floating-toolbar.directive.ts:34-36`, and the docs call it "a pointer-only enhancement"), and the static toolbar covers the same actions — but the ARIA role advertises a keyboard-navigable widget that isn't one. `role="group"` would be honest.

- **The token codec turns `{{type:id}}` into a chip anywhere in the rendered HTML, including inside a code fence.** `render` at `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-token.ts:170-175` runs `html.replace(TOKEN_MARKDOWN_RE, …)` over the whole `markdownToHtml` output string, with no awareness of `<pre>`/`<code>` context or attribute values — so literal token syntax typed inside a fenced code block renders as a live chip.

- **Ordered-list autoformat ignores the number typed, and this is undocumented.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/rich-text-editor/headless/internals/rich-text-editor-dom-autoformat.ts:75-76` matches `/^\d{1,9}\.$/` and calls `toggleList('ol')`, which always starts the list at 1. Typing `5. ` produces a list numbered from 1; nothing in the `autoformat` JSDoc or the docs' "Markdown autoformat while typing" section says so.

- **Three unused public computeds on the multi-language directive.** `hasValue` (`/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/headless/multi-language-rich-text-editor.directive.ts:47`, JSDoc'd "used e.g. for form-field label float"), `filledCount` (`:43`) and `totalCount` (`:44`) are read by nothing in the repo — the switcher only uses `missingLanguages().length` and `isFilled`. Label float is in fact driven by the *embedded* editor's own `hasValue`, so it reflects only the active language.

- **The multi-language wrapper forwards neither `labels` nor `hidden` to the embedded editor.** `/Users/tom/dev/ethlete-sdk/libs/components/src/lib/forms/multi-language-rich-text-editor/multi-language-rich-text-editor.component.html` passes `value`/`disabled`/`readonly`/`invalid`/`errors`/`required`/`placeholder`/`tools`/`autoformat` but not `labels` (a per-instance label override is therefore impossible here — only the app-wide provider works) or `hidden`. The docs claim "`tools`, `autoformat`, `placeholder` and the field chrome all work the same", which is accurate as far as it goes, but the asymmetry is undocumented.

- **Hardcoded black box-shadows.** `rich-text-editor.component.css:126`, `rich-text-editor-floating-toolbar.component.css:80`, `rich-text-editor-link-editor.component.css:32`, `rich-text-editor-image-editor.component.css:38`, `rich-text-editor-token-popup.component.css:68` all use literal `rgb(0 0 0 / …)` with no token or fallback indirection. Not a token-system violation per AGENTS.md (which targets backgrounds, text, borders and interaction states), and consistent with the rest of the lib, but it is the only place in this domain where a colour is not theme-derived.

### Spec coverage

**Well covered.** The DOM layer is the strongest part: `headless/internals/rich-text-editor-dom.spec.ts` (1346 lines, 113 `it`s) exercises inline marks (including cross-block and cross-cell slicing), lists, headings, blockquotes, code blocks, links, backspace, `markStates`, both autoformat paths, `insertNormalizedHtml` and `codeExit`, plus a second `describe` for behaviour with the block domains absent. `rich-text-editor-history.spec.ts` (26 `it`s) covers burst coalescing, word-boundary breaks, the redo-branch discard and `reset`. `headless/rich-text-editor.directive.spec.ts` (29 `it`s) covers form-field registration, the `ET2506` missing-provider throws, `pasteHtml` normalization, history at the directive level and `insertToken`. `internals/rich-text-editor-token.spec.ts` covers `serialize`/`render`/`parseTokenText`. `tools/rich-text-editor-image.util.spec.ts` and `tools/rich-text-editor-image-upload.spec.ts` cover the placeholder lifecycle, `normalizeImages` and all three upload flavours.

**Real logic with zero tests.**
- `rich-text-editor.component.ts` (569 lines) — the entire keyboard-interception chain (`interceptEditorKeydown`), paste/drop/click tool dispatch, `interceptFormattingCommand`, `trackKeyboardInset` and `trackEditingActive`. No spec exists for this file at all.
- `headless/rich-text-editor-triggers.directive.ts` (519 lines) and `internals/rich-text-editor-trigger-detection.ts` — untested. `resolveTriggerMatch` is a pure function and would have caught High finding #2 with a three-line test.
- `internals/rich-text-editor-trigger-source.ts` (`trackTriggerItems`: debouncing, keep-previous-while-loading, error mapping) — untested.
- `headless/rich-text-editor-floating-toolbar.directive.ts` — untested.
- `tools/rich-text-editor-table-tool.component.ts` (305 lines) and `createTableOps` — untested; `rich-text-editor-table.util.spec.ts` covers only `createTableNav`'s `tab` (5 `it`s), not `exit`/`enter` and not a single row/column op.
- `tools/rich-text-editor-align-tool.component.ts` (177 lines, incl. `expandToColumns` and `wrapLooseContent`) — untested.
- `tools/rich-text-editor-image.provider.ts` (394 lines: `matchesAccept`, `imageFilesOf`, paste/drop gating, popover lifecycle) — untested.
- `rich-text-editor-token-palette.component.ts` — untested.
- `rich-text-editor-labels.ts` (`richTextEditorToolLabel`'s open-token fallback) — untested.
- **The whole `multi-language-rich-text-editor` domain has no spec file.** Untested: the `activeLanguage` `linkedSignal` fallback when a language is removed, `writeActiveMarkdown`'s preservation of out-of-list codes (an explicitly documented guarantee), `missingLanguages`/`isFilled`, the dev-mode duplicate/empty-language throws, and the exported `requiredLanguages` validator.

**Specs asserting a wrong behaviour.** None found. One spec is misleadingly *weak*: `rich-text-editor-trigger-with-query.spec.ts` fakes `executionState.asObservable()` with a plain `Subject`, which does not replay — the real implementation (`libs/query/src/lib/http/observable-signal.ts`) does, which is precisely the mechanism behind the stale-results Medium above.

Clean: `@layer components { … }` wraps all 17 CSS files in scope, with no Tailwind in component source and no hardcoded colour used as a primary background/text/border/interaction value. Both controls are signal-forms native (`FormValueControl`), with no `ControlValueAccessor` anywhere. Reactive state is signals throughout; RxJS appears only for genuinely async work and every long-lived subscription in scope terminates with `takeUntilDestroyed` last in the pipe. `markdownToHtml`/`htmlToMarkdown` sanitize (`libs/core/src/lib/utils/markdown.ts`), and the chip builders escape via `escapeHtmlText` with quoted attributes, so `root.innerHTML = …` in `writeValueToDom` and `template.innerHTML = html` in `insertNormalizedHtml` are not XSS sinks; the clipboard path additionally strips `style/script/noscript/meta/link/title` from an inert `DOMParser` document. SSR looks sound (`trackKeyboardInset` bails without a `defaultView`, DOM wiring is behind `afterNextRender`). The tree-shaking architecture holds up: `RICH_TEXT_EDITOR_DOM_FEATURE` / `RICH_TEXT_EDITOR_TOOL` are the only routes to the opt-in domains, the `RICH_TEXT_EDITOR_TOKEN_CODEC` token imports its codec type-only, and `resolvedTools` correctly drops unprovided tokens and collapses the orphaned dividers around them. The docs page is accurate on the theming token tables (all 5 image/link/palette/badge tokens verified present in the matching `@property` blocks), the `ET25xx` error-code list, and all six `<StoryEmbed>` ids resolve to real exported stories; the uncommitted `et-scrollbar` retrofit is correctly documented and its CSS restructuring (moving the keyboard clearance from the tools onto the new dock so the scrollbar hangs above it) is right.

### Improvements

Ideas, not verified defects. Ranked within each category.

#### Features

1. **Ship a read-only viewer for stored editor values.** There is no way to render a saved Markdown value with the editor's own typography: the whole content stylesheet is nested inside `et-rich-text-editor { … .et-rte-content { … } }` (`rich-text-editor.component.css:62`, `:180-378`), so a consumer displaying a value elsewhere re-implements heading scale, list markers, quote bars, `pre` chrome and token chips by hand. The pieces already exist — `provideRichTextEditorTokenRendering` (`rich-text-editor-token-providers.ts`) exists precisely for display contexts, and `markdownToHtml` sanitizes — so an `<et-rich-text-editor-viewer [value]>` reusing a hoisted `.et-rte-content` styles-only component is mostly assembly. This is the largest gap relative to Material/PrimeNG, which both pair an editor with a renderer.

2. **A horizontal-rule tool is nearly free and round-trips today.** `markdownToHtml` already turns `---`/`***`/`___` into `<hr>` (`libs/core/src/lib/utils/markdown.ts:425`) and `htmlToMarkdown` turns it back (`:612`), but `RICH_TEXT_EDITOR_TOOLS` (`rich-text-editor-tools.ts:11-29`) has no token for it, `.et-rte-content` has no `hr` rule, and the `---` autoformat prefix is unimplemented. Every peer library ships this; here it is a tool definition, one CSS rule and one autoformat branch.

3. **A "clear formatting" tool.** `RICH_TEXT_EDITOR_TOOL_BUTTONS` (`rich-text-editor-tools.ts:111-177`) has no `removeFormat`, yet the DOM layer already exposes everything needed — `unwrapInline` per tag (`headless/internals/rich-text-editor-dom-inline-marks.ts:229`) and `replaceBlockTag(block, 'p')` (`…-dom-headings.ts:23`). Material, PrimeNG and TipTap all ship it, and it is the standard escape hatch after a messy paste.

4. **Auto-link the selection when a URL is pasted over it.** `pasteText` (`headless/rich-text-editor.directive.ts:628-649`) bails out entirely unless the token codec recognises something, and `pasteHtml` normalizes markup — so pasting `https://…` over selected words inserts the URL as text instead of linking the selection, which is the Notion/Slack/Google Docs behaviour users expect. The link domain is already reachable via `this.editorDom.links?.applyLink` when `provideRichTextEditorLinkTool()` is present.

5. **A markdown source-view toggle.** The canonical value already *is* Markdown (`value = model('')`, `headless/rich-text-editor.directive.ts:66`), so a "edit as Markdown" mode is a `<textarea>` bound to the same model plus `renderExternalValue()` on switch back — the history already resets on an external write (`:345-349`), so the two views cannot desync. Cheap relative to how often power users ask for it.

6. **Extend autoformat with typography rules only — and route every new rule through `isReserved`.** `--` → en dash, `...` → ellipsis, `->` → arrow and smart quotes are all safe because none of their trigger characters can be a token trigger. The reservation machinery already exists (`autoformatReservedChars` / `autoformatSuppressed`, `headless/rich-text-editor.directive.ts:227`, `:230`, consumed at `:417-425`), so the rule is: any new prefix keyed on a character a consumer might register — `#`, `@`, `/`, `:`, `[` — must take the `isReserved` predicate exactly like the `#{1,3}` and `>` branches do (`…-dom-autoformat.ts:76-81`), and the existing ```` ``` ```` branch should be brought in line (see the Low finding). Anything that wants a *popup* belongs in `RichTextEditorTrigger`, not in autoformat.

7. **Image sizing and captions could follow the alignment precedent.** Alignment already persists as an inline `text-align` style round-tripped as raw HTML (`tools/rich-text-editor-align-tool.component.ts:22-25`), which is the established answer to "Markdown has no syntax for this". Width on `<img>` and a caption below it are the two most-requested image features and would reuse the same escape hatch plus the existing image popover (`rich-text-editor-image-editor.component.ts`).

8. **Table column resizing.** `createTableOps` (`tools/rich-text-editor-table.util.ts:77-196`) covers insert/delete for rows and columns, and column-wide alignment already exists (`expandToColumns`, `…align-tool.component.ts:135`), but there is no way to size a column — the one table interaction users reach for immediately and the main gap versus PrimeNG/TipTap tables.

#### DX

1. **Putting an opt-in tool in `tools` without its provider fails completely silently.** `resolvedTools` drops any token with no definition and collapses the orphaned dividers (`headless/rich-text-editor.directive.ts:124-139`) — deliberate and correct for the default set, but it means `[tools]="['bold', 'blockquote']"` with no `provideRichTextEditorBlockquoteTool()` renders one button and no diagnostic. The imperative path already does this well: `missingDomFeature` names the exact provider to add (`:41-45`). A dev-mode warning from `resolvedTools` reusing the same token→provider table would close the loop, and would also catch typos, which `RichTextEditorTool`'s `(string & {})` escape hatch (`rich-text-editor-tools.ts:38`) makes free to write.

2. **There is no rich-text-editor test driver, and the specs pay for it.** `headless/internals/rich-text-editor-dom.spec.ts:26-77` hand-rolls `setup()`, `select()` and `selectByTextOffsets`, and `headless/rich-text-editor.directive.spec.ts:224-244` hand-rolls a near-identical `write()` — the same primitives, duplicated. The repo is mid-way through a driver pass (recent commits: "Drive the dropzone specs through a driver", "Drive the remaining ARIA and field control specs through drivers"); a `RichTextEditorDriver` exposing `type`, `caretAt`, `selectText`, `pressKey`, `paste` and `value()` is the single highest-leverage piece of missing test infrastructure in this domain, and would make the untested files below cheap to cover.

3. **The "batteries included" setup spans three unrelated mechanisms.** A full-featured editor needs `provideRichTextEditorDefaultTools()` + `provideRichTextEditorLinkEditor()` + `provideRichTextEditorFloatingToolbar()` + `provideRichTextEditorImageTool({…})` + `provideRichTextEditorTableTool()` + `provideRichTextEditorAlignmentTool()` in `providers`, plus `RICH_TEXT_EDITOR_IMPORTS` and `RICH_TEXT_EDITOR_TRIGGERS_IMPORTS` in `imports`, plus the `[etRichTextEditorTriggers]` attribute in the template. The tree-shaking rationale is sound and documented, but a single `provideRichTextEditor({ tools: [...] })` that derives the domain providers from the requested tokens would collapse the common case to one call while leaving the granular providers for consumers who want them.

4. **`RichTextEditorLabels` is one flat 60-key type shared by editor, link editor, image popover, table menu and language switcher.** Every consumer localizing only the toolbar still faces the whole surface (`rich-text-editor-labels.ts:15-144`). Grouping it (`labels.link.*`, `labels.table.*`, `labels.image.*`) or letting opt-in tools contribute their own label slices alongside their providers would keep the set proportional to the features actually enabled — and would have made the missing "has content"/"empty" keys (Medium finding) obvious.

5. **`onFailure` is the image tool's only feedback channel and it cannot address the placeholder.** `RichTextEditorImageFailure` (`tools/rich-text-editor-image-upload.ts:21-28`) carries `file`/`reason`/`error`/`message` but no handle on the placeholder element or a retry, so a consumer cannot offer "try again" — the placeholder just removes itself after `FAILURE_VISIBLE_MS` (`tools/rich-text-editor-image.provider.ts:24`, `:209-221`). Handing the callback a `{ retry() }` would make failed uploads recoverable, which is what the dropzone's own upload handle already supports (`execute()` is documented as "the initial upload **and retries**").

6. **Mark the `@floating-ui/dom` type imports as type-only, matching the codec token's own precedent.** `import { VelementElement }`-style value syntax is used for the type-only `VirtualElement` in three files (`headless/rich-text-editor-triggers.directive.ts:24`, `headless/rich-text-editor-link-editor.directive.ts:9`, `headless/rich-text-editor-floating-toolbar.directive.ts:12`), while `rich-text-editor-token-codec.token.ts:2-4` goes out of its way to comment *why* its import must stay type-only. TS elides these today, but the explicit `import type` makes the tree-shaking contract legible rather than incidental.

#### Bundle size

1. **Three opt-in tools' icons ship with every editor.** `rich-text-editor.component.ts:75-88` registers twelve icons eagerly, including `LINK_ICON`, `QUOTE_ICON` and `CODE_BLOCK_ICON` — but link, blockquote and code-block are *opt-in providers* (`tools/rich-text-editor-link.provider.ts`, `…blockquote.provider.ts`, `…code-block.provider.ts`), so an editor with only marks and lists still pays for all three. The pattern to copy already exists twice in this folder and its comments say exactly this: `RichTextEditorImageToolComponent` exists "so the tool's icon is registered here rather than in the editor's own `provideIcons`" (`tools/rich-text-editor-image-tool.component.ts:11-13`), and the table/align/heading tools do the same. Moving those three icons onto their providers' control components is a mechanical change with a measurable win.

2. **Split the content stylesheet by feature, the way the image and table tools already do.** `rich-text-editor.component.css` is 380 lines injected on first editor instantiation, and roughly 70 of them serve opt-in features: the blockquote rules plus their two `@property` blocks (`:32-42`, `:325-337`), the fenced-code rules plus `--et-rich-text-editor-code-block-radius` (`:44-48`, `:339-357`), and the token-chip rules plus their two properties (`:50-60`, `:359-377`). AGENTS.md's "Splitting a large stylesheet" section prescribes exactly this, and the domain already has two working examples — `mountRichTextEditorImageStyles()` called from the image provider (`tools/rich-text-editor-image.provider.ts:110`) and `mountRichTextEditorTableStyles()` from the table provider (`tools/rich-text-editor-table.provider.ts:24`). Blockquote, code-block and the token codec are the next three candidates, each mounted from its own provider.

3. **Deduplicate the detached-overlay boilerplate across four panels.** `RichTextEditorLinkEditorComponent`, `RichTextEditorImageEditorComponent`, `RichTextEditorTokenPopupComponent` and `RichTextEditorFloatingToolbarComponent` each carry a byte-identical constructor: `inject(AutoSurfaceDirective).matchOverlaySurface()` plus an `effect` re-syncing `COLOR_PROVIDER` through the portal boundary (`rich-text-editor-link-editor.component.ts:78-90`, `rich-text-editor-image-editor.component.ts:65-75`, `rich-text-editor-token-popup.component.ts:71-83`, `rich-text-editor-floating-toolbar.component.ts:63-77`), each with its own copy of the explanatory comment. One `injectDetachedOverlaySurface()` helper (or a shared host directive) would delete four copies of the same six lines and four copies of the same comment.

4. **The horizontal scrollbar is a static import for a touch-only affordance.** `ScrollbarComponent` is in the base component's `imports` (`rich-text-editor.component.ts:71`) but only ever visible under `.et-rich-text-editor--touch` (`rich-text-editor.component.css:139-153`). ng-packagr flattening means a same-entry-point `@defer` cannot split it (AGENTS.md, "query-devtools: why three entry points"), so the bundle cost is unavoidable in-lib — but see the Medium finding for the instantiation cost, which an `@if (hasTouchInput())` does fix.

#### UI/UX

1. **The docked mobile toolbar can cover the bottom of the content it is editing.** On touch the dock is `position: fixed; inset-block-end: 0` (`rich-text-editor.component.css:111-115`) while `.et-rte-content` gets only the field's normal `padding-block` (`:197`) — nothing reserves the bar's height, so with the keyboard up the last line(s) of a long document sit behind the bar. `scroll-padding-block-end` on the scroll container, or a spacer sized from the same measured inset the dock already publishes as `--_et-rte-keyboard-inset`, would fix it with the machinery that is already there.

2. **Backspace does not revert an autoformat conversion.** Typing `# ` then Backspace is universal muscle memory for "no, I meant a literal hash" — in TipTap, Notion, Slack and Google Docs it un-converts the block. Here autoformat commits a boundary history entry (`headless/rich-text-editor.directive.ts:427`) so Ctrl+Z works, but Backspace falls through to `handleBackspace`'s empty-block handling (`…-dom-keymap.ts:25-79`). Routing an immediately-following Backspace to `undo()` would be a few lines and removes the single most common autoformat annoyance.

3. **No "paste as plain text".** `interceptPaste` always prefers `text/html` when the clipboard carries it (`rich-text-editor.component.ts:311-318`), and Ctrl/Cmd+Shift+V is not handled explicitly — so on platforms where the browser still supplies `text/html` for a plain-text paste, the user cannot strip formatting. Checking the modifier on the preceding keydown (or offering it from the toolbar) is the conventional answer.

4. **A dropped or pasted file is refused with no feedback whatsoever.** Without the image tool, `interceptDrop` and `interceptPaste` silently `preventDefault()` a file payload (`rich-text-editor.component.ts:305-309`, `:341`) — deliberately, since the browser would embed a dying `blob:` URL, and the comment says so. But from the user's side nothing happens at all. A `rejectedPayload` output (or reusing the image tool's `onFailure` channel) would let the app say "images aren't supported here".

5. **The table menu gives no indication which cell it will act on.** `refreshContext()` snapshots the caret's `TableContext` when the trigger is pressed (`tools/rich-text-editor-table-tool.component.ts:91-95`) and the menu then offers "Insert row above"/"Delete column" — but nothing highlights the target row/column, and `mutate` falls back to a *fresh* context if the snapshot is null (`:243`). Outlining the active row and column while the menu is open would make destructive entries safe to trust.

6. **The selection toolbar is invisible to the keyboard, and its ARIA role over-promises.** Every button is `tabindex="-1"` with no roving-tabindex handling (`rich-text-editor-floating-toolbar.component.html:18`) under a `role="toolbar"` host (`rich-text-editor-floating-toolbar.component.ts:34`). Since it is explicitly a pointer-only enhancement (`headless/rich-text-editor-floating-toolbar.directive.ts:34-36`), `role="group"` is the honest label — or, better, a shortcut that moves focus into it, at which point the role becomes true.

7. **History granularity is hardcoded.** `COALESCE_WINDOW_MS = 500` and `MAX_ENTRIES = 100` (`headless/internals/rich-text-editor-history.ts:17`, `:21`) are reasonable defaults but unreachable from outside — a long-form editor wants more depth, a comment box less. Threading them through `provideRichTextEditorTools`-style config would cost nothing.

8. **The token popup has loading, empty and error states; the editor itself has none.** `rich-text-editor-token-popup.component.html` handles all three carefully (progress bar over stale results, centered error card, fixed-height empty box) — a good pattern that has no counterpart for the editor when a value is still being fetched. A `loading` input rendering a skeleton over `.et-rte-content` would match how the rest of the library treats async values.

#### Testing

1. **Unit-test `resolveTriggerMatch` first.** It is 40 lines of pure function (`headless/internals/rich-text-editor-trigger-detection.ts`) with zero tests, and it is where High finding #2 lives — the caret-at-offset-0 case is a three-line test. Word-boundary rejection (`user@domain`), `allowSpaces`, and nearest-char-wins with two triggers are all equally cheap and equally uncovered.

2. **Build the `RichTextEditorDriver` before the next spec pass.** See DX #2 — the three untested high-value files (`rich-text-editor.component.ts`'s keydown/paste chain, `rich-text-editor-triggers.directive.ts`, `rich-text-editor-table-tool.component.ts`) all need the same "type, move the caret, press a key, read the value" primitives that two existing specs already reimplement separately.

3. **Add a Markdown round-trip property test over a content corpus.** `htmlToMarkdown(serialize(markdownToHtml(md)))` should equal `md` for a fixture list covering headings, nested lists, quotes, fences, links, tables, alignment and token chips. This class of test is what catches the empty-shell corruption in High finding #1 generically, rather than one tag at a time, and it is the cheapest guard against the DOM layer drifting from the value model.

4. **Cover the multi-language domain at all.** It currently has no spec file. Priority order: `activeLanguage`'s `linkedSignal` fallback when the active code is removed from `languages` (`headless/multi-language-rich-text-editor.directive.ts:31-38`), `writeActiveMarkdown` preserving codes that are *not* in `languages` (`:65-69` — an explicitly documented guarantee), the dev-mode duplicate/empty throws (`:73-90`), and the exported `requiredLanguages` validator (`multi-language-rich-text-editor-validators.ts`), which is public API with zero coverage.

5. **Marble-test `trackTriggerItems`.** Debounce, the "keep previous results while a same-trigger request loads" `scan`, the reset on trigger switch, and the error passthrough (`headless/internals/rich-text-editor-trigger-source.ts:88-128`) are all timing behaviour that no test touches.

6. **Replace the `Subject` fake in `rich-text-editor-trigger-with-query.spec.ts` with a replaying one.** The real `executionState.asObservable()` replays its current value (`libs/query/src/lib/http/observable-signal.ts:17`); the spec's bare `Subject` does not, which is exactly why the stale-results Medium is invisible to it. A `BehaviorSubject` (or the `query/testing` fakes) would model the actual contract.

---
