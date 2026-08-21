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
| 4 | forms/form-field + input + textarea + masked-input + form + description | 6.8k | opus | done — 1 high / 6 medium / 12 low |
| 5 | forms/selection-list + choice-field + checkbox + switch + rating + selection-card | 5.4k | opus | done — 4 high / 4 medium / 11 low |
| 6 | forms/slider + dropzone + color-input | 7.6k | opus | done — 3 high / 7 medium / 12 low |
| 7 | forms/phone-input + otp-input + tag-input + forms/testing | 3.9k | opus | done — 3 high / 10 medium / 13 low |
| 8 | table | 10.7k | opus | done — 3 high / 8 medium / 12 low |
| 9 | overlay | 7.5k | opus | done — 2 high / 8 medium / 10 low |
| 10 | stream | 6.9k | opus | done — 4 high / 10 medium / 15 low |
| 11 | bracket | 7.9k | opus | done — 3 high / 8 medium / 12 low |
| 12 | scheduler | 5.4k | opus | done — 3 high / 8 medium / 12 low |
| 13 | grid + masonry | 4.5k | opus | done — 5 high / 8 medium / 15 low |
| 14 | menu + command-palette + toggletip + tooltip | 5.5k | opus | done — 4 high / 9 medium / 10 low |
| 15 | carousel + scrollable + scrollbar | 5.2k | opus | done — 5 high / 8 medium / 20 low |
| 16 | calendar + time-picker | 4.0k | opus | done — 4 high / 6 medium / 9 low |
| 17 | notification + tabs + accordion + tree | 5.6k | opus | done — 3 high / 12 medium / 20 low |
| 18 | match + standings | 2.6k | sonnet | done — 0 high / 3 medium / 3 low |
| 19 | button + chip + badge + avatar + banner + card + divider | 3.4k | sonnet | done — 1 high / 3 medium / 3 low |
| 20 | icon + picture + skeleton + loader + empty-state | 3.4k | sonnet | done — 1 high / 1 medium / 3 low |
| 21 | pagination + breadcrumb + progress-steps + timeline + kbd + toolbar + description-list + copy-button + focus-ring | 3.2k | sonnet | pending |
| 22 | query-error + filter-overlay + floating-action + testing + internals | 2.0k | sonnet | done — 1 high / 1 medium / 2 low |

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

## forms/date-time (date, date-range, time, time-range, date-time, date-time-range, duration)

Scope: `libs/components/src/lib/forms/date-time/**` (all `.ts`/`.html`/`.css` + specs), docs
`apps/docs/components/date-time-inputs.md` (+ cross-checks in `error-codes.md`).

Runtime verification was done with a throwaway spec in the domain folder, run as
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`
(note: `--config libs/components/vite.config.mts` fails - the path is resolved relative to
`--root`). The scratch file was deleted; `git status` for `libs/components` and `apps/docs` is
clean.

### High

- **An unedited focus+blur silently rewrites the wire value of `et-date-input` and
  `et-time-input`, destroying every unit the display format does not carry.**
  `internals/date-picker-input-field.directive.ts:128-138` (`handleBlur`) always calls
  `commitInput(commitText())`, and neither `date-input/headless/date-input.directive.ts:113-156`
  nor `time-input/headless/time-input.directive.ts:93-133` has the
  "nothing was typed" guard its siblings have
  (`date-time-input/headless/date-time-input.directive.ts:225`,
  `internals/date-range-picker-input.directive.ts:370`: `if (raw === this.displayValue()) return;`).
  So blurring re-parses the *displayed* text and writes it back. With the shipped defaults this
  loses data: `DATE_FORMAT` is `yyyy-MM-dd'T'HH:mm:ssxxx` (carries a time) while the date input's
  default `displayFormat` is `'P'` (date only), and the docs themselves recommend
  `provideTimeFormat('HH:mm:ss')` (`date-time-inputs.md:80`) against a `'p'` display format.
  It also marks the form dirty/touched with no user edit.
  **Runtime-verified**: value `2026-08-22 14:30` (`valueFormat="yyyy-MM-dd HH:mm"`) → focus, blur,
  no typing → `2026-08-22 00:00`. Time input `14:30:45` (`valueFormat="HH:mm:ss"`) → `14:30:00`.
  The date-time input under the same test kept `2026-08-22 14:30:45` (its guard fires).

- **Six of the seven controls cannot be given an accessible name: `aria-label` /
  `aria-labelledby` are not inputs, so the attribute stays on the wrapper and the native
  `<input>` stays unnamed - silently in production, with an unfixable `ET2201` in dev.**
  `internals/date-picker-input.directive.ts` and `internals/date-range-picker-input.directive.ts`
  declare no `ariaLabel`/`ariaLabelledby` input and never report `hasCustomAccessibleName`
  (contrast `duration-input/headless/duration-input.directive.ts:52-56,91`, which does both).
  The form field's guard (`forms/form-field/headless/form-field.directive.ts:205-214`) therefore
  throws for any of them used without a projected `et-label`. Worse for the ranges: their
  registered control view (`internals/date-range-picker-input.directive.ts:225-243`) omits
  `hasCustomAccessibleName`, so a range whose two fields *are* named via
  `startAriaLabel`/`endAriaLabel` still throws. The docs promise the opposite
  (`date-time-inputs.md:569-572`: "A field … takes `aria-label` (or `aria-labelledby`) on the
  control itself - `[attr.aria-label]` would land on the wrapper and leave the native field
  unnamed, which throws ET2201").
  **Runtime-verified** (each inside `<et-form-field>` with no `et-label`):
  `<et-date-input aria-label="Date of birth">` → `ET2201` thrown **and** the inner input's
  `aria-label` is `null` (the attribute sits on `ET-DATE-INPUT`);
  `<et-date-range-input startAriaLabel="From" endAriaLabel="To">` → inputs correctly named
  `"From"`/`"To"` but `ET2201` still thrown; `<et-duration-input aria-label="Lap time">` → no
  throw, input named. In a production build nothing throws, so the failure is a silently
  unnamed date field.

- **Erasing unparseable text leaves `parseError` latched on, so an empty field keeps a
  validation error and `aria-invalid="true"` forever.** The same guard as above is the cause:
  after a failed parse the value is `null`, so `displayValue()` is `''`
  (`date-time-input/headless/date-time-input.directive.ts:173-200`), and the user's clearing blur
  arrives as `raw === '' === displayValue()` → `date-time-input.directive.ts:225` (and
  `internals/date-range-picker-input.directive.ts:370` for all three ranges) returns before the
  `if (!raw.trim())` branch that would reset `parseError`. `shouldDisplayError()` stays true, so
  `form-field.component.ts:183` keeps rendering `parseErrorMessage` under an empty field; the
  only escape is typing something that parses.
  **Runtime-verified**: type `not a date`, blur, erase, blur → `parseError: true`, field `""`,
  `inputText: ""` for `et-date-time-input`, `et-date-range-input` and
  `et-date-time-range-input`. `et-date-input` (no guard) correctly ends at `parseError: false`.

- **The clear (×) button does not reset an attached typing mask, so the erased text comes back
  on the next blur - with a parse error.** `internals/date-picker-input.directive.ts:213-231`
  (`clearValue`) and `internals/date-range-picker-input.directive.ts:410-426` (`clearRange`) reset
  `value`/`inputText`/`parseError` and blank the element, but the mask host's text lives in the
  field's `value` linkedSignal (`internals/date-picker-input-field.directive.ts:48-56`,
  `internals/date-range-picker-input-field.directive.ts:63-71`) whose computation reads only
  `parseError()`, `inputText()` (when erroring) and `displayValue()`. While the user is
  mid-entry none of those change on a clear (`displayValue` was already `''`, `parseError`
  already `false`), so the linkedSignal keeps the mask-written override, and `commitText()`
  (`date-picker-input-field.directive.ts:166-168`) hands that stale text to the next commit.
  **Runtime-verified** (`et-date-input`, `mask`, `displayFormat="dd.MM.yyyy"`): type `1807`
  (field `18.07.____`) → `clearValue()` → field `""`, `hasValue: false` (the × disappears, it
  looks cleared) → blur → field `"18.07."`, `parseError: true`, value `null`. Clearing a fully
  committed value is unaffected (the source does change), so the bug only bites mid-entry -
  which is exactly when the clear button is most used.

### Medium

- **The duration input never drops `inputText` after a successful commit, so `hasValue()` stays
  true once the value is reset from outside.** `duration-input/headless/duration-input.directive.ts:143`
  sets `inputText` to the raw text on *every* commit, including the successful one (all six
  date/time controls set it back to `''` instead), and `hasValue`
  (`duration-input.directive.ts:81`) reads it. After a programmatic reset the field is empty but
  the form field still floats its label (`form-field.directive.ts:158`
  `shouldFloatLabel = focused || expanded || hasValue`) and still offers the clear button.
  **Runtime-verified**: type `130`, blur (value `90000`), then `value.set(null)` → field `""`,
  `displayValue: ""`, `inputText: "130"`, `hasValue: true`.

- **`parseDuration` accepts unit letters but ignores what they mean, so `1h30m` commits 90 000 ms
  instead of 5 400 000 ms.** `duration-input/headless/internals/duration-format.ts:114` allowlists
  `hHmMsS` in the input, then line 112 splits on `\D+` and lines 120-128 map the digit groups
  positionally onto the trailing segments. Under the default `mm:ss` that reads `1h30m` as
  1 min 30 s - a plausible entry silently committing a value 60× too small. Either reject letters
  or honour them.

- **A readonly date/time control still commits on blur.** `commitInput`
  (`date-input.directive.ts:113`, `time-input.directive.ts:93`, `date-time-input.directive.ts:222`)
  and `commitSide` (`internals/date-range-picker-input.directive.ts:367`) have no
  `interactive()` check, unlike `duration-input.directive.ts:137-139` which returns early when
  disabled or readonly. A readonly input is still focusable, so tabbing through one runs a full
  commit: it sets `touched`, and on `et-date-input`/`et-time-input` it also triggers the value
  rewrite above - a readonly field mutating its own value.

- **The date/time mask hosts do not implement the optional `mixed` member of `InputMaskHost`,
  so all of the mask's mixed handling is dead code for this family.**
  `masked-input/headless/input-mask-host.ts:16-21` declares it and
  `input-mask.directive.ts:129-135,152-164,229-241` branches on `host.mixed?.()`;
  `input/headless/input.directive.ts:21` (the plain text input) satisfies it, but
  `internals/date-picker-input-field.directive.ts:34-62` and
  `internals/date-range-picker-input-field.directive.ts:44-77` expose only
  `value`/`focused`/`nativeControl`. Consequences: focusing a masked field while `mixed` paints
  the guide (`__.__.____`) instead of leaving the mixed label showing through the placeholder,
  which `date-time-inputs.md:553-558` and the `mixedLabel` JSDoc both describe as "the field
  stays empty and the label shows through the placeholder slot"; and the mask's "first keystroke
  replaces the hidden value and resolves mixed" contract never applies here (the control resolves
  it on the commit instead). No value leaks, because `displayValue` already masks.

### Low

- **Dev-time messages and the error-code docs name only four of the six picker hosts.**
  `picker/date-picker-trigger.directive.ts:35` and `picker/date-picker-surface.directive.ts:25`
  list `[etDateInput]` / `[etDateRangeInput]` / `[etTimeInput]` / `[etDateTimeInput]`, omitting
  `[etTimeRangeInput]` and `[etDateTimeRangeInput]`, and `apps/docs/components/error-codes.md:108-109`
  repeats the same four. A time-range consumer is told to move the trigger into a host that is not
  theirs. (`DATE_INPUT_ERROR_CODES.MISSING_SURFACE` is also thrown for all six from
  `internals/date-picker-overlay.ts:82` - correct per the shared 3000-3099 block, worth a docs note.)
- **Docs list `pickerTriggerLabel` as `string` with a hardcoded default** for the time input
  (`date-time-inputs.md:272`) and the date-time input (`:390`); both are `string | null`
  defaulting to `null` and resolving through `DATE_TIME_LABELS`, as the date input's own row
  (with footnote ¹) correctly says.
- **Undocumented public inputs**: the date-time input table (`date-time-inputs.md:374-392`) omits
  `weekNumbers`, `parseErrorMessage` and `clearable`/`clearLabel`, all of which exist
  (`date-time-input.component.ts:96-103`, `date-time-input.directive.ts:50,79`); the duration table
  (`:529-534`) omits `parseErrorMessage`, `clearable` and `clearLabel`.
- **Comment policy: the same explanation is repeated at every call site.** The
  `// only while the field is in use - mirrors the select's clear affordance` comment sits on
  `showClear` in all seven components (e.g. `date-input.component.ts:90`,
  `time-input.component.ts:95`, `duration-input.component.ts:53`) and the identical three-line
  "pointer-only, out of the tab order …" HTML comment in six templates (e.g.
  `date-input.component.html:10-12`). AGENTS.md ("Always delete → The same explanation at every
  call site") asks for one home for it.
- **`durationFormat=""` (or any format with no `h`/`m`/`s`/`S` run) silently bricks the control**:
  `deriveDurationFormatSpec` (`duration-format.ts:30-61`) returns empty `segments`,
  `parseDuration` then always returns `null` (`:108`) and `formatDuration` always `''`, so every
  entry is a parse error with no dev-mode warning - unlike the refused mask pattern, which does warn.
- **`warnedAboutMissingDateLocale` is a module-level latch** (`date-time-formats.ts:49`), so only
  the first injector in the process is ever warned about a missing `DATE_LOCALE`; a second app or a
  lazily created injector with a different locale stays silent.
- **Range field registration has no duplicate guard**: `registerField`
  (`internals/date-range-picker-input.directive.ts:429-431`) overwrites the slot silently, while the
  single inputs go through `registerSingleton` (`date-input-field.directive.ts:27`), which reports a
  second registration. Two `side="start"` fields in a custom range template fight without a word.
- **`time-range-input.component.html:50` feeds the time picker `rangeInput.calendarRange()`** - a
  calendar-named accessor on a control that has no calendar. Naming only; the value is right.
- **`referenceDate` is captured once at construction** in `TimeInputDirective` (`:54`) and
  `TimeRangeInputDirective` (`:69`), so in a long-lived app the day the parsed times sit on is the
  day the control was created. Harmless for `HH:mm` wire values, but `timeFilter` is documented as
  receiving "the full candidate timestamp" and will see a stale day across midnight.
- **`localReadingIdCounter`** (`date-time-input.directive.ts:24`,
  `date-time-range-input.directive.ts:27`) ties element ids to instantiation order, so an SSR page
  whose client order differs hydrates a mismatched `aria-describedby` target.

### Spec coverage

Well covered: the parsing/formatting internals each have a focused spec (`date-value`,
`time-parse`, `date-time-parse`, `display-format-mask`, `precision-format`, `pending-date-time`,
`time-zone`, `duration-format`); every control has a directive spec covering strict/lenient
commits, Enter-commit, parse errors, prefilled display, picker open/close, Alt+ArrowDown, the
disabled trigger and a `mixed` block; `date-input` and `date-range-input` have thorough mask
suites; `date-time-input` and `date-time-range-input` have time-zone suites and component specs
for the bottom-sheet panes; six of the seven run `describeMixedStateContract`.

Gaps that map directly onto the findings above:
- **No spec ever uses a `valueFormat` finer than its `displayFormat`.** Every host is
  `valueFormat="yyyy-MM-dd"`, `"HH:mm"` or a matching combined format, which is why the
  unedited-blur rewrite (High #1) is invisible. `date-time-input`'s own spec host uses
  `yyyy-MM-dd HH:mm` and is protected by its guard.
- **No spec erases unparseable text** (High #3): `date-time-input.directive.spec.ts:99-106`
  ("clears the value on empty input") only empties a *successfully committed* field.
- **No spec clears through `clearValue()`/`clearRange()` while a mask is attached** (High #4);
  the mask suites only cover delete-all + blur (`date-input.directive.spec.ts:458-480`).
- **No spec in this domain renders a control inside `et-form-field`**, so nothing covers label
  wiring, `aria-labelledby`, `ET2201` or the floating label (High #2, Medium #1).
- Zero direct tests for `date-picker-panel.component.ts`, `internals/date-time-panes.directive.ts`
  (ResizeObserver + translateY compensation, the most timing-sensitive code here) and
  `internals/date-picker-overlay.ts`.
- `duration-input` has no `describeMixedStateContract` run and no `clearValue` spec (the two
  controls' behaviours its bug touches); `time-input`/`time-range-input` have no `clearValue`
  spec either (only `date-input` and the ranges do).
- No existing spec asserts a behaviour I believe to be wrong.

Clean: all eight stylesheets are wrapped in a single `@layer components`, contain no Tailwind, and
resolve every colour from `--et-surface-*` / `--et-theme-color-*` tokens (the `rgb(...)` literals
are fallbacks inside `var()`, and the panel's `box-shadow: 0 10px 24px rgb(0 0 0 / .16)` matches
every other panel in the lib). State is signals throughout - no `BehaviorSubject`, no
subscribe-and-assign, the only RxJS is inside the shared anchored-panel controller; all controls
are `FormValueControl` (signal forms), not `ControlValueAccessor`. `DateTimePickerPanesDirective`
disconnects its observer and cancels its animations on destroy, and its `no-native-observers` /
`no-dom-query` escapes are justified in place. The time-zone layer (`TZDate`, `zonedProxy` for
highlighting only, `instantFromZonedFields` for commits) is coherent and matches the docs' DST
caveat, and the half-pick machinery (`pending-date-time.ts`, `renderPartialDateTime`,
`splitDateTimeFormat`) is both sound and well specified. All seven control types are present in
`usesTextFieldShell`, error codes stay inside the documented 3000-3099 block, every
`<StoryEmbed>` id in the guide resolves to a real story export, and the narrow-stacking,
precision, `timeZone` and pane-advance behaviours the docs describe all match the code.

### Improvements

Ideas, not verified defects. Ranked within each category.

#### Features

- **Ship the range-order and min/max validators the docs make every consumer hand-write.**
  `date-time-inputs.md:242-249`, `:344-349` and `:494-511` all say "ordering is not enforced - that
  is a validator's job" and then print the same `validate(s.range, …)` body three times, and the
  bounds sections say the same about `minDate`/`maxDate`/`minTime` ("bounds shape the picker …
  pair them with a schema validator"). Exporting `dateRangeOrder()`, `timeRangeOrder()`,
  `minDate()`/`maxDate()` signal-forms rules next to `DATE_TIME_LABELS` would turn four documented
  copy-paste recipes into one import, and they can reuse `internals/date-value.ts`'s parser so they
  agree with the control's own `valueFormat`.
- **Preset ranges in the range picker panel.** The date range input already has the two
  reporting-filter features that presets belong with (`rangeSelectionStrategy`,
  `comparisonStart`/`comparisonEnd` - `date-range-input.directive.ts:58-65`), but there is no way to
  offer "Last 7 days" / "This month"; every peer lib (PrimeNG, AntD, shadcn's date-range recipes)
  ships them. The surface is already a public extension point
  (`picker/date-picker-surface.directive.ts`), so this could be a `DatePickerPresetsDirective`
  projected into `et-date-picker-panel` rather than new inputs on six controls.
- **Arrow-key stepping on the field.** `internals/date-picker-input-field.directive.ts:140-163`
  handles exactly two keys (Enter, Alt+ArrowDown); a native `<input type="date">`, AntD and Ark all
  step the segment under the caret with ArrowUp/ArrowDown (and PageUp/PageDown for the coarser
  unit). With `maskPattern` (`internals/display-format-mask.ts`) the slot boundaries are already
  known, so the segment under the caret is derivable - this is the single most-missed affordance of
  a typed date field.
- **A "Today"/"Now" action in the picker panel.** Nothing in the panel jumps to the current
  day/time; `startAt` only sets the opening month. One action row in `et-date-picker-panel` would
  serve all six controls, and the date-time input's half-pick machinery
  (`internals/pending-date-time.ts`) already knows how to commit both halves at once.
- **`'week'` / `'quarter'` precision.** `CalendarPrecision` stops at `day | month | year`
  (`internals/precision-format.ts:16-26`), yet the calendar already renders week numbers
  (`weekNumbers`) and reporting filters ask for ISO weeks and quarters as often as months.
- **A confirmation mode (`Apply`/`Cancel`) for the pickers.** Every pick commits straight into the
  form value (`selectDate`, `selectTime`, `writeRange`); Material ships
  `mat-datepicker-actions` for the "don't touch my model until I confirm" case, which matters most
  for the date-time controls where one interaction is two half-picks.

#### DX

- **Fold the two abstract bases into one core.** `internals/date-picker-input.directive.ts` and
  `internals/date-range-picker-input.directive.ts` are ~90% the same file (identical standard
  control inputs, `mask`/`maskPattern`, overlay wiring, `describedByIds`, `labelId`, `interactive`,
  `shouldDisplayError`, form-field registration, the dev-mode mask warning - both even carry the
  same comments). Three of the four High defects above exist *because* a behaviour lives in only one
  of the two copies. A shared `createPickerInputCore()` (or a common base with a per-side state map)
  would make the guard, the clear path and the readonly check single-sourced.
- **Warn in dev when `displayFormat` carries fewer units than `valueFormat`.** This is the sharpest
  edge in the public API (see High #1): the shipped `DATE_FORMAT` carries a time while the date
  input shows `'P'`, and every commit truncates. The domain already has the machinery to detect it -
  `internals/date-time-format-split.ts` classifies tokens as date/time and
  `internals/display-format-mask.ts` walks token runs - so a one-time `console.warn` next to the
  existing mask warning (`date-picker-input.directive.ts:189-198`) would surface it at authoring time.
- **Give the six picker controls the duration input's naming API.**
  `duration-input.directive.ts:52-56,89,91` shows the whole pattern (`aria-label`/`aria-labelledby`
  inputs, `labelId` preferring the author's ids, `hasCustomAccessibleName`); lifting it into the two
  bases fixes High #2 and removes the only reason these controls cannot be used in a dense row.
- **A duration-input test driver.** `forms/testing/` has a driver for sixteen controls (and
  `date-picker-driver.ts` covers the six picker controls) but none for the duration input, so
  `duration-input.directive.spec.ts` hand-rolls TestBed, `dispatchEvent` and element lookups.
  While there: the masked-typing helper loop is copy-pasted between
  `date-input.directive.spec.ts:363-390` and the date-range mask suite - it belongs on the driver
  as `typeMasked()`.
- **Derive the trigger/surface dev errors from the host instead of hardcoding four names.**
  `picker/date-picker-trigger.directive.ts:35` and `picker/date-picker-surface.directive.ts:25`
  enumerate `[etDateInput] / [etDateRangeInput] / [etTimeInput] / [etDateTimeInput]`, which has
  been wrong since the two newer range controls landed; the message only needs to say "a
  `DATE_PICKER_HOST`" and point at the docs.
- **`clearable` is per-styled-component boilerplate.** All seven components re-declare
  `clearable`/`clearLabel` plus an identical `showClear` computed and `handleClearClick`
  (e.g. `date-input.component.ts:75-103`, `time-input.component.ts:80-108`). A
  `ControlClearAffordanceDirective` (or a helper returning `{ showClear, clear }`) would delete the
  same 15 lines seven times and keep the touch/pointer rules in one place.

#### Bundle size

- **Stop dragging the optional `@date-fns/tz` peer into the zone-less controls.**
  `internals/time-zone.ts:1` statically imports `TZDate`, and
  `internals/date-range-picker-input.directive.ts:26` imports `formatInZone`/`reinterpretInZone`/
  `zonedProxy` from it for *all three* ranges - including `et-date-range-input` and
  `et-time-range-input`, whose `effectiveTimeZone` is a constant `signal(null)`
  (`date-range-picker-input.directive.ts:141`). Since `@date-fns/tz` is declared optional
  (`libs/components/package.json:27-29`), an app that installs `date-fns` alone and uses only a
  date range input has an unnecessary hard dependency. Routing the zone helpers through the two
  date-time controls (or a tiny injected strategy) both removes the import and honours the
  "optional" contract.
- **Add treeshake goldens for this family.** `tools/treeshake/goldens.json` guards
  `form-field-input`, `select` and five table entries but nothing date-related, even though
  `DATE_INPUT_IMPORTS` pulls the whole calendar and `DATE_TIME_INPUT_IMPORTS` additionally pulls
  the time picker, the segmented button group and the overlay strategies. Three entries
  (`date-input`, `date-time-input`, `duration-input`) would bound the family's cost and make any
  future regression reviewable.
- **De-duplicate the two range stylesheets.** `date-range-input.component.css` and
  `time-range-input.component.css` are byte-identical apart from the class prefix and the stacking
  threshold (`diff` shows only name/number hunks: `13em` vs `11em`), and the two date-time range
  sheets repeat the same shell again. One shared range-shell stylesheet driven by a
  `--et-range-input-stack-threshold` custom property removes ~120 duplicated lines across four
  files, in the spirit of AGENTS.md's styles-only components.
- **Move the duration input onto the shared suffix stack.** It is the only one of the seven that
  does not use `<ng-template etControlSuffix>`, and it therefore re-implements the clear button in
  `duration-input.component.css:39-90` - the same rules, animations and reduced-motion guard that
  `forms/form-field/form-field-control-suffix-styles.component.css` already ships as a styles-only
  component. Switching it deletes ~50 lines of CSS and makes the affordance consistent (it would
  also inherit the readonly/disabled suffix handling at `:95-96` for free).

#### UI/UX

- **There is no keyboard path to clearing a value.** All seven templates render the × with
  `tabindex="-1"` and the comment "keyboard users clear by erasing the text" - which for a range
  means selecting and erasing two fields, and for a masked field means fighting the guide. A
  focusable clear when `clearable` is set, or an `Escape`-clears-the-field rule on the fields
  themselves, would close a real gap; at minimum the a11y section
  (`date-time-inputs.md:560-580`) should say the button is pointer-only.
- **The half-picked state is visual only.** The field shows `08/13/2026, __:__ __`
  (`internals/pending-date-time.ts:23-51`) but nothing announces that the value is incomplete; the
  control already owns an `ownDescribedBy` hook for exactly this kind of extra text
  (`date-picker-input.directive.ts:126-137`, used by the zone reading), so a "time still required"
  hint would ride along for free.
- **A picker can render a fully dead grid with no message.** `dateFilter` can reject every day in
  the visible month and `timeFilter`/`minTime`/`maxTime` can reject every option, and
  `et-date-picker-panel` has no empty state - the reader is left clicking dimmed cells. An
  empty/"no times available" slot on the panel would serve all six controls.
- **Two 16px pointer targets sit side by side in the suffix stack.** The clear and the trigger are
  both `.et-icon { 16px }` (e.g. `duration-input.component.css:52-55`) and appear together while
  focused; outside the bottom sheet (which does raise cell/option sizes to 44px -
  `date-picker-panel.component.css:76-78`) neither reaches the 44px touch minimum, and `showClear`
  requiring focus makes the × appear and disappear under a tapping finger.
- **The picker never re-focuses the field after a bottom-sheet close.** That is deliberate
  (`internals/date-picker-input.directive.ts:170-177`: refocusing would pop the soft keyboard),
  but it leaves focus on `<body>` on mobile, so the next Tab restarts at the top of the page.
  Focusing the trigger button instead keeps the reading position without the keyboard.

#### Testing

- **A shared commit-contract suite across the six picker controls, first.** All four High defects
  are one behaviour implemented twice; a `describePickerCommitContract()` next to the existing
  `forms/testing/mixed-state-contract.ts`, asserting unedited-blur is a no-op, erase-after-parse-
  error resets `parseError`, `clearValue()` survives an attached mask, and readonly blurs do not
  commit, would have caught every one of them and pins the two bases together.
- **Run `describeMixedStateContract` for the duration input.** It is the only one of the seven
  without it (`duration-input.directive.spec.ts` has no contract block) and the only one whose
  `hasValue` bookkeeping is wrong (Medium #1).
- **One form-field integration spec per control.** Nothing in this domain renders a control inside
  `<et-form-field>`, so label wiring, `ET2201`, the floating label and error rendering are entirely
  untested here - which is why High #2 went unnoticed.
- **Round-trip parse/format tests across at least de, en-US and one non-Latin-order locale.**
  `internals/precision-format.ts:29-43` strips the day token with a regex and
  `internals/date-time-format-split.ts` re-implements date-fns' tokenizer; both are pure
  locale-pattern logic covered today by en-US plus a single de case.
- **Layout behaviours need a Storybook/Playwright pass, not jsdom.** The panel's side-flip
  threshold (`internals/date-picker-overlay.ts:21`), the pane height compensation
  (`internals/date-time-panes.directive.ts` - a `ResizeObserver` plus `element.animate`) and the
  range stacking container queries have no coverage at all and cannot get it in jsdom; they are the
  natural first targets for the `verify-in-storybook` skill.

---

## stream

Scope: `libs/components/src/lib/stream` (all non-spec `.ts` / `.html` / `.css`, both spec files, the stories,
and `apps/docs/components/stream.md` + the `ET16xx` block of `apps/docs/components/error-codes.md`).

Runtime verification used a throwaway spec at
`libs/components/src/lib/stream/__scan-verify.spec.ts`, run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts src/lib/stream/__scan-verify.spec.ts`,
then deleted. Working tree otherwise untouched.

### High

- **Leaving PiP without an exit animation strands the player in the hidden body container instead of the
  slot - the video vanishes from the page.** `PipPlayerComponent` parks the player on destroy
  (`libs/components/src/lib/stream/pip/pip-player.component.ts:72` →
  `pipManager.parkPlayerElement(...)`), and `parkPlayerElement` only refuses when the id is in
  `animatingOutIds` (`libs/components/src/lib/stream/pip-manager.ts:194-197`). The two animated exit paths
  add the id (`pip-manager.ts:137`, `pip-manager.ts:162`), but the plain path at
  `libs/components/src/lib/stream/pip-manager.ts:183-185` does not: it `moveBefore`s the player into the
  slot, empties `pips`, which fires the `PipChromeManager` effect
  (`libs/components/src/lib/stream/pip-chrome-manager.ts:57-59`), destroys the chrome and therefore the
  `et-pip-player`, whose `onDestroy` immediately yanks the player back out of the slot into
  `div.et-stream-manager`. Nothing ever re-runs `reassignPlayer`, so the player stays there. Triggered by
  the documented public option `pipDeactivate(id, { skipAnimation: true })`
  (`stream-manager.types.ts:240`), and also by the *default* path whenever either rect measures empty
  (`pip-manager.ts:161`) - e.g. the target slot sits in a `display: none` tab or has not been given a size.
  **Runtime-verified**: test A logged `AFTER REGISTER parent = slot` → `IN PIP parent = et-pip-player` →
  `RIGHT AFTER DEACTIVATE parent = slot` → `AFTER CHROME TEARDOWN parent = et-stream-manager isSlot =
  false`; test C reproduced the identical result with `pipDeactivate('p2')` and no options.

- **The library ships no CSS for the body-level player container or for the PiP window's placement, so a
  consumer following the docs sees parked players inline in `<body>` and a mispositioned PiP window.**
  `injectStreamManager` creates `div.et-stream-manager` and appends it to `document.body`
  (`libs/components/src/lib/stream/stream-manager.ts:27-29`), and every player element lives there before
  it reaches a slot (`stream-manager.ts:104`), while parked during `pipActivate`
  (`pip-manager.ts:86`), and permanently in the High finding above. A repo-wide grep for
  `.et-stream-manager` in `*.css` returns nothing - the only rule that hides it is
  `libs/components/src/lib/stream/stories/components/stream-slot-demo-styles.ts:2-9`
  (`position: fixed; top: -9999px; left: -9999px; overflow: hidden`), which every slot story imports and
  which is not shipped, not exported, and not mentioned anywhere in `apps/docs/components/stream.md`. The
  same story block supplies `et-pip-window { bottom: 24px; right: 24px; z-index: 9999 }`
  (`stream-slot-demo-styles.ts:11-18`); the shipped sheet declares only `position: fixed` with no offsets
  and no `z-index` (`libs/components/src/lib/stream/pip/pip-window.component.css:20-41`), and
  `et-stream-pip-chrome` gets no positioning rule at all, so an un-styled PiP window opens at its
  static-position in body flow and can be painted under any positioned app chrome. Code-verified only (the
  visual consequence needs a real browser), but the absence of the rules and the stories' dependence on
  them is exact.

- **Accepting the consent gate after the video id changed registers the player under the *old* id, which
  silently breaks `pipDeactivate()` and the PiP placeholder for that slot.** `createStreamPlayerSlot`
  captures `currentPlayerId` once in `init()` (`libs/components/src/lib/stream/stream-player-slot.ts:265`)
  and hands that captured value to the deferred
  `createAndRegisterPlayer(currentPlayerId)` inside the consent subscription
  (`stream-player-slot.ts:257`; the same staleness exists on the handler-only path at
  `stream-player-slot.ts:309`). Meanwhile the id-change effect at `stream-player-slot.ts:96-111` has
  already advanced `currentPlayerIdSignal` to the new id. Result: the manager knows the player as
  `youtube-OLD` while the slot handle reports `youtube-NEW`, so `pipDeactivate()`
  (`stream-player-slot.ts:349-355`) resolves an id that is not in `pips` and no-ops, and
  `PipSlotPlaceholderComponent.isInPip` (`pip/pip-slot-placeholder.component.ts:141-145`) never matches;
  a second slot mounted for the real id also fails `getPlayerElement` and creates a duplicate player.
  **Runtime-verified**: test B logged `after id change, currentPlayerId = youtube-NEW`, then after
  clicking accept: `currentPlayerIdSignal = youtube-NEW | manager has youtube-OLD = true | manager has
  youtube-NEW = false`.

- **The docs state the opposite of what the slot does with surface themes.**
  `apps/docs/components/stream.md:121` says "Slots provide a `type: 'dark'` surface scope one elevation
  above their context (video UI always reads as a dark surface)". The slot resolves against the *ambient*
  type - `private surfaceType = injectSurfaceType();` then
  `resolveSurfaceByElevation(themes, type, elevation)` at
  `libs/components/src/lib/stream/stream-player-slot.directive.ts:65,72-79`. Only the PiP chrome hardcodes
  `'dark'` (`pip/pip-chrome.component.ts:95`). An app on a light surface gets a light slot scope, contrary
  to the guide. Code-verified.

### Medium

- **`ET1604`'s error message and doc row give impossible remediation.**
  `libs/components/src/lib/stream/pip-chrome-manager.ts:50` and
  `apps/docs/components/error-codes.md:208` both say "Add `hostDirectives: [StreamPipChromeComponent]` to
  the chrome component" - `StreamPipChromeComponent` is an `@Component`
  (`pip/pip-chrome.component.ts:35`), and Angular rejects a component in `hostDirectives`. The actionable
  instruction is to provide `PIP_CHROME_REF_TOKEN` / implement `PipChromeRef`
  (`pip/headless/pip-chrome-ref.token.ts:5-10`), which is what the check actually tests
  (`pip-chrome-manager.ts:47`).

- **A per-entry `pipChromeComponent` / `pipChromeConfig` is honoured only for the first PiP.**
  `stream-manager.types.ts:78-81` documents them as "the chrome component to use while **this entry** is
  active", and `PipManager.pipChromeComponent` tracks the *latest* pip
  (`pip-manager.ts:29-35`). But `PipChromeManager`'s effect only constructs a chrome when
  `!pipChromeRef` (`pip-chrome-manager.ts:39`) and has no branch for "the component changed", so a second
  `pipActivate` with a different chrome (or a different `controlsColor`) is silently ignored until every
  pip closes.

- **Four inline `styles:` blocks in this domain are not wrapped in `@layer components`, so Tailwind
  utilities cannot override them.** `consent/stream-consent.component.ts:39`,
  `error/stream-player-error.component.ts:35`, `loading/stream-player-loading.component.ts:16`,
  `pip/pip-slot-placeholder.component.ts:35`. AGENTS.md makes the wrap mandatory ("**Wrap every component
  CSS file in `@layer components { … }`**") precisely because unlayered component CSS beats
  `@layer utilities` regardless of specificity; the four `.css` files in this domain do wrap
  (`stream-player-slot-styles.component.css:1`, `pip/pip-window.component.css:1`,
  `pip/pip-chrome.component.css:1`, `pip/pip-player.component.css:1`), and sibling domains such as
  `tabs/tabs/tab-group.component.ts:111` and `scrollable/headless/scrollable-masks.component.ts:15` wrap
  their inline blocks too. An app cannot override e.g. `.et-stream-consent`'s `background` with a utility.

- **The `loadingComponent` / `errorComponent` overlays cannot actually be turned off through the public
  type.** Both are typed `Type<unknown>` (non-nullable) at
  `libs/components/src/lib/stream/stream-config.ts:60,68` while their JSDoc calls them "An optional
  component…" and the implementation guards with `if (loadingComponent)` /
  `if (errorComponent && !errorComponentRef)` (`stream-player-slot.ts:140,178`). Passing
  `provideStreamConfig({ loadingComponent: null })` is a type error, so the documented "optional" is
  unreachable without a cast. (Contrast `consentComponent` / `pipSlotPlaceholderComponent` /
  `pipChromeComponent`, which are all `| null`.)

- **Kick, SOOP and Dailymotion can never reach the error state, so the documented error overlay never
  appears for them.** All three set `isReady` purely from `iframe.onload`
  (`platform/kick/headless/kick-player.directive.ts:60-63`,
  `platform/soop/headless/soop-player.directive.ts:70-73`,
  `platform/dailymotion/headless/dailymotion-player.directive.ts:62-65`) and never call
  `subscriber.error`, and a cross-origin iframe fires `onload` even for a platform error page. Meanwhile
  `StreamConfig.errorComponent` is documented as "shown when the player fails to load (e.g. SDK blocked by
  an ad-blocker)" (`stream-config.ts:63`). A blocked or dead Kick/SOOP/Dailymotion embed shows a blank
  ready player, not the retry overlay.

- **SOOP with neither `userId` nor `videoId` spins forever with no error.**
  `SoopPlayerParamsDirective.playerId` still produces `soop-video-null`
  (`platform/soop/headless/soop-player-params.directive.ts:13-16`), so the slot creates and registers a
  player, but `SoopPlayerDirective`'s resource params return `null` → `EMPTY`
  (`platform/soop/headless/soop-player.directive.ts:41-49`), so `isReady` stays false and `error` stays
  null: the loading spinner is permanent. Twitch at least dev-warns in the same situation
  (`platform/twitch/headless/twitch-player.directive.ts:49`); SOOP is silent.

- **The Facebook SDK URL hardcodes German and a 2018 SDK version, with no way to configure either.**
  `const FB_SDK_URL = 'https://connect.facebook.net/de_DE/sdk.js#xfbml=1&version=v3.2'` at
  `platform/facebook/headless/facebook-player.directive.ts:13`. Every consumer, in any locale, loads the
  `de_DE` Facebook bundle - so the embed's own UI strings are German - and is pinned to Graph API v3.2.
  Nothing in `StreamConfig` or `stream-labels.ts` can change it, and `apps/docs/components/stream.md` does
  not mention it. (The repo has a locale provider - `injectStreamLabels` already reacts to it per
  `stream.md:80`.)

- **Three `timer(...).subscribe()` calls in the PiP window's position logic have no
  `takeUntilDestroyed`, so they touch the host element after destroy.**
  `pip/headless/internals/pip-window-position.ts:77-82` (`snapToPosition`), `:89-94` (`snapTo`) and
  `:471-483` (`startModeTransition`). The first two only `removeStyle('transition')`, but
  `startModeTransition`'s callback calls `snapToViewport()` → `renderer.addClass` / `removeClass` /
  `pos.set` on a destroyed window. Every other stream over the finish line is `takeUntilDestroyed`-guarded
  (`:418`, `:438`, `:452`), which AGENTS.md requires last in the pipe.

- **Changing a video id on one of two slots sharing a player hijacks the other slot's player
  permanently.** The id-change effect calls `streamManager.transferPlayer(oldId, newId)`
  (`stream-player-slot.ts:102`), which re-keys the single shared `StreamPlayerEntry`
  (`stream-manager.ts:140-145`). The *other* slot's `StreamSlotEntry` still carries `oldId`
  (`stream-manager.ts:34` keys slots by element, and nothing rewrites their `playerId`), so it now points
  at an id with no player: `resolveBestSlot(oldId)` finds it but `reassignPlayer` bails at
  `stream-manager.ts:87` since `players.get(oldId)` is gone, and the player has physically moved into the
  renaming slot. The second slot stays empty for the rest of its life.

- **Four of the eight platforms produce untitled iframes.** `STREAM_LABELS.playerFrame` is applied only by
  the four hand-rolled iframe players (`platform/{soop,kick,dailymotion,tiktok}/headless/*.directive.ts` -
  lines 62, 52, 54, 56); YouTube, Twitch, Vimeo and Facebook let the SDK build the frame and never set a
  `title`. `apps/docs/components/stream.md:117` is honest about this ("can't be titled from here"), but the
  SDKs do accept a title in practice (YouTube/Vimeo via the `iframe` they create, reachable after
  `onReady`), so it is a fixable a11y gap rather than a hard limit.

- **`postMessage` to TikTok uses a wildcard target origin.**
  `platform/tiktok/headless/tiktok-player.directive.ts:167` -
  `this.iframe.contentWindow.postMessage(message, '*')`. Inbound messages are correctly filtered by
  `e.source !== iframe.contentWindow` (`:68`), but outbound control commands are broadcast to whatever
  document currently occupies the frame. `'https://www.tiktok.com'` is the right target.

### Low

- **`YoutubePlayerSlotDirective` is dead, exported, and referenced as the canonical example in a JSDoc.**
  `platform/youtube/headless/youtube-player-slot.directive.ts` declares `@Directive({ providers: [...] })`
  with **no selector**, so it cannot be applied in a template at all; it is not in
  `STREAM_YOUTUBE_IMPORTS` (`stream.imports.ts:54-59`), not used as a `hostDirective` anywhere, and a
  repo-wide grep finds no consumer - yet `platform/youtube/headless/index.ts:2` re-exports it into the
  public API and `stream-manager.types.ts:11` names it as the example of a slot directive. It duplicates
  what `StreamPlayerSlotDirective` + `STREAM_PLAYER_PARAMS_TOKEN` now do generically.

- **`PipPlayerComponent`'s null cast makes two host bindings crash where a sibling binding guards.**
  `resolvedEntry` returns `null as unknown as StreamPipEntry`
  (`pip/pip-player.component.ts:61-63`), and the host reads `resolvedEntry().playerId` unguarded
  (`:44`) and `resolvedEntry().thumbnail?.()` (`:65`) while the very next binding writes
  `resolvedEntry()?.aspectRatio` (`:46`). `PipPlayerComponent` is public (`pip/index.ts:3`,
  `STREAM_PIP_IMPORTS`), so a custom chrome placing `<et-pip-player />` without `[entry]` and without
  `[etPipCell]` throws instead of rendering nothing.

- **`stream-script-loader`'s `mountedScripts` set is unreachable dead state.**
  `stream-script-loader.ts:9,20-26,35,40`: the `isMounted` early-return can only fire when `cache` misses
  but `mountedScripts` hits, and the only path that deletes from `cache` (the error handler, `:39-41`)
  deletes from `mountedScripts` in the same breath. The set can be removed.

- **`stream-script-loader` never unlistens or removes a script on unsubscribe.**
  `renderer.listen(script, 'load'|'error', …)` at `stream-script-loader.ts:32,38` discards both unlisten
  functions, and the Observable returns no teardown, so the `<script>` and its two listeners outlive any
  cancelled load. Bounded by the number of distinct SDK URLs, so cosmetic.

- **`injectStreamScriptLoader` exports no matching provide function**, unlike every other root provider in
  the domain (`stream-manager.ts:196`, `pip-manager.ts:217`, `pip-chrome-manager.ts:67`,
  `stream-config.ts:134`). `stream-script-loader.ts:62` exports only the inject fn, so the loader cannot be
  swapped for a fake in a test or in an offline shell.

- **`waitForYtReady` and Facebook's `fbAsyncInit` patch leave their global hooks installed.**
  `platform/youtube/headless/youtube-player.directive.ts:20-27` chains `win.onYouTubeIframeAPIReady` and
  never restores the previous value on unsubscribe; same shape at
  `platform/facebook/headless/facebook-player.directive.ts:144-148` for `win.fbAsyncInit`. A cancelled load
  leaves a closure over a dead subscriber on `window`.

- **`et-pip-player`'s layout rules are duplicated verbatim in two stylesheets.**
  `pip/pip-chrome.component.css:91-105` repeats the `et-pip-player` block and the
  `> :not(.et-pip-player__thumb-wrapper)` sizing rule from `pip/pip-player.component.css:2-17` (the chrome
  copy is missing only `position: relative`). One of the two is redundant weight in every bundle that
  pulls in PiP.

- **The story CSS block is partly stale.** `stories/components/stream-slot-demo-styles.ts:20-31` re-declares
  the `et-pip-player` rules the library now ships, and `:33-35` styles
  `.et-stream-pip-chrome__previews`, a class that exists nowhere in the source (grep: no hits outside this
  file).

- **`etPipTitleBar` cannot forward `dragCancelled`.** `pip/headless/pip-title-bar.directive.ts:10` lists
  `['dragTapped', 'dragStarted', 'dragMoved', 'dragEnded']` but not `dragCancelled`, which the position
  logic itself consumes off the injected instance (`internals/pip-window-position.ts:432`). A consumer
  composing their own title bar cannot bind the cancel case.

- **Vimeo's `mute()` / `unmute()` do not optimistically update `isMuted`** the way YouTube, Twitch,
  Facebook and TikTok's do (`platform/vimeo/headless/vimeo-player.directive.ts:184-190` vs
  `youtube-player.directive.ts:167-175`). It self-corrects via the `volumechange` handler, but a consumer
  reading `state().isMuted` right after `mute()` sees the stale value only on Vimeo.

- **`STREAM_USER_CONSENT_PROVIDER_TOKEN` has no provide helper.**
  `consent/headless/stream-consent.directive.ts:6` exports the raw token and an inject fn; the docs point
  at `createUserConsentProvider` from core (`stream.md:70`), but nothing in this domain binds the two, so
  the wiring is hand-rolled `{ provide: …, useValue: … }` at every call site.

- **Slot re-registration does not refresh its position in the resolve order.**
  `resolveBestSlot` relies on `Map` insertion order for "last-registered wins"
  (`stream-manager.ts:36-55`), but the id-change effect re-registers via `slots.set(entry.element, …)`
  (`stream-manager.ts:117`), which keeps a pre-existing key at its original position. A slot that re-keys
  itself does not become the newest.

- **`reassignPlayer` pulls viewport size into the id-change effect's dependency set.**
  `isInViewport` reads `viewportSize()` (`stream-manager.ts:57-63`) and is reached synchronously from
  `registerSlot` → `reassignPlayer` → `moveWithFlip`, which the effect at
  `stream-player-slot.ts:96-111` calls. Every window resize therefore re-runs that effect (it early-returns
  at `:100`, so harmless, but the dependency is unintended).

- **Comment-policy: two `// no-op` bodies per method across three files.**
  `platform/kick/headless/kick-player.directive.ts:90-104`,
  `platform/soop/headless/soop-player.directive.ts:100-114`,
  `platform/dailymotion/headless/dailymotion-player.directive.ts:90-108` each carry a section-style
  explanatory comment (which is legitimate - it names a platform limitation) *plus* an `// no-op` line
  inside each of five empty methods. The per-method lines restate the code and are the "always delete"
  case in AGENTS.md.

### Spec coverage

**77 spec lines for ~6.9k source lines - effectively untested.** Only two spec files exist:

- `consent/stream-consent.component.spec.ts` (49 lines) - renders `StreamConsentComponent` standalone and
  asserts the lock icon, heading, description and accept-button text resolve from `provideStreamLabels`.
  Sound, but it never clicks accept, so `StreamConsentAcceptDirective` → `StreamConsentDirective.grant()`
  → `isGranted` and the `ConsentHandler` delegation branch
  (`consent/headless/stream-consent.directive.ts:20-36`) are untested.
- `loading/stream-player-loading.component.spec.ts` (28 lines) - asserts an `et-spinner` renders and
  `position: absolute` applies. The second assertion is fragile-by-luck: the vite config's own comment
  says jsdom "drops the component stylesheets whole (`@layer`, nesting, `color-mix`)", and this component's
  sheet passes only because it is *not* wrapped in `@layer` (see the Medium finding) - fixing that
  convention violation will break this assertion.

Neither spec asserts wrong behaviour. Files with real logic and **zero** tests:

| File | Untested logic |
| --- | --- |
| `stream-manager.ts` (197) | slot priority resolution, FLIP reassignment, `transferPlayer`, the `unregisterSlot` → destroy-or-reassign decision |
| `pip-manager.ts` (218) | all three exit paths, `animatingOutIds`, `parkPlayerElement`, `getInitialRect` one-shot semantics, back-pulse queue |
| `stream-player-slot.ts` (361) | consent gating (all four branches of `init()`), loading↔error↔ready transitions, id-change re-registration, destroy cleanup |
| `pip/headless/internals/pip-window-position.ts` (486) | collapse/peek maths, sticky edges, resize/drag gesture pipelines, `startModeTransition` |
| `pip/headless/internals/pip-window-size.ts` (77) | the `linkedSignal` clamp against viewport and aspect ratio |
| `pip/headless/pip-chrome-state.ts` (210) | grid layout, featured fallback, `windowAspectRatio` locking, `close()` |
| `pip/headless/pip-chrome-animations.ts` (139) | FLIP capture/replay bookkeeping, `pendingNewInSingleMode` |
| `pip-chrome-manager.ts` (68) | create/destroy lifecycle, the `PIP_CHROME_REF_TOKEN` dev-mode throw |
| all 8 platform directives (~1.2k) | resource params, ready/error state mapping, teardown; `twitch-player-params.directive.ts`'s URL→channel/video regex is pure and trivially testable |
| `error/`, `pip/pip-slot-placeholder.component.ts`, `pip/pip-player.component.ts` | error-context retry wiring, placeholder visibility, pip-player adoption/animation |

Test-infrastructure gap found while verifying: the jsdom `AnimationMock` in
`libs/components/src/test-helpers.ts:91-133` dispatches a `finish` **event** but never invokes the
`onfinish` **property**, and every animation in this domain uses the property
(`pip/headless/internals/pip-animation.ts:72,133,212,261`, `pip-manager.ts:149`). Any spec that exercises
an animated PiP path will hang mid-transition with the player stranded in the fixed wrapper. Wiring
`onfinish`/`oncancel` into the mock's dispatch is a prerequisite for testing PiP at all.

### Improvements

#### Features

1. **Ship the placement CSS the domain needs, and let the PiP window's initial corner be configured.**
   Add `.et-stream-manager` (off-screen, `overflow: hidden`) to a styles-only component mounted by the
   stream manager, and give `et-pip-window` a default corner + `z-index` in
   `pip/pip-window.component.css`, driven by new `StreamPipWindowConfig` fields (`corner`,
   `zIndex`) next to the existing `desiredSize` / `viewportPadding`
   (`stream-config.ts:7-22`). Every peer (Material's CDK overlay, PrimeNG's dialog) ships its own stacking
   context; today the stories carry it.
2. **Expose the native Picture-in-Picture / fullscreen APIs alongside the custom window.**
   `StreamPlayerCapabilities` (`stream.types.ts:1-9`) has no `canFullscreen` / `canNativePip`, and
   `StreamPlayer` no `requestFullscreen()`. Users expect the OS-level PiP for video; the custom in-page
   window is complementary, not a replacement.
3. **A `volume` channel.** `StreamPlayer` has `mute`/`unmute` but no `setVolume(0..1)` / `volume` state
   (`stream-player.ts:26-30`, `stream.types.ts:11-22`), even though YouTube, Twitch, Vimeo and Facebook
   all support it. Every peer player component ships volume.
4. **A playback-rate and quality channel** for the four SDK platforms, gated behind capabilities the same
   way `canSeek` already is.
5. **A `poster` / thumbnail capability beyond YouTube.** Only YouTube derives a thumbnail
   (`platform/youtube/headless/youtube-player.directive.ts:55`); Vimeo and Dailymotion both have public
   oEmbed thumbnail endpoints, and the PiP grid's preview tiles
   (`pip/pip-player.component.ts:24-28`) render nothing for seven of eight platforms.
6. **Let the platform script URLs be configured.** `YT_API_URL`, `TWITCH_EMBED_URL`, `VIMEO_SDK_URL`,
   `FB_SDK_URL` are module constants; an app behind a CSP allowlist or a proxy (or one that needs a
   locale other than `de_DE` - see the Medium finding) cannot redirect them.

#### DX

1. **Give `pipDeactivate` one exit path so the park bug cannot come back.** The High finding is a
   three-branch method (`pip-manager.ts:128-186`) where two branches remember to set the
   animating-out latch and one forgets. Setting the latch unconditionally at the top of `pipDeactivate`
   and clearing it in a single `finally`-shaped helper removes the class of bug, not just the instance.
2. **Pass the live `playerId` signal into the deferred player creation instead of a captured string.**
   `createAndRegisterPlayer(currentPlayerId: StreamPlayerId)` (`stream-player-slot.ts:113`) should read
   `options.playerId()` at call time, which fixes the consent-staleness High for both the
   `consentComponent` and the bare-`ConsentHandler` path in one edit.
3. **A stream test driver.** No `*.driver.ts` exists for this domain (the repo has drivers for forms,
   dropzone, ARIA controls per the recent commit log). A driver that fakes the four SDKs, exposes
   "register slot / activate pip / assert player parent", and wires `onfinish` on the animation mock would
   make the whole spec-coverage table above tractable.
4. **Fold the eight near-identical `*PlayerParamsDirective` files into one generated shape.** All eight are
   the same 20-25 lines - `input`s, a `playerId` computed, and a `createBindings()` that mirrors the inputs
   one-for-one (`platform/*/headless/*-params.directive.ts`). A helper that derives `createBindings()` from
   an input map would delete ~120 lines and remove the "forgot to add the new input to createBindings"
   failure mode entirely.
5. **Make `loadingComponent` / `errorComponent` nullable** so the documented "optional" is expressible
   (`stream-config.ts:60,68`).
6. **Ship `provideStreamUserConsent(handler)`** next to `STREAM_USER_CONSENT_PROVIDER_TOKEN`
   (`consent/headless/stream-consent.directive.ts:6`), matching the `provideX` shape every other knob in
   the domain uses.
7. **Fix the two error messages that cannot be acted on**: `ET1604`'s `hostDirectives` advice
   (`pip-chrome-manager.ts:50`) and its doc row.

#### Bundle size

1. **The PiP slice is the natural `@defer` boundary and is already opt-in-by-barrel; make it opt-in by
   *import graph* too.** `stream-config.ts:5` statically imports `DEFAULT_PIP_CHROME_CONFIG` and
   `stream-player-slot.ts:24-25` statically calls `injectPipChromeManager()` / `injectPipManager()`, which
   drags `pip-chrome-manager.ts` → `StreamPipChromeComponent` → `PipWindowComponent` →
   `ResizeHandlesComponent` + `DragHandleDirective` + `pip-window-position.ts` (486 lines) +
   `pip-animation.ts` into every app that renders a single YouTube slot and never touches PiP. Resolving
   the chrome lazily (the config already stores a `Type`) would keep ~1.5k lines of drag/resize/animation
   code out of the common path.
2. **De-duplicate the `et-pip-player` rules** between `pip/pip-chrome.component.css:91-105` and
   `pip/pip-player.component.css:2-17`.
3. **The three overlay components' inline sheets are ~110 lines each of `@property` declarations plus one
   card layout, and are 90% identical** (`consent/stream-consent.component.ts:39-152`,
   `error/stream-player-error.component.ts:35-149`, `pip/pip-slot-placeholder.component.ts:35-119` - same
   card, icon, heading, description, three renamed token families). One shared
   `stream-overlay-card` styles-only component parameterised by a token prefix would cut ~200 lines of CSS
   from every consumer that uses more than one of them.
4. **`stream.imports.ts` builds ten `as const` tuples** (`:44-119`); per the repo's known
   `components-import-floor` issue, tuple-destructured provider/import barrels are exactly the shape that
   defeats tree-shaking. Worth measuring whether `STREAM_ALL_IMPORTS` (`:108`) keeps all eight platforms
   alive for an app that imports only the YouTube barrel.

#### UI/UX

1. **The PiP window is not keyboard-reachable or keyboard-movable.** The title bar is a drag handle only
   (`pip/headless/pip-title-bar.directive.ts`), the resize handles are pointer-only
   (`ResizeHandlesComponent` with `pointerdown`), and the collapse overlay is
   `(pointerdown)` (`pip/headless/pip-collapse-overlay.directive.ts:8`). A keyboard user can reach the
   three title-bar buttons but can neither move, resize, nor un-collapse the window. Arrow-key nudging
   while the title bar has focus, plus an "expand" action on the collapse overlay, would close the gap.
2. **Nothing announces the PiP transition.** Entering PiP moves the player out of the page and
   `PipSlotPlaceholderComponent` renders a visual card (`pip/pip-slot-placeholder.component.ts:19-31`)
   with no live region and no focus move, so a screen-reader user loses the player silently. A
   `role="status"` on the placeholder card and focus moved to its "Back to player" button would mirror
   what the loading overlay already does (`loading/stream-player-loading.component.ts:13`).
3. **Grid cells are `role="button"` but have no accessible name.**
   `pip/headless/pip-cell.directive.ts:16-20` sets `role`/`tabindex` and the Enter/Space handlers, and the
   cell's only content is an iframe - so each cell announces as an unnamed button. `STREAM_LABELS` has no
   per-cell label; adding one (`pipCell: (index, total) => …`) would make grid mode usable.
4. **`(keydown.space)` on the cell does not `preventDefault`**
   (`pip/headless/pip-cell.directive.ts:20`), so activating a cell with Space also scrolls the page behind
   the PiP window.
5. **The chrome hides the window until a player reports ready, with no fallback.**
   `pip/pip-chrome.component.css:2-12` applies `visibility: hidden` while no
   `.et-pip-player--ready` cell exists, and `isReady` is only ever set by the adoption effect
   (`pip/pip-player.component.ts:85-118`). If adoption's `queueMicrotask` bails (`!entryEl.isConnected`),
   the window stays invisible forever with a live pip entry behind it. A timeout fallback or an explicit
   loading state inside the window would be safer than a permanent `visibility: hidden`.
6. **The 550 ms hold + 350 ms fly "new pip" animation is unskippable and unconfigurable.**
   `animateNewPipInSingleMode` (`internals/pip-animation.ts:148-273`) hardcodes both, so activating PiP for
   a second stream blocks the featured view for ~0.9 s. It does honour reduced motion (via
   `motionDuration`), which is good; a config knob would let an app tune it.
7. **`.et-pip-interacting iframe { pointer-events: none !important }`** (`pip-window.component.css:131-135`)
   disables pointer events on **every** iframe in the document during any drag/resize, not just the ones
   inside the PiP window. Scoping it to the window (or at least to `.et-stream-player-slot iframe`) would
   avoid surprising a third-party embed elsewhere on the page.

#### Testing

Ranked for a first spec pass:

1. **`stream-manager.ts` + `pip-manager.ts` as pure units.** Both are plain factories over a fake element
   and need no rendering: slot priority (`resolveBestSlot`), the `unregisterSlot` destroy-or-reassign
   decision, `transferPlayer`, and every `pipDeactivate` branch's final parent - which is precisely where
   the two confirmed High bugs live. This is the highest value per line in the domain.
2. **Fix the animation mock first** (`test-helpers.ts:91-133`, wire `onfinish`/`oncancel`), otherwise every
   animated path is untestable - see the Spec coverage note.
3. **`stream-player-slot.ts`'s four `init()` branches** (no consent / handler-only / component-only /
   both), the loading→ready→error→retry overlay sequence, and the id-change effect. The scratch spec in
   this review drove all of it in jsdom with only `test-helpers` + `provideStreamConfig`, so no new
   infrastructure is needed.
4. **`twitch-player-params.directive.ts`'s regex** (`:5-34`) - pure, five inputs (bare channel, channel
   URL, `videos/<id>` URL, bare numeric id, `go.twitch.tv`), and currently the only source-parsing logic in
   the domain with no coverage.
5. **`pip-window-size.ts`'s `linkedSignal` clamp** (`:25-67`) - pure given a fake `params` + `titleBarH`,
   and it encodes the trickiest arithmetic in the PiP window (aspect-ratio vs viewport-height clamping).
6. **`pip-chrome-state.ts`'s `cells` computed** (`:93-128`) - grid col/row assignment, exit offsets and the
   inert/role/tabindex matrix, all derivable from a fake `pips` signal.
7. **A Storybook-driven pass** for the geometry that jsdom cannot express (collapse/peek, sticky edges,
   the visibility-gating CSS), using the `verify-in-storybook` skill against the existing eight slot
   stories.

Clean: the eight platform directives all correctly tear down their SDK objects, event subscriptions and
`interval` timers inside the resource's Observable teardown rather than leaking them
(`youtube-player.directive.ts:137-141`, `twitch-player.directive.ts:149-154`,
`vimeo-player.directive.ts:148-158`, `facebook-player.directive.ts:160-168`, and the three iframe players'
`removeChild` teardowns); every one guards on `isPlatformBrowser(PLATFORM_ID)` in its resource params, so
SSR does not touch `window`. `stream-config.ts`'s `createStreamConfig` correctly deep-merges the two nested
config objects instead of letting a partial override wipe them (`:121-132`). The four shipped `.css` files
are all `@layer components`-wrapped and resolve every colour through `--et-surface-*` /
`--et-theme-color-*` with only static `var()` fallbacks - no hardcoded primary colours anywhere in the
domain. All reactive state is signals (`signal`/`computed`/`linkedSignal`), asynchronous work is RxJS
bridged with `toObservable`/`rxResource`, and there is no `BehaviorSubject` and no subscribe-and-assign;
the two overlay pipelines in `stream-player-slot.ts` (`:201`, `:259`, `:310`) all end in
`takeUntilDestroyed`. `matchesReducedMotion` is honoured by every animation via the shared
`motionDuration` helper (`internals/pip-animation.ts:11`), including the deliberately-zeroed-not-skipped
cases whose reasoning is documented. Error codes `ET1600`-`ET1608` are contiguous, all nine are thrown from
source, and all nine are documented in `apps/docs/components/error-codes.md:200-212`. `PipCellDirective`'s
cell registration uses `effect(onCleanup)` keyed on the player id, so a re-keyed cell unregisters its old
entry (`pip/headless/pip-cell.directive.ts:32-38`). The consent gate carries `role="group"` +
`aria-labelledby` off a per-instance id, the loading overlay `role="status"` with a labelled announcement,
and the error overlay `role="alert"` - matching what `stream.md:116` claims.

---

## bracket

Scope: `libs/components/src/lib/bracket/**` (all non-spec `.ts`/`.html`/`.css`, all specs, both story
folders) plus `apps/docs/components/bracket.md` and `apps/docs/components/bracket-rounds-list.md`.

Runtime verification used a scratch spec (`__scan-verify.spec.ts`, since deleted) run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts …`. The stacked
double-elimination design calls (one chain header, dashed gutter connector, 5-embed docs cap) were
treated as intended and are not reported.

### High

- **The swiss layout throws `ET3408` for any source whose matches carry participant ids, because the
  group lookup uses the participant's record *including* the current match.**
  `createNewMatchParticipantBase` seeds the counters with the current match's own result
  (`core/match-participant.ts:57-59`, `winsTilNow = isWinner ? 1 : 0`) and then adds only the
  *previous* matches (`:61-80`). `generateBracketRoundSwissGroupMaps` looks a match's group up by
  `${winCount}-${lossCount}` (`linked/swiss.ts:150-156`), but the available groups for round *n* are
  the records after *n* games played, i.e. **before** that round
  (`getAvailableSwissGroupsForRound`, `linked/swiss.ts:69-110`). So a decided round-1 match's winner
  is `1-0` while round 1 only offers the `0-0` group, and the lookup misses → `RuntimeError` thrown
  out of `createSwissGrid` (`drawing/grid/swiss.ts:69-75`), out of `layout.listGrouping` in
  `<et-bracket-rounds-list>` (`bracket-rounds-list.component.ts:168`) and out of
  `bracketNaturalWidth`/`bracketFitsWidth` (`bracket-fits-width.ts:39`). Nothing renders at all.
  **Runtime-verified**: a two-round swiss source (`a`/`b`, `c`/`d`, all `winner: 'home'`,
  `status: 'completed'`) produced records `r0-m0 → home a 1-0, away b 0-1` and then
  `THREW: ET3408: Group not found for match: r0-m0`, both through `generateBracketRoundSwissGroupMaps`
  directly and through `swissBracketLayout().createGrid`. The shipped swiss story and
  `bracket-layout.spec.ts:102-117` only pass because `ET_DUMMY_DATA_SWISS`'s matches have no
  participant `id` (the integration maps them to `home: null, away: null` —
  `integrations/ethlete.ts:139-140`), so every match falls into the "empty match" distribution branch
  (`linked/swiss.ts:161-176`). Verified: the story source's first two matches are `{h: null, a: null}`
  and grouping succeeds. Consequence: swiss is untested and unusable against a real feed.

- **`swissColors` is interpolated raw into an SVG string that is then passed through
  `bypassSecurityTrustHtml` — a public input is an attribute-injection/XSS sink.**
  `groupBorderRect` writes `stroke="${color ?? 'currentColor'}"` (`drawing/draw-man-swiss.ts:146`) and
  `lineGradientDef` writes `stop-color="${from}"` (`:156`); `path()` does the same for its `stroke`
  (`drawing/path.ts:10`). The whole string reaches the DOM via
  `svgContent = domSanitizer.bypassSecurityTrustHtml(drawManData())` (`bracket.component.ts:279`) and
  `<svg [innerHTML]="svgContent()">` (`bracket.component.html:7`), so Angular's sanitizer never sees
  it. **Runtime-verified**: `[swissColors]="{ neutral: '#fff\" onload=\"alert(1)' }"` rendered
  `<rect … stroke="#fff" onload="alert(1)" fill="none" …>` and `getAttributeNames()` on the rect
  returned `['x','y','width','height','rx','stroke','onload','fill','stroke-width','class']` — a real
  event-handler attribute on a real element. Exploitable wherever the colors come from data (team /
  group colors from an API are the obvious case); `BracketSwissColors`'s own JSDoc invites free-form
  values ("Any CSS color value is allowed", `linked/swiss.ts:49-57`).

- **A pinned journey breaks whenever the `source` changes: the bracket dims itself and highlights
  nothing, or keeps stale marks.** `render()` short-circuits on an unchanged
  `renderedKey`/`renderedPinned` (`journey-highlight.ts:143-152`) and `setFocused` short-circuits on
  an unchanged participant id (`:206-220`), while the marks themselves are imperative classes on DOM
  nodes that `@for (… ; track $index)` re-uses across a new grid (`bracket.component.html:9,17,40`).
  Nothing re-renders the highlight when `journeyParticipants` changes — the only effect that could is
  `effect(() => this.journeyController()?.setFocused(this.focusedParticipantId()))`
  (`bracket.component.ts:340`). **Runtime-verified, two variants:**
  1. pin `p1` on an 8-team source, then replace it with a 16-team one → active cells stay
     `["se-r0-m0","se-r1-m0","se-r2-m0"]`, i.e. three of p1's four matches; the new final-round cell
     is never lit.
  2. pin `p9` while the 8-team source is showing (no such participant → nothing lit, correct), then
     replace it with the 16-team source that does contain `p9` → host classes become
     `et-bracket-host et-bracket-host--journey-hover et-bracket-host--journey-focused` with **zero**
     active cells, i.e. the entire bracket sits at `opacity: 0.25`
     (`bracket.component.css:69-74`) with nothing highlighted. Toggling the pin through `null` and
     back fixes it (`["se-r0-m4","se-r1-m2","se-r2-m1","se-r3-m0"]`).
  Variant 2 is the realistic one: `focusedParticipantId` restored from a query param before/while the
  source loads, or any live-updating bracket.

### Medium

- **Every match reachable through `bracket.participants` carries the placeholder relation
  `{ type: 'dummy' }` cast to `BracketMatchRelation`.** `createBracket` stores *copies* of each match
  in the participant maps (`linked/bracket.ts:125-137`, `{ ...newMatch, me, opponent }`) and only
  afterwards writes the resolved relations back onto the originals
  (`:157-167`, `matchRelation.currentMatch.relation = matchRelation`). The copies keep the
  `{ type: 'dummy' } as unknown as BracketMatchRelation` placeholder minted at `:107`. `BracketMatch`
  is public API and `relation` is a discriminated union, so a consumer walking
  `participant.matches` and switching on `relation.type` silently falls through every case.
  Code-verified.

- **The same placeholder leaks into `round.relation` / `match.relation` for any round the relation
  builder cannot wire.** `generateRoundRelationsNew` only pushes a relation when one of four branches
  matches (`linked/round-relations.ts:465-505`); a single-round source matches none, so the round and
  its matches keep `{ type: 'dummy' }` (`generateMatchRelationsNew` explicitly skips them,
  `linked/match-relations.ts:336-341`). Rendering survives (runtime-verified: a one-round
  `final`-only source renders one cell with no error), but the public types claim a value that never
  occurs, and downstream code that trusts the union is wrong. Either widen the type or expose the
  placeholder as a named `'unresolved'` member.

- **Swiss elimination flags fire one loss early and contradict the documented rule.**
  `core/match-participant.ts:143-146` sets `isEliminationMatch = lossesTilNow >= 2` under the comment
  "In swiss you are eliminated after 3 losses", but `lossesTilNow` already includes the current
  match's loss (`:58`). A participant with one prior loss who loses again gets
  `lossCount: 2, isEliminationMatch: true, isEliminated: true`, while `SWISS_ELIMINATE_LOSSES` is `3`
  (`linked/swiss.ts:30`). Runtime-verified counts from the swiss fixture: `r1-m1 → home b 1-1,
  away d 0-2`. `isEliminated`/`isEliminationMatch` are on the public `BracketMatchParticipant` type,
  are never read anywhere in the domain (grepped: only their own assignments), and appear in neither
  docs page — so the wrong value ships as undocumented public data.

- **`createSwissGrid` throws `ET3409` for a theoretically-available group with no matches, but only
  when round headers are enabled.** `drawing/grid/swiss.ts:117-121` derives the header's round from
  `group.matches.first()?.round` and throws `SWISS_GROUP_EMPTY` when the group is empty, inside
  `if (options.roundHeaderHeight > 0)`; with `hideRoundHeaders` the same source renders. So the same
  data either renders or hard-fails depending on an unrelated cosmetic input. Code-verified only — I
  could not reach `ET3409` at runtime because `ET3408` (above) fires first on every fixture that
  would produce an empty group.

- **The double-elimination column mapping only understands two upper/lower round ratios.**
  `calculateColumnSplitFactor` returns `2` for exactly `1.5`, `1` for exactly `2`, and `1` for
  everything else (`drawing/grid/double-elimination-utils.ts:14-28`), while
  `calculateUpperRoundIndex` divides by the raw ratio (`:34-49`). A bracket whose
  `upperRounds-1 : lowerRounds-1` ratio is anything else (e.g. a lower bracket with an extra
  seeding round giving `1.33` or `2.5`) silently maps several sub-columns onto the same upper round or
  skips one — no error, just a wrong alignment. Code-verified.

- **The rounds list merges non-adjacent sections, contradicting the documented contract.**
  `BracketListSection`'s JSDoc says "rounds whose **consecutive** sections share an `id` render under
  one heading" (`bracket-layout.ts:29-33`), but `sections` keys a `Map` by id and appends to whatever
  it finds (`bracket-rounds-list.component.ts:171-206`), so a source that interleaves upper- and
  lower-bracket rounds is regrouped into one "Upper bracket" run and one "Lower bracket" run rather
  than the order it was given. The current behaviour is arguably the nicer one — the doc comment is
  what is wrong, and a layout author reading it will predict the wrong output.

- **The docs' custom-card example reads a property that does not exist.** `bracket.md:324` shows
  `{{ bracketMatch().home?.name }} vs {{ bracketMatch().away?.name }}`, but
  `BracketMatchParticipant` is `BracketParticipantBase & …` = `{ id, shortId, result, isEliminated,
  isEliminationMatch, tieCount, winCount, lossCount, side, matches }`
  (`core/participant.ts:8-11`, `core/match-participant.ts:18-29`) — there is no `name`. The snippet
  does not compile, and it is the first thing a consumer writing a card copies. (Names only exist on
  the *normalized* match, which is what the shipped cards use.)

- **The migration table promises an API that is not exported.** `bracket.md:620` tells cdk users that
  `createNewBracket` becomes `createBracket`, but `bracket/index.ts:44-77` re-exports only *types*
  from `./linked` plus `BRACKET_SWISS_GROUP_COLOR_TYPE` — `createBracket` is not in the public
  surface, while the cdk's `new-bracket/index.ts:3` did `export * from './linked'`. Verified by
  inspecting both index files. A consumer following that row cannot compile.

- **The documented "opt in by setting the same attribute" affordance has no exported constant.**
  `bracket.md:518-524` and `journey-highlight.ts:16-24` both tell a custom card to set
  `data-participant-id`, and the journey CSS hooks (`et-bracket-journey-active`,
  `…-endpoint`, `…-eliminated`, `et-bracket-host--journey-*`) are what a custom card must style — but
  `journey-highlight.ts` is not re-exported from `bracket/index.ts` (verified), so every one of those
  strings has to be hardcoded by the consumer with no compile-time link to the implementation.

### Low

- **`linked/logging.ts` is dead code.** 98 lines with `console.log`, `@internal`-tagged, exported from
  nothing (`linked/index.ts` lists `bracket`, `match-relations`, `round-relations`, `swiss` only) and
  imported nowhere in the repo (grepped: the only other hit is the cdk's own copy).
- **`BracketElementBase.isHidden` is written and never read** (`drawing/grid/core/bracket-grid.ts:170`
  sets it; no reader anywhere), and `area` (`m${match.shortId}` / `'.'`) is threaded through three
  files and never rendered — leftovers of a `grid-template-areas` approach the absolute-positioning
  template replaced.
- **A guard that cannot fail.** `core/round.ts:205`: `if (!map.last()) throw … 'Last round not
  found'` — reached only inside `if (splitRoundsRest.length)`, which implies at least one left half
  was already `map.set`.
- **Comment-policy violations throughout.** AGENTS.md allows four kinds of comment; a large share of
  these files' comments are rationale or migration narration, e.g. `bracket.component.ts:52-53`
  ("What the default cards read: …"), `:286-289`, `:294-297`, `:333-335`, `:339`;
  `drawing/draw-man.ts:88-92` ("…is why a folded lower bracket used to lose the line…"), `:99-100`,
  `:118-119` ("this used to carry both of the *current* match's participants"), `:170-172`;
  `journey-highlight.ts:92-93`, `:226-227`, `:236-237`; `bracket.component.html:31`;
  `bracket-default-final-match.component.ts:37-39`; plus multi-line rationale blocks in
  `bracket.component.css:26-30,50-52,66-68` and `bracket-default-match.component.css:2-3,12-19`.
- **Public types reference non-exported types.** `BracketDrawEdgesContext.settings` is
  `BracketLayoutSettings` and `BracketLayout.components` is `BracketComponentOverrides`
  (`bracket-layout.ts:22,98`), but neither `bracket-grid.ts` nor `bracket-components.ts` is re-exported
  from `index.ts` — so the seam `bracket.md:150-156` advertises as public has members a consumer
  cannot name (only infer).
- **`<et-bracket-rounds-list>`'s `continueComponent` input does nothing** by design
  (`bracket-rounds-list.component.ts:102-103`) and is absent from the docs table — a consumer who
  binds it gets neither an effect nor a warning.
- **Sibling hosts resolve the same inputs differently.** `<et-bracket>` treats every layout input as
  an optional override via `optionalBooleanAttribute`/`optionalNumberAttribute`
  (`bracket.component.ts:68-147`), whereas `<et-bracket-rounds-list>` reads the config eagerly into the
  input default with plain `booleanAttribute`/`numberAttribute`
  (`bracket-rounds-list.component.ts:94-114`). Same visible behaviour today, two patterns to keep in
  sync.
- **`optionalNumberAttribute('')` yields `NaN`, not `undefined`** (`bracket-input-transforms.ts:19-20`),
  so a bare `columnWidth` attribute poisons every derived dimension instead of falling through to the
  density preset.
- **`curvePath` never clamps its straight run.** `straightLength = (totalInline - startCurve -
  endCurve) / 2` (`drawing/curve.ts:30`) goes negative when the curve amounts exceed the column gap,
  producing a self-crossing path rather than a clamped curve.
- **`factorialCache` is an unbounded module-level `Map`** (`linked/swiss.ts:67`) — harmless in size,
  but it is module state shared across app instances, which the scan protocol flags by convention.
- **Docs nit:** `bracket-rounds-list.md:73` says "the four component slots also come from
  `provideBracketConfig`" while the table above it lists three (the fourth is the no-op
  `continueComponent`).

### Spec coverage

Well covered:

- `bracket.component.spec.ts` — participant focus/pin, Escape, click-past-cells, endpoint +
  eliminated marks, `disableJourneyHighlight`, final card `size="auto"`.
- `bracket-rounds-list.component.spec.ts` — sections, final-card rule (incl. bracket reset),
  `selectedRoundId`, custom `matchComponent`, label localization, and all of
  `bracketNaturalWidth`/`bracketFitsWidth` (density, override precedence, ET3413).
- `bracket-layout.spec.ts` — `resolveBracketLayout` precedence and ET3413, `layouts` input replacing
  the config, swiss styles-only component mounting.
- `bracket-default-cards.spec.ts` — all four default cards incl. ET3412, heading level, labels.
- `core/round.spec.ts`, `linked/round-relations.spec.ts`, `drawing/draw-man.spec.ts`,
  `drawing/grid/double-elimination-stacked.spec.ts`, `drawing/grid/core/bracket-grid.spec.ts`,
  `journey-highlight.spec.ts` — the fold, relations under a fold, mirrored/LTR connector parity,
  the stacked geometry invariants, section padding, elimination endpoints.

Real logic with **zero** tests:

- `linked/swiss.ts` (`getAvailableSwissGroupsForRound`, `generateBracketRoundSwissGroupMaps`,
  `getSwissGroupColorType`) — the High #1 bug lives here.
- `drawing/grid/swiss.ts` (`createSwissGrid`: stretch/filler maths, group box padding) and
  `drawing/draw-man-swiss.ts` (group rects, gradients, group-to-group edges) — the High #2 sink lives
  here.
- `core/match-participant.ts` — the win/loss/tie counting and all three elimination rules.
- `integrations/ethlete.ts` — `generateRoundTypeFromEthleteRoundType`,
  `generateTournamentModeFormEthleteRounds`, `generateBracketDataForEthlete` (duplicate detection,
  the `status === 'published' → 'completed'` mapping).
- `linked/match-relations.ts` — every `create*Relation` branch and the `previousUpper ≠ previousLower`
  split that turns a one-to-x into a two-to-x.
- `drawing/grid/double-elimination.ts` + `double-elimination-utils.ts` — the non-stacked builder
  (front-truncation padding, third-place spanning, split factors) is exercised only incidentally.
- `bracket-input-transforms.ts`, `bracket-density.ts` presets, `bracket-components.ts`
  (`resolveBracketComponents` precedence chain, `usesBracketFinalCard`).

No spec asserts a wrong behaviour. Two specs pass only because their fixture dodges a bug:
`bracket-layout.spec.ts:102-117` and the `Swiss` stories rely on `ET_DUMMY_DATA_SWISS` having no
participant ids (see High #1) — they would fail on any realistic swiss source.

### Improvements

**Features** (ranked)

- **Ship a swiss source generator and make swiss grouping data-driven.** `stories/generate-bracket.ts:9-17`
  says swiss "is intentionally not generated: its grouping requires cross-round win/loss record
  consistency" — that comment is the bug report. Deriving each group from the participants' *pre-round*
  record (and creating groups from the records actually present rather than from a combinatorial table)
  removes both the throw and the need for a hand-built fixture.
- **A `<et-bracket-participants>` legend.** The docs' own recommended pin affordance is "a participants
  legend beside the bracket" (`bracket.md:532-542`) and the story implements one
  (`stories/bracket-storybook.component.ts` `withParticipantList`). Every consumer will rebuild it;
  Material/PrimeNG-style completeness argues for shipping it, since it is also the keyboard/touch path
  for the whole journey feature.
- **Zoom/pan over a full-size grid.** Named as backlogged (`bracket-rounds-list.md:165-166`); with the
  grid already absolutely positioned in a fixed-size `<section>`, a transform-based pan/zoom wrapper is
  cheap and is what every peer bracket library (Challonge, Toornament embeds) offers on desktop.
- **Round-level and match-level slots for state.** There is no way to mark a live match, a bye, or a
  walkover without replacing the whole card; a `data-*` hook on the `li` (like `data-match-id`) for
  `status`/`winner` would let CSS do it.

**DX** (ranked)

- **Export the journey contract.** `BRACKET_PARTICIPANT_ATTRIBUTE`, `BRACKET_MATCH_ATTRIBUTE` and the
  four journey class constants exist in `journey-highlight.ts` but are not public; exporting them turns
  the documented "opt in by setting the same attribute" into a typed contract.
- **Add `bracketRoundSwissGroup` to the public card types.** `BracketMatchComponent` /
  `BracketRoundHeaderComponent` (`drawing/grid/core/types.ts:18-34`) declare two of the three inputs
  both hosts actually pass, so the docs are the only place the contract is stated. (Verified that
  omitting the input does not throw — `NgComponentOutlet` ignores it — so this is purely a typing gap.)
- **A test driver for the bracket.** Every bracket spec re-declares the same 20-line `normalizer`, the
  same `LAYOUTS` array and its own querying helpers (`bracket.component.spec.ts:14-55`,
  `bracket-layout.spec.ts:24-53`, `bracket-rounds-list.component.spec.ts:17-39`). A
  `bracketTestDriver({ source, layouts })` exposing `activeMatchIds()`, `cellFor(matchId)`,
  `pin(id)`, `sections()` would delete most of that and make the swiss path cheap to cover.
- **Name the swiss failure better.** `ET3408: Group not found for match: <id>` says nothing about what
  the engine expected; including the computed record and the round's available groups
  (`linked/swiss.ts:155-156`) would have made High #1 a five-minute diagnosis.
- **`bracketNaturalWidth` requires the same config object twice.** The docs already push consumers to
  share one `BracketConfig` between the provider and the helper
  (`bracket-rounds-list.md:146-151`); an `injectBracketNaturalWidth()`-style helper that reads the
  ambient config would remove the drift class of bug entirely.

**Bundle size** (ranked)

- **`drawing/grid/swiss.ts` + `drawing/draw-man-swiss.ts` + `linked/swiss.ts` (~530 LOC) are already
  behind `swissBracketLayout()`, but `linked/swiss.ts`'s *types* are re-exported eagerly from
  `index.ts`** (`BRACKET_SWISS_GROUP_COLOR_TYPE` is a runtime const). Check that the const is not what
  keeps the module alive for non-swiss apps; if it is, move it next to the color-type helper the layout
  owns.
- **`bracket.component.css` (75 lines) is ~45% journey-highlight rules.** With
  `disableJourneyHighlight` a documented option, the `--journey-*` block is a natural styles-only
  component mounted from the same effect that installs the listeners
  (`bracket.component.ts:314-337`) — the AGENTS.md "opt-in feature" pattern, and it also drops the
  `!important` at `bracket.component.css:47` by removing the competing rule from the base sheet.
- **Two implementations of "is this the final round".** `usesBracketFinalCard`
  (`bracket-components.ts:69-79`) and `isFinalMatch` inside
  `createRoundBracketSubColumnRelativeToFirstRound` (`prebuild/bracket-sub-column-relative-to-first-round.ts:79-81`)
  plus `isFinalMatchRound` (`double-elimination-stacked.ts:69-75`) encode the same rule three times.
- **`stories/dummy-data/ET_DUMMY_DATA_SWISS.ts` is 4554 lines** and is imported by a *spec*
  (`bracket-layout.spec.ts:21`) as well as two story files. A generated swiss source (see Features)
  would delete the file.

**UI/UX** (ranked)

- **The journey dim uses `opacity` on cards, which fails contrast for the un-dimmed text too.**
  `bracket.component.css:40-73` drops matched-out cells to `0.5`/`0.25`; at `0.25` a match card's
  text is unreadable rather than merely de-emphasised, and there is no
  `@media (prefers-reduced-transparency)` or high-contrast escape.
- **Hover highlight has no pointer-type guard.** The listeners are `mouseover`/`mouseleave` on the host
  (`journey-highlight.ts:249-255`); on a touch device a tap synthesises `mouseover` and leaves the
  bracket dimmed with no way to clear it except tapping outside a cell. A
  `(pointer: fine)`/`PointerEvent.pointerType` check would match the docs' claim that "hover is nothing
  on a touch screen".
- **Nothing in the grid is focusable, so the pin cannot be reached from the keyboard without a
  consumer-built legend.** Documented as deliberate (`bracket.md:564-571`), but a single
  `tabindex="0"` roving cell per round (or the participants legend above) would close the gap the docs
  currently delegate.
- **No loading/empty state.** `source` is `input.required` and an empty source throws `ET3401`
  (`drawing/grid/single-elimination.ts:30-32`); a bracket page that fetches its data has to guard with
  its own `@if`, and there is no skeleton to show meanwhile.
- **The continue column's connector reuses `continueLineDashArray` for the stacked layout's
  losers-champion gutter line** (`drawing/draw-man.ts:176-186`) — intentional per the docs, but it
  means the two cannot be styled apart.

**Testing** (ranked, what a spec pass should do first)

1. **Swiss end to end**: a hand-written source with decided *and* pending rounds through
   `generateBracketRoundSwissGroupMaps` → `createSwissGrid` → `drawSwissMan`, asserting group ids,
   `matches.size` per group, and the rendered `rect`/`path` count. This alone would have caught High #1
   and the `ET3409` header asymmetry.
2. **Escaping**: assert that a `swissColors` value containing `"` produces no extra attributes on the
   emitted `rect`/`path` (the exact assertion that failed above).
3. **Journey highlight across data changes**: pin, replace the source (same shape, larger shape, and a
   source that newly contains the pinned participant), assert the marked set matches the new data — the
   three variants of High #3.
4. **`core/match-participant.ts` counting table**: one spec per mode asserting
   `winCount`/`lossCount`/`tieCount`/`isEliminated` for a participant across three rounds, which pins
   down whether the current match counts.
5. **`integrations/ethlete.ts`**: duplicate round/match detection, round-type derivation per mode, and
   the `status === 'published' → 'completed'` mapping (which currently makes an unplayed published
   match count as a tie via `core/match-participant.ts:55`).
6. **Non-stacked double elimination**: front-truncated upper bracket, third-place spanning both finals
   columns, and a ratio outside {1.5, 2} — the Medium #5 mis-alignment has no guard today.

---

## scheduler

Scope: `libs/components/src/lib/scheduler` (all 55 source files, 10 spec files, `stories/`), plus
`apps/docs/components/scheduler.md`, the scheduler rows of `apps/docs/components/error-codes.md`
and the label table in `apps/docs/components/localization.md`.

Runtime verification used a scratch spec (`__scan-verify.spec.ts`, since deleted) run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts …`. Observed output
is quoted per finding. Working tree left unchanged.

### High

- **An immutable `appointments` update while the edit surface is open opens a second, stacked edit
  surface.** `scheduler.component.ts:209-217` runs an `effect` on `headless.selectedAppointment()`
  and calls `openEditSurface()` for every non-null value. `selectedAppointment` is
  `this.appointments().find(…)` (`headless/scheduler.directive.ts:175-177`), so it returns a *new
  object identity* whenever the consumer replaces the array — the normal immutable update. The
  effect has no "already open for this id" guard, so it re-opens. Failure scenario: user clicks an
  appointment, the surface opens; a poll/refetch, a websocket push, or an
  `appointmentReschedule`/`appointmentSave` applied to a *different* appointment replaces the array;
  a second overlay opens on top of the first — and because `takeSurfaceAnchor()`
  (`scheduler.component.ts:313-319`) has already cleared `surfaceAnchor`, the duplicate opens
  centered rather than anchored. The bundled `stories/scheduler-infinite-agenda-storybook.component.ts:65`
  regenerates the whole array on every page load, so "open an appointment, then scroll the sentinel
  into view" reproduces it in Storybook. **Runtime-verified**: after `selectedId.set('a')` then
  `appointments.set([appointment('a'), appointment('b')])` (same ids, new objects), the stubbed
  opener logged `opens after immutable appointments update: 2`.

- **The same array update silently throws away whatever the user has typed into the edit surface.**
  `headless/scheduler-edit-surface.directive.ts:42-54`: `currentAppointment` is a `computed` over
  `appointments()`, and `draft` is `linkedSignal(() => this.currentAppointment())`. The surface's
  `appointments` input is bound reactively (`scheduler.component.ts:321-326`,
  `inputBinding('appointments', () => this.headless.appointments())`), so any replacement of the
  consumer's array — again, the normal immutable update, and the same refetch/push/reschedule paths
  as above — recomputes `currentAppointment()` to a new identity and resets `draft` from it. Every
  unsaved edit in every field is lost mid-typing, with no indication. The docs only promise this on
  *navigation* ("Navigating discards any unsaved edits", `apps/docs/components/scheduler.md:336`),
  not on a background data refresh. **Runtime-verified**: draft title set to `'typed by the user'`,
  then `appointments.set([…new objects…])` → logged `draft title after appointments update: a`.

- **Both grid views apply `row` / `rowgroup` / `columnheader` / `gridcell` roles with no
  `grid`/`table` owner, and the time grid's `gridcell`s have no `row` ancestor at all.**
  `scheduler-month-view.component.html:1,9,14,16` and
  `scheduler-time-grid-view.component.html:1,6,15,22,88` set the roles; nothing anywhere sets
  `role="grid"`, `role="table"` or `role="treegrid"` — `scheduler.component.html` and the view hosts
  carry classes only. Per ARIA, `row` is only valid owned by a table/grid/treegrid/rowgroup and
  `gridcell` only inside a `row`, so the whole structure is dropped or mis-announced: the month
  weekday strip is an orphan `row`, the time grid's seven day columns are orphan `gridcell`s, and no
  view exposes a table structure. The docs assert the opposite —
  `apps/docs/components/scheduler.md:392`: "Weekday/day headers are `columnheader`s …; day cells are
  `gridcell`s in both grid views." **Runtime-verified**: month view →
  `{"grid":0,"table":0,"rowgroup":1,"row":6,"gridcell":35}`; week view →
  `time grid gridcells: 7 without a row ancestor: 7`.

### Medium

- **Agenda badges are the only ones without `[attr.title]`, so a truncated title has no tooltip and
  a badge with the title adornment off has no accessible name.** `scheduler-month-view.component.html:36`
  and `scheduler-time-grid-view.component.html:33,126` all bind `[attr.title]="…appointment.title"`;
  `scheduler-agenda-view.component.html:19-27` does not. The agenda badge truncates
  (`.et-scheduler-appointment-title` sets `text-overflow: ellipsis`,
  `scheduler-appointment-styles.component.css:51-57`), and with
  `[etSchedulerBadgeTitle]="{ enabled: false }"` the `title` attribute is the only remaining
  last-resort accessible name the other two views have. Code-verified only.

- **The month view's "+N more" menu ignores every registered badge adornment and has no untitled
  fallback, so a blank appointment renders an empty, unnamed menu item.**
  `scheduler-month-view.component.html:64-73` renders `{{ node.appointment.title }}` directly instead
  of the `badgeAdornments()` loop used everywhere else, so a consumer's custom adornment (and the
  built-in time-range/location/chain-count pieces) never appear there — and unlike the edit
  surface's children list (`scheduler-edit-surface.component.html:71`, `title || untitledLabel()`)
  there is no fallback. A just-created appointment (title `''`, e.g. from `addAppointment()` before a
  save) that lands in an overflowing cell becomes an `et-menu-item` with no text and no accessible
  name. Code-verified only.

- **Selection is exposed only as a `data-selected` attribute, never to assistive tech.** All three
  views set `[attr.data-selected]` (`scheduler-month-view.component.html:33`,
  `scheduler-time-grid-view.component.html:30,122`, `scheduler-agenda-view.component.html:21`) and
  the stylesheets restyle on it, but no `aria-selected`, `aria-pressed` or `aria-current` is set
  anywhere in the domain. A screen-reader user cannot tell which appointment is selected, in a
  component whose whole interaction model is "select an appointment". Code-verified only.

- **The toolbar always renders its narrow (FAB) layout on the first pass, including in SSR output.**
  `scheduler.component.ts:114-121`: `isNarrow = (this.dimensions().client?.width ?? Infinity) < 480`.
  `signalElementDimensions` (`libs/core/src/lib/signals/element-dimensions.ts:84-96`) seeds its
  signal from `createElementDimensions(el)` at construction, which reads `el.clientWidth` — `0` for a
  host element that has not been laid out — so `client` is `{ width: 0 }`, not `null`, and the
  `?? Infinity` fallback never applies. `isNarrow()` is therefore `true` on the first render, and on
  the server (where no `ResizeObserver` ever corrects it, same file lines 100-103) the serialized
  markup is always the FAB stack plus the icon-only Today button, which then swaps on hydration. The
  CSS container query it is supposed to move in lockstep with
  (`scheduler.component.css:33,46`) has no such initial state. Code-verified only (jsdom reports
  `clientWidth` `0` for every element, so a spec cannot distinguish the two states).

- **`hasDragged` is a latch that can stick, swallowing every subsequent click on an appointment.**
  `scheduler-month-view.component.ts:118` and `scheduler-time-grid-view.component.ts:173` reset the
  flag only *after* the `canDragAppointments()` / `event.button` / `dateAt()` guards
  (`scheduler-month-view.component.ts:111-116`, `scheduler-time-grid-view.component.ts:168`). Once a
  drag has set it to `true`, flipping `[etSchedulerAppointmentDrag]="{ enabled: false }"` at runtime
  means `startAppointmentDrag` returns before the reset forever, so `select()`
  (`scheduler-month-view.component.ts:70-77`) returns early on every later click and the appointment
  can never be opened again. Code-verified only.

- **`ET4504` is missing from the error-codes page, and the scheduler table's blanket "dev mode only,
  after the first render" note is wrong for two of its codes.**
  `scheduler-errors.ts:12` defines `APPOINTMENT_DRAG_OUTSIDE_SCHEDULER: 4504`;
  `apps/docs/components/error-codes.md:426-435` documents only 4500-4503. Worse, that section's
  preamble ("Checked in dev mode only, after the first render") holds for
  `SchedulerMonthDirective`/`SchedulerAgendaDirective`/`SchedulerTimeGridDirective` (all
  `if (ngDevMode) afterNextRender(…)`) but not for `SchedulerSwipeNavigationDirective`
  (`scheduler-swipe-navigation.directive.ts:51-57`) or `SchedulerAppointmentDragDirective`
  (`scheduler-appointment-drag.directive.ts:38-44`), which throw unconditionally from the
  constructor — in production builds too. A consumer reading the docs would not expect a production
  crash.

- **`SCHEDULER_LABELS` / `provideSchedulerLabels` are missing from the localization page's label-set
  table.** `scheduler-labels.ts:92-99` defines them with 26 strings; the table at
  `apps/docs/components/localization.md:107-129` lists every other domain's pair and has no
  scheduler row. `provideSchedulerLabels` is mentioned once in passing in the scheduler page
  (`scheduler.md:319`, only for `colorFieldNone`), so most of the label surface is undiscoverable
  and undocumented.

- **Time-of-day is hardcoded 24-hour everywhere, so the `locale` input has no effect on it.**
  `scheduler-time-grid-view.component.ts:108` (`'HH:mm'` for the hour gutter),
  `scheduler-badge-time-range.component.ts:34` (`'HH:mm'–'HH:mm'`), and
  `scheduler-edit-surface.component.ts:141` (children list) all pass a fixed `'HH:mm'` pattern with
  the locale only as an option — which changes nothing for that pattern. An en-US app that wires
  `locale`/`provideDateLocale(enUS)` correctly still gets `14:30`, never `2:30 PM`, while the header
  label and weekday names do follow the locale. Code-verified only.

### Low

- **A misplaced JSDoc block leaves `buildSchedulerAgenda` undocumented and puts its doc on the wrong
  symbol.** `headless/internals/scheduler-agenda.ts:21-33`: two consecutive doc blocks sit above
  `SchedulerAgendaGuide` — the first ("Groups a sub-appointment tree into an agenda list…") describes
  `buildSchedulerAgenda`, which is 30 lines further down at line 62 with no doc at all. A type
  declaration was clearly inserted between a function and its comment.

- **Comment-policy violations.** The same explanation is duplicated at two call sites — "only a
  `pointerdown` sets this, and one always precedes the click it belongs to"
  (`scheduler-month-view.component.ts:71-72` and `scheduler-time-grid-view.component.ts:149-150`),
  which AGENTS.md calls out explicitly ("The same explanation at every call site"). Rationale-for-a-
  mechanical-choice blocks that the docs page already covers: `scheduler.component.ts:81-83`
  (why the badge adornments are bundled), `:158-160` and `:169-170` (what the two registration lists
  are), `scheduler-edit-surface.component.ts:81-84` and `:115-116`. Restating-the-code JSDoc:
  `scheduler-badge-color-dot.component.ts:17` ("unused here, present to satisfy
  `SchedulerBadgeAdornment`").

- **Public JSDoc and the docs page both point at `buildAppointmentTree`, which is not exported.**
  `headless/scheduler-features.ts:65`, `:186`, `headless/scheduler.directive.ts:151` and
  `apps/docs/components/scheduler.md` all say "see `buildAppointmentTree`". It lives in
  `headless/internals/scheduler-tree.ts:16` and only `countDescendants` and the
  `AppointmentTreeNode` type are re-exported (`headless/scheduler.directive.ts:27-28`), so a
  consumer following the reference cannot import it. Same for `flattenAppointmentTree`,
  `findAppointmentNode` and `collectDescendantIds`.

- **Every badge and edit-field component is marked `@internal` yet exported from the public
  barrel.** `index.ts:9-29` re-exports `scheduler-badge-*.component` and
  `scheduler-edit-*.component`, each of whose `@Component` JSDoc ends in `@internal`
  (e.g. `scheduler-badge-title.component.ts:7`, `scheduler-edit-title.component.ts:10`). They are
  stamped via `ngComponentOutlet` and never need to be imported by a consumer.

- **`--et-scheduler-time-grid-body-max-height` is missing from the docs' design-token table.**
  Declared as an `@property` in `scheduler-time-grid-view.component.css:20-24` and named in prose at
  `apps/docs/components/scheduler.md:126`, but absent from the table at `:401-407` that lists the
  other four.

- **`provideColorPalette([])` renders the colour field as a swatch picker containing only "No
  color".** `scheduler-edit-color.component.ts:20` tests `@if (palette; as entries)`, and an empty
  array is truthy, so the text-field fallback is skipped for a palette with nothing in it.

- **The edit surface's breadcrumb and children buttons get no `:focus-visible` treatment.**
  `scheduler-edit-surface.component.css:37-41` and `:84-91` style colour and underline only, unlike
  every sibling bare button in the domain (`scheduler-month-view.component.css:136-140`,
  `scheduler-appointment-styles.component.css:24-27`) — keyboard users fall back to the UA ring.

- **`computeInitialScrollHour` spreads every block offset into `Math.min`.**
  `headless/internals/scheduler-time-grid.ts:238`: `Math.min(...offsets)` over one entry per block
  per visible day. Fine at realistic sizes, a stack overflow at pathological ones; a `reduce` costs
  nothing.

- **Swipe navigation reads `enabled` only at `touchstart`.**
  `scheduler-swipe-navigation.directive.ts:76` — a gesture already in flight when the config flips to
  `{ enabled: false }` still steps the period on release.

- **`draftBlock` will render a month-drawn all-day range as a timed block.**
  `headless/scheduler-time-grid.directive.ts:66-85` ignores `draft.allDay`, so a range drawn on the
  month view (which always sets `allDay: true`, `scheduler-month-view.component.ts:166`) that is
  still committed when the view switches to week/day draws as a full-height timed preview.

- **`SchedulerComponent.setView(value: unknown)` is public API that takes `unknown` and casts.**
  `scheduler.component.ts:231-233`. Documented as safe for the template's own bindings, but it is a
  public method a consumer can call with anything.

### Spec coverage

**Well covered.** The pure layout internals are the strong point: `scheduler-tree.spec.ts` (11
cases, incl. dangling `parentId` and depth-first flattening), `scheduler-month.spec.ts` (6),
`scheduler-agenda.spec.ts` (12, incl. every connector-guide shape), `scheduler-time-grid.spec.ts`
(16, incl. column packing, midnight clipping, all-day row stacking, and all four
`computeInitialScrollHour` branches). `scheduler.directive.spec.ts` (32 cases) covers every
`visibleRange` branch, `agendaDays` clamping/stepping, and the full draft-range and
appointment-drag state machines. `scheduler-edit-surface.directive.spec.ts` covers the draft,
ancestors, children, navigation, add-sub-appointment, save and descendant-delete.
`scheduler-swipe-navigation.directive.spec.ts` covers direction, thresholds, the vertical-drag and
draft-range bail-outs, and `enabled: false`.

**Real logic with zero tests.**
- `scheduler.component.ts` — no spec at all. Nothing covers the two `effect`s that open the surfaces
  (both High findings above live here), `handleEditSurfaceResult`, `takeSurfaceAnchor`,
  `addAppointment`, `headerLabel`'s three date-range branches, `isNarrow`, or the
  register/filter/sort of badge adornments and toolbar actions.
- `scheduler-month-view.component.ts` — no spec. `dateAt` hit-testing, `coverDraftRange`'s geometry,
  `startAppointmentDrag`, `startDraftRange`'s click-vs-drag `settle` branches and the `hasDragged`
  latch are all untested.
- `scheduler-time-grid-view.component.ts` (388 lines, the largest file in the domain) — no spec.
  `movedRange`, `resizedRange`, `allDayRange`'s three modes, `snapToSlot`, `columnAt`, `minutesAt`
  and `draftHourAt` are all pure or near-pure functions that would test cheaply, and none is covered.
- `headless/internals/scheduler-drag-gesture.ts` — no spec. The touch arming/disarming logic (the
  `TOUCH_ARM_DELAY` timer, the non-passive `touchmove` block, the `!armed` move bail-out) is the
  trickiest code in the domain.
- `scheduler-edit-surface.component.ts` — no spec. `canSave` gating, the two `outputToObservable`
  bridges that close the overlay, `childEntries`, and the two `defineOverlay` strategy stacks.
- Every feature directive except the colour one — 15 directives (5 badge, 5 edit-field, 3 action,
  drag, swipe) with no spec; nothing asserts an `order`, an `enabled` toggle, the `'' → {}` config
  transform (`headless/scheduler-features.ts:105-106`), or the two `valid` computeds that gate save.
- `scheduler-labels.ts` — no spec for the label override path.

**No existing spec asserts a wrong behavior.** `scheduler-edit-surface.directive.spec.ts:72-83`
comes closest — it asserts the draft resets on `navigateTo`, which is intended — but the identical
reset on an `appointments` identity change (High #2) is simply not covered either way.

### Improvements

**Features** (ranked)

- **Let an app choose which views the switch offers, and in what order.**
  `scheduler.component.html:89-92` hardcodes all four `et-segmented-button`s, so a month-only or
  week+day-only scheduler has to drop to a bare `[etScheduler]` composition and rebuild the whole
  toolbar. Material's calendar, FullCalendar and PrimeNG all take a view list; an
  `availableViews = input<SchedulerView[]>()` on the headless directive would be a few lines and
  would also fix the case where `view` is set to a value the app never wants reachable.
- **Business hours / a bounded hour range on the time grid.** `HOURS`
  (`scheduler-time-grid-view.component.ts:30`) is a fixed 0-23 and every percentage in
  `buildSchedulerTimeGrid` is against a full day. Every peer library lets a grid start at 07:00 and
  end at 20:00, and dim or hide out-of-hours slots — the single most requested calendar feature and
  the one `computeInitialScrollHour`'s "business-hours default" of `8` is a workaround for.
- **Recurrence, even just as a display concern.** `Appointment` has no rule field, so an app must
  expand a series into individual appointments itself before passing the list, and there is nowhere
  to hang "edit this occurrence vs the series" on the edit surface. An `Appointment.seriesId` plus a
  `SchedulerEditField`-level hook would let the SDK stay out of RRULE parsing while still supporting
  the flow.
- **A "now" indicator line on the time grid.** The grid already computes the current hour for its
  initial scroll (`headless/internals/scheduler-time-grid.ts:227-238`) but never draws the current
  time; it is the one piece of chrome every calendar has and the day/week views look unfinished
  without it.
- **A drop-target/validity hook on the drag.** `beginAppointmentDrag`/`updateAppointmentDrag`
  (`headless/scheduler.directive.ts:263-273`) accept any range, so an app cannot mark a slot
  unavailable, snap to a resource, or veto a move — it can only revert after the fact by not
  applying `appointmentReschedule`, which the docs themselves call out as visibly janky
  (`scheduler.md:240`).
- **Resource/lane columns.** `buildSchedulerTimeGrid` packs by overlap only; a "one column per room /
  per person" mode is the standard second axis for a scheduler and would reuse `packColumns`
  wholesale with a grouping key.

**DX** (ranked)

- **Give the two "opens on a signal" effects an explicit imperative API.** Making the surface open as
  a side effect of `selectedAppointmentId` (`scheduler.component.ts:209-217`) is what produces both
  High findings, and it also means a consumer cannot select an appointment *without* opening a
  dialog (highlighting one from a sidebar, say). A public
  `openEditSurface(id)` / `closeEditSurface()` pair plus an id-keyed guard in the effect would fix
  the duplicate-open, the draft reset, and this missing capability at once.
- **No test driver for the domain.** Every other recently-worked domain in this lib has one
  (`libs/components/src/lib/testing/`), and the scheduler's specs each hand-roll a host component
  and a `debugElement.children[0].injector.get(…)` lookup. A `SchedulerDriver` exposing
  `badges()`, `cellFor(date)`, `clickAppointment(id)`, `dragTo(…)` and `editSurface()` is the
  prerequisite for closing the view-component coverage gap listed above.
- **`registerBadgeAdornment` / `registerEditField` / `registerToolbarAction` have no unregister.**
  A feature registers from its constructor and the entry lives on the host list forever
  (`scheduler.component.ts:270-277`, `scheduler-edit-surface.component.ts:181-188`). Because a
  directive is destroyed with its host that is fine today, but a feature applied to something
  shorter-lived than the scheduler would leak an entry whose `enabled` signal reads a destroyed
  injector. Returning a disposer (or hooking `DestroyRef`) is cheap insurance and matches what the
  table's feature host does.
- **`schedulerFeatureConfig`'s `'' → {}` normalization is repeated in all 15 feature directives.**
  Each one duplicates the same six-line `input({} as TConfig, { alias, transform })` +
  `computed(() => this.config().enabled ?? true)` pair. A small
  `schedulerFeatureInput('etSchedulerBadgeTitle')` helper returning both signals would remove ~90
  lines and make the pattern discoverable to a consumer writing their own feature.
- **`SchedulerAppointmentDragDirective`'s only job is a boolean.** It holds no state and does no
  work beyond `isEnabled()` (`scheduler-appointment-drag.directive.ts:35`) which the views inject
  optionally. That reads as ceremony next to a plain `appointmentDrag = input(true)` on
  `[etScheduler]`; if the directive form is kept for consistency with the badge features, the doc
  should at least say why it isn't just an input.
- **`setView(value: unknown)` should not be public.** `scheduler.component.ts:231-233` — make it
  `protected` and type the segmented group's `valueChange` instead, or expose a typed
  `setView(view: SchedulerView)`.

**Bundle size** (ranked)

- **`SchedulerEditSurfaceComponent` statically pulls in five form control families for a dialog most
  page loads never open.** `scheduler-edit-surface.component.ts:62-73` +
  `hostDirectives` reach `FORM_FIELD_IMPORTS`, `INPUT_IMPORTS`, `TEXTAREA_IMPORTS`,
  `RADIO_GROUP_IMPORTS`, `DATE_TIME_RANGE_INPUT_IMPORTS` (date-time inputs being by far the
  heaviest), plus `MENU_IMPORTS`, `BUTTON_IMPORTS` and the overlay strategies — and
  `SchedulerComponent` imports it statically for the zero-config path. A cross-entry-point or
  `@defer`ed surface (or at minimum lazy-stamping the field components) is the single biggest win
  available in this domain: a consumer rendering a read-only month grid pays for the whole forms
  stack today.
- **`scheduler-time-grid-view.component.css` (270 lines) is loaded by the day/week view even when
  nothing on the page is draggable.** The `[data-draggable]`/`[data-dragging]` rules and the two
  `*-resize` handle blocks (`:114-132`, `:236-269`) only matter with
  `etSchedulerAppointmentDrag` on. Per AGENTS.md's "CSS that belongs to an opt-in feature", those
  belong in a styles-only component that `SchedulerAppointmentDragDirective` mounts — the same shape
  as `ButtonPropertiesStylesComponent`. The all-day lane rules (`:91-132`) are similarly dead for
  any app with no all-day appointments, and the view already knows (`allDayRowCount() === 0`).
- **The three view components each duplicate the badge-stamping loop and the drag plumbing.**
  `startAppointmentDrag` in the month and time-grid views (`scheduler-month-view.component.ts:105-142`
  vs `scheduler-time-grid-view.component.ts:162-193`) are structurally identical apart from the
  range math, and the `@for (adornment of badgeAdornments())` + `*ngComponentOutlet` block appears
  four times across the templates. A shared `<et-scheduler-appointment-badge [node]>` component
  would collapse the four copies and give the agenda view its missing `[attr.title]` for free.
- **`et-scheduler`'s toolbar imports `FLOATING_ACTION_IMPORTS` and `SEGMENTED_BUTTON_IMPORTS`
  unconditionally** (`scheduler.component.ts:53-62`). The floating-action machinery is only ever
  used inside the `@if (isNarrow())` branch; since `isNarrow` is width-driven, a `@defer (when …)`
  would keep it out of the initial chunk for desktop-first apps.

**UI/UX** (ranked)

- **No keyboard model beyond Tab.** The docs admit it (`scheduler.md:394`), but the practical effect
  is that a week view with 40 appointments is 40+ tab stops with no way to move by day or hour, and
  the month grid is worse. Roving tabindex with arrow keys across cells (the pattern the calendar
  component already implements), `Enter` to open, and `PageUp`/`PageDown` to step the period is the
  fix — and it is also what would make the `gridcell` roles from High #3 legitimate rather than
  decorative.
- **The month day cell has no accessible date.** `scheduler-month-view.component.html:25` renders the
  bare day number, so the cell announces "15" with no month, year or weekday and no "today"
  indication beyond a background colour (`:19-20` sets `data-today` only). An `aria-label` with the
  formatted date plus `aria-current="date"` would cost two bindings.
- **The 24-hour body has no sticky hour gutter or sticky day header inside its own scroll
  container.** `.et-scheduler-time-grid-body` is the scroller
  (`scheduler-time-grid-view.component.css:38-41`) and holds both the gutter and the columns, so
  scrolling is fine vertically — but a week view narrower than ~700px has no horizontal affordance at
  all: seven `1fr` columns just squeeze (`:48-53`). A minimum column width with horizontal scroll and
  a sticky gutter is what makes a week view usable on a phone, and the docs' mobile story only shows
  the agenda.
- **No empty, loading or error state anywhere.** The month grid renders an empty skeleton, the agenda
  renders literally nothing when no day has an appointment
  (`scheduler-agenda-view.component.ts:29` filters every empty day out), and there is no way to
  indicate "still fetching" — awkward given the docs' own headline use case is a paged query
  (`scheduler.md:155-201`). An `et-empty-state` slot on the agenda and a `loading` input that
  overlays a skeleton would match how `et-table` handles the same problem.
- **Nothing animates.** Selecting a badge, opening the all-day lane as `allDayRowCount` grows, and
  the draft-range preview all snap. The draft preview in particular
  (`scheduler-time-grid-view.component.css:173-188`) changes border style *and* background on
  commit with no transition, which reads as a glitch rather than a state change.
- **Drag has no autoscroll.** `startSchedulerDragGesture` tracks the pointer but never scrolls the
  body (`headless/internals/scheduler-drag-gesture.ts`), so moving an 08:00 appointment to 19:00 in
  the week view is impossible without letting go — and the month view's cross-week drag has the same
  problem once the grid is taller than the viewport.
- **The "+N more" affordance is the only way to reach an overflowed appointment, and its menu drops
  most of the badge's information** (see the Medium finding). Expanding the cell on click, the way
  Google Calendar does, or at least rendering the full badge inside the menu, would keep the colour
  dot and time visible.

**Testing** (ranked, first pass order)

1. **The two overlay-opening effects in `scheduler.component.ts`** — both High findings are one spec
   away: assert exactly one surface per selection across an `appointments` identity change, and
   assert the draft survives it. This is also where a regression would be most expensive.
2. **The time-grid view's pure range math** — `snapToSlot`, `movedRange`, `resizedRange` and
   `allDayRange`'s three modes need no DOM beyond a stubbed `getBoundingClientRect`, and they encode
   every rule the docs promise ("never shrinks below one slot", "an edge dragged past the other stops
   there", "a move keeps the duration"). Currently zero coverage of any of them.
3. **`startSchedulerDragGesture`'s touch arming** — with `vi.useFakeTimers()` (and the bare global
   `setTimeout`, per the repo's known jsdom quirk) assert that a move before `TOUCH_ARM_DELAY`
   disarms and never tracks, that a long press held still arms and then blocks `touchmove`, and that
   both listeners are torn down on `finalize`.
4. **Feature registration** — one parameterized spec over the 15 directives asserting order,
   `enabled: false` removal, bare-attribute (`''`) config normalization, and the two `valid`
   computeds gating `canSave()`.
5. **A11y structure spec** — role/name assertions per view (once the grid container is fixed), plus
   the selected-state exposure and the month cell's accessible date. Cheap, and it locks down the
   claims the docs' Accessibility section makes.
6. **Test infrastructure**: a `SchedulerDriver` under `libs/components/src/lib/testing/` (see DX
   above) is the prerequisite for 1, 2 and 5; a `pointerSequence()` helper for
   pointerdown/move/up with `pointerType` would serve both the scheduler and the slider.

Clean: the layout internals (`scheduler-tree.ts`, `scheduler-month.ts`, `scheduler-agenda.ts`,
`scheduler-time-grid.ts`) are correct on re-reading — the column packer's cluster detection and
monotonic `columnEnds`, the all-day row packer, the midnight clipping, the dangling-`parentId`
fallback and the guide-continuation logic all hold up, and each is genuinely well specced. All nine
CSS files are wrapped in `@layer components`, contain no Tailwind, use `:where()` correctly for
config modifiers while leaving `:hover`/`:focus-visible`/`:active` bare, and resolve every colour
from `--et-surface-*` / `--et-theme-color-*` tokens (the two `rgb(0 0 0 / 0.25)` drag shadows match
the established lib-wide convention for shadows — `card`, `tooltip`, `slider`, `rich-text-editor` all
do the same). Reactive state is signals throughout with RxJS confined to the two genuinely
asynchronous places (the drag gesture's `timer`/`dragGestureFrom`, and the surface's
`outputToObservable` bridges), both with `takeUntilDestroyed` last in the pipe; there is no
subscribe-and-assign anywhere. The swipe directive's listeners are torn down via
`destroyRef.onDestroy`, and the drag gesture's `finalize(dispose)` releases both its arming timer
and its non-passive `touchmove` guard. `signalHostElementDimensions` is SSR-safe upstream, and
`getComputedStyle` in the swipe directive is only reachable from a touch event, so nothing in the
domain crashes on the server. `renderer.setStyle`'s object form
(`scheduler-month-view.component.ts:207`) is the core wrapper's real signature, not `Renderer2`'s.
The `DATE_FORMAT` round-trip in the time-range field is lossless (ISO with time by default), the
`injectColorPalette({ optional: true })` array/null handling is right, and the label system follows
the standard `defineLabels`/`toProvideFn` shape with `@__PURE__` annotations. The three view
directives' `ngDevMode`-gated `afterNextRender` misplacement checks, the five error codes, and the
feature-host injection helpers are all consistent with the rest of the lib.

---

## Batch 14 — menu / command-palette / toggletip / tooltip

Scope reviewed: every non-spec `.ts` / `.html` / `.css` under
`libs/components/src/lib/{menu,command-palette,toggletip,tooltip}` (incl. `headless/`,
`headless/internals/`, `stories/`), every spec in those folders, and
`apps/docs/components/{menu,command-palette,toggletip,tooltip}.md` plus the relevant rows of
`apps/docs/components/error-codes.md`.

Runtime verification used two throwaway specs
(`libs/components/src/lib/menu/__scan-verify.spec.ts`,
`libs/components/src/lib/command-palette/__scan-verify.spec.ts`), run with
`NX_NO_CLOUD=true npx vitest run --root libs/components <path>`; both were **deleted** afterwards.
No source file was modified.

---

## menu / command-palette / toggletip / tooltip

### High

- **The command palette closes on the first `Escape` even when the query is non-empty, so the documented "clear first, close second" never happens.**
  `command-palette-search.directive.ts:80-85` tries to swallow the key with a bubble-phase handler
  (`event.preventDefault(); event.stopPropagation();`) on the input, but the overlay registers its
  escape handler on the **document in capture phase** and checks neither `defaultPrevented` nor the
  event target: `libs/core/src/lib/overlay/overlay-runtime.ts:363-381`
  (`targetDocument.addEventListener('keydown', onKeyDown, true)` →
  `overlayRef.close(undefined, 'escape')`). The capture listener therefore runs *before* the input's
  handler. `command-palette.directive.ts` never opts out — `command-palette.overlay.ts:8-15` leaves
  `closeOnEscape` at its default `true`. `apps/docs/components/command-palette.md:202` promises
  "`Escape` | Clears the query, **or** closes the palette when the query is already empty."
  The menu gets this right by contrast: `menu.directive.ts:637` sets `closeOnEscape: false` and
  `menu.directive.ts:754-764` uses a bubble-phase document listener that skips
  `event.defaultPrevented`.
  *Runtime verified* — real overlay-mounted palette, query `"add"`, one `Escape` on the input:
  `[VERIFY palette esc] query after Escape = "" | overlay closed = true`. Both happened at once.
  Note `command-palette.component.spec.ts:188` ("clears the query on Escape instead of leaving it")
  passes only because it mounts the component directly, with no overlay runtime attached — the spec
  asserts a behaviour that does not hold in the only supported usage (`injectCommandPalette().open()`).

- **`etToggletipTrigger` overwrites the consumer's `etToggletipDisabled`, so a toggletip explicitly marked disabled still opens.**
  `toggletip-trigger.directive.ts:32-38` runs `setInputSignal(toggletip.disabled, button.isInactive())`
  on every change of the button's inactive state — including its first run, where `isInactive()` is
  `false`. The write is a blanket assignment, not a merge, so the value the consumer bound is lost.
  `toggletip-trigger.directive.ts:75` does the same again on destroy.
  *Runtime verified* — `<button [etToggletip]="'Hi'" [etToggletipDisabled]="true" etButton etToggletipTrigger>`:
  `[VERIFY toggletip trigger] etToggletipDisabled=true -> disabled() = false` and
  `[VERIFY toggletip trigger] opened anyway = true`. `apps/docs/components/toggletip.md:37,51`
  documents both `etToggletipDisabled` and the trigger's disable coupling as if they compose.

- **`[etTooltip]` destroys any `aria-describedby` already on its host element.**
  `tooltip.directive.ts:294-296` (`syncHostDescription`) calls
  `renderer.setAttribute(hostElement, 'aria-describedby', descriptionId)` unconditionally, from the
  constructor effect (`tooltip.directive.ts:92-102`), on every show
  (`tooltip.directive.ts:181`) and on every close (`:193`). A field that already points at its own
  help text or error line loses that reference the moment a tooltip is attached, and the
  `destroyRef.onDestroy` at `:115-118` sets it to `null` rather than restoring the original.
  *Runtime verified* — `<button [etTooltip]="…" aria-describedby="consumer-hint">` right after the
  first CD: `[VERIFY tooltip] aria-describedby after init = et-tooltip-description-1`. The
  consumer's id is gone before any interaction. (ARIA allows a space-separated list here, which is
  what the correct fix looks like.)

- **`autoFocus` does nothing when a menu is opened programmatically, leaving an open menu with no keyboard entry point — the opposite of what the docs say.**
  `menu.directive.ts:687-690`: `applyInitialFocus()` returns early when
  `this.openSource === 'hover' || this.openSource === 'api'`, and `openSource` is `'api'` for both
  `show()` (default parameter, `:192`) and any write to the `open` model (the mount effect at
  `:151-157` never sets a source). Nothing is focused, so the roving tabindex has no anchor
  (`activeItem()` stays `null`) and every arrow/Enter/Escape key the menu handles is unreachable —
  `handleKeydown` only fires from the panel, an item, or the search input, none of which have focus.
  `apps/docs/components/menu.md:143` documents `autoFocus` / default `true` as "Focus the panel/first
  item on open" with no exception, and `:144` lists `show()` alongside `[(open)]` as the way to open.
  *Runtime verified* — `menu.show()` with `autoFocus() === true`:
  `[VERIFY menu api-open] activeElement = BODY`, `[VERIFY menu api-open] activeItem = null`
  (the click path, covered by `menu.directive.spec.ts:132`, does focus the first item).

### Medium

- **A tooltip or toggletip whose content changes while it is open keeps rendering the old content, and keeps the old accessible name.**
  Both directives capture the content in a local and bind that local rather than the signal:
  `toggletip.directive.ts:163,186` (`mountToggletip(content)` → `inputBinding('content', () => content)`)
  and `tooltip.directive.ts:126,153` (same shape). The mount effect at
  `toggletip.directive.ts:104-122` does nothing when the overlay already exists and the content is
  merely different, so nothing re-renders. `toggletip.directive.ts:191-193` has the same problem one
  level worse: `ariaLabel`, `ariaLabelledBy` and `ariaDescribedBy` are read once into the
  `OverlayConfig` and can never be refreshed.
  *Runtime verified* — toggletip open, `text.set('Second content')`:
  `before = "First content"` / `after = "First content"` / `ariaLabel config = First content`.
  Same for the tooltip: `panel before = "First tip"` / `panel after = "First tip"`. A tooltip over a
  live value ("Last saved 5 minutes ago", the very example in `tooltip.md:14`) silently goes stale.

- **The palette's search field claims `aria-expanded="true"` and points `aria-controls` at an element that is not in the document whenever the query matches nothing.**
  `command-palette-search.directive.ts:22` hardcodes `'aria-expanded': 'true'` as a static host
  attribute and `:23` binds `aria-controls` to `palette.listboxId` unconditionally, but
  `command-palette.component.html:7-23` only renders the `role="listbox"` element inside
  `@if (resultGroups.length)` — the empty state replaces it with a `<p>`. A combobox pointing at a
  missing id with `aria-expanded="true"` is exactly the state screen readers report as a broken
  popup.
  *Runtime verified* — one registered command, then typing `zzzzz`:
  `aria-expanded = true | aria-controls = et-command-palette-list-0 | listbox present = false | resolves = false`.

- **A hover-shown tooltip cannot be dismissed with `Escape`, because the only Escape handler is a host listener that needs the trigger focused.**
  `tooltip.directive.ts:40-42` is the whole mechanism: `host: { '(keydown.escape)': 'hide()' }`.
  Hover does not move focus (that is the design — `setupHoverBehavior`, `:203-240`, never focuses
  anything), so `document.activeElement` is elsewhere and the keydown never reaches the host. There
  is no document-level fallback, unlike the menu (`menu.directive.ts:754-764`) or the toggletip
  (which gets it from the overlay's `closeOnEscape: true`, `toggletip.directive.ts:198`).
  `apps/docs/components/tooltip.md:37` states unconditionally "Hides when neither hover nor focus
  remains, **or on Escape**", and `:75` repeats it in the comparison table. WCAG 2.1 SC 1.4.13
  (Content on Hover or Focus) requires the dismiss mechanism to work without moving the pointer or
  focus. *Code-verified only* (needs a real hover to reproduce end-to-end).

- **`closeOnActivate="false"` is silently ignored on a selection item activated with `Enter`.**
  `menu-selection-item.directive.ts:153-156` closes the tree from `handleActivation` whenever
  `event.source === 'keyboard-enter'`, without consulting the item's `closeOnActivate`. Because
  `handleActivation` is driven by the `activate` output (`:79-84`) it runs synchronously inside
  `menuItem.activate.emit()` at `menu-item.directive.ts:163` — i.e. *before* the honest check at
  `menu-item.directive.ts:165` (`this.closeOnActivate() ?? this.defaultCloseOnActivate`) is even
  reached. So on a `<et-menu-checkbox-item [closeOnActivate]="false">` pointer clicks and `Space`
  keep the menu open as documented, but `Enter` closes it anyway. `closeOnActivate` is forwarded by
  both selection components (`menu-checkbox-item.component.ts:16`,
  `menu-radio-item.component.ts:16`) and documented as an item-level input in `menu.md:45`.
  *Code-verified only.*

- **The menu panel is a `role="menu"` whose `menuitem` children are three generic elements deep, and which also owns a textbox and a decorative scrollbar element.**
  `role="menu"` sits on `.et-menu` via the `MenuPanelDirective` host directive
  (`menu.component.ts:23`, `menu-panel.directive.ts:10`), but `menu.component.html` puts the items
  under `.et-menu-body-wrapper` → `.et-menu-body` → `.et-menu-body-content`
  (`menu.component.html:17-21`), and gives the same `role="menu"` two more children with no menu
  role: `.et-menu-header` containing `input[etMenuSearch]` (`:1-15`) and `<et-scrollbar>` (`:24`),
  which carries no `aria-hidden` (`scrollbar.component.ts:35-37`,
  `scrollbar/headless/scrollbar.directive.ts:67-69`). None of the wrappers carries
  `role="presentation"`/`role="none"`. WAI-ARIA requires a `menu` to own only
  `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator`, and a `textbox` is not among
  them — which is why the APG's searchable variant is a `combobox`, the shape the command palette
  itself uses (`command-palette-search.directive.ts:20-24`). `menu.md:172` claims "Full
  menu-pattern semantics are emitted automatically". *Code-verified only* (AT behaviour, not
  reproducible in jsdom).

- **`[etToggletip]` on a non-interactive element produces an `aria-haspopup="dialog"` popup nobody can open with a keyboard, with no dev-mode error.**
  `toggletip.directive.ts:31-38` binds `(click)`, `aria-expanded`, `aria-haspopup` and
  `aria-controls` on whatever host it is placed on, and adds neither `tabindex` nor a role. Only the
  separate `etToggletipTrigger` enforces a button (`toggletip-trigger.directive.ts:50-58`,
  `ET1501`), and `TOGGLETIP_IMPORTS` exports `ToggletipDirective` on its own
  (`toggletip.imports.ts:4-9`). A `<div [etToggletip]="…">` is a mouse-only dialog trigger that
  still advertises itself to assistive technology. The tooltip has the mirror-image gap: it listens
  for `focus` on the host (`tooltip.directive.ts:268`), which does not bubble, so `[etTooltip]` on a
  wrapper around a focusable child never shows on keyboard focus. *Code-verified only.*

- **The palette's global chord opens a second palette when one is already open from `injectCommandPalette().open()`.**
  `command-palette-shortcut.directive.ts:86-105` toggles against its own `openRef` only. A palette
  opened by a button handler (the documented alternative, `command-palette.md:146-154`) is invisible
  to it, so `mod+k` mounts a second `COMMAND_PALETTE_OVERLAY` on top of the first. The `preventDefault()`
  at `:78` fires unconditionally too, so the chord is swallowed from inside any other overlay as
  well. `command-palette.md:120` says the directive "opens the palette on a key chord, and closes it
  again on the same chord" without qualification. *Code-verified only.*

- **Every `[etTooltip]` with string content appends a hidden `<div>` to `document.body` before any interaction, and one per instance.**
  `tooltip.directive.ts:92-102` runs `syncDescriptionElement` from a constructor effect, and
  `:298-327` appends the element to `document.body` on first run. A table with 200 tooltipped cells
  puts 200 permanently-mounted nodes in `body` for descriptions no reader has asked for; the
  live tooltip already carries `role="tooltip"` and its own id (`tooltip.component.ts:13-18`), which
  is what `:181` switches `aria-describedby` to while shown.
  *Runtime verified* — one tooltip directive, no hover, no focus:
  `[VERIFY tooltip] hidden description divs in body = 1`.

- **`MenuSelectionGroupDirective` never re-syncs when `multiple` changes, so a group that flips modes at runtime keeps stale checked states.**
  `menu-selection-group.directive.ts:42-61`: the effect tracks `value()` and `items()` but reads
  `this.multiple()` inside the `untracked` block at `:52-53`. Flipping `[multiple]` while the value
  stays put leaves every item's `checked` as the old mode computed it — a single-select group turned
  multiple keeps exactly one item checked even though `value` is now read as an array (and vice
  versa: an array value under `multiple === false` matches nothing, so everything unchecks only on
  the next `value` write). `multiple` is a documented public input (`menu.md:104`). *Code-verified only.*

### Low

- **The `Escape` behaviour claimed for the palette's search field is unreachable dead code.**
  `command-palette-search.directive.ts:79-85` — the comment ("Escape clears a query before it closes
  the palette, so one key both undoes a search and leaves"), the `preventDefault`, the
  `stopPropagation` and the manual `element.value = ''` all exist to beat a listener that has
  already run. See the first High finding.

- **`ToggletipDirective.isOpen()/controls()/expanded()/popupRole()` and `ToggletipTriggerDirective.isOpen()/pressedVariant()` are `public` but exist only to back host bindings.**
  `toggletip.directive.ts:147-161`, `toggletip-trigger.directive.ts:81-92`. Compare
  `MenuTriggerDirective`, which correctly marks the equivalents `protected`
  (`menu-trigger.directive.ts:63-73`) and keeps only `isOpen()` public. They are also plain methods
  rather than `computed`, so `pressedVariant()` does a `getAttribute('data-variant')` DOM read on
  every change detection pass (`toggletip-trigger.directive.ts:90`), reading an attribute another
  directive's host binding owns.

- **`tooltip.showDelay` is the only delay input in the batch without a `numberAttribute` transform.**
  `tooltip.directive.ts:66` vs. `menu.directive.ts:88-89` (`hoverOpenDelay`, `hoverCloseDelay`, both
  transformed). Inconsistent, and it makes the static-attribute form (`showDelay="500"`) a template
  type error where the menu's equivalent is fine.

- **Two group headings whose labels differ only in punctuation collide on one DOM id.**
  `command-palette.component.ts:57-59`: `label.toLowerCase().replace(/[^a-z0-9]+/g, '-')` maps
  `"Rows!"` and `"Rows?"` to the same string, so `aria-labelledby`
  (`command-palette.component.html:14`) points two `role="group"`s at one heading. The palette
  already solves this correctly for rows by handing out ids **by position**
  (`command-palette.directive.ts:78-84`, with a comment explaining exactly why).

- **The ungrouped bucket renders a nameless `role="group"`.**
  `command-palette.component.html:14` emits `<div role="group">` for every group, but the ungrouped
  bucket has `label === null` (`rank-commands.ts:128`), so `aria-labelledby` binds `null` and the
  group has no accessible name. Wrapping only the labelled buckets would be equivalent and quieter.

- **The palette's result list is labelled with the search field's own name.**
  `command-palette.component.html:2,8` put `labels().searchLabel` on both the `combobox` and the
  `listbox`, so a reader hears "Search for a command" twice. `command-palette.md:180` documents this
  as intentional ("Accessible name of the field **and the list**"), but a list of commands is not a
  search field — a separate `listLabel` label would read better.

- **`error-codes.md:461` describes `ET4801` as checked "when the directive is created".**
  It is checked in `afterNextRender`, exactly like `ET4800` —
  `command-palette-shortcut.directive.ts:60-72`, with a comment saying why
  ("so the chord checked is the one the consumer wrote and not the default").

- **Two positional selectors couple the tooltip and toggletip stylesheets to the overlay's internal child order.**
  `tooltip.component.css:45` and `toggletip.component.css:38`
  (`.et-overlay--tooltip > :nth-child(2)`). Any change to what the overlay runtime stamps into a pane
  before the content silently retargets these rules; a class or `[data-*]` hook on the pane's content
  wrapper would survive.

- **`--et-command-palette-item-padding-inline` is registered in the item stylesheet but consumed in the palette stylesheet.**
  `@property` in `command-palette-item.component.css:8-12`, used by `.et-command-palette-group-label`
  in `command-palette.component.css:79`. A palette that renders no item never registers the
  property, so the heading's `padding-inline` resolves to the guaranteed-invalid value. Harmless
  today (no headings without items) but the wrong file.

- **Comment-policy: a handful of comments restate the code or narrate a mechanical choice.**
  `menu-item-submenu-icon.component.ts:6-14` (a four-line class JSDoc on an `@internal` component
  that explains the file layout), `command-palette-item.component.ts:42-43` ("Optional call: the test
  environment's DOM has no `scrollIntoView`" — narrating a test-env workaround at a call site),
  `command-palette-item.component.html:11-12`. `menu.directive.ts:250` ("already mounted (or still
  closing) …") and the `runs[i][j]` block in `fuzzy-match.ts:84-92` are the good kind and should stay
  — they name invariants a future edit would break.

### Spec coverage

**Well covered.**
- `menu/headless/menu.directive.spec.ts` (435 lines) is the strongest suite in the batch: open/close
  semantics, roving focus in DOM order incl. late-registered items, disabled skipping, `loop` off,
  submenu open/close with focus restoration, Enter/Space activation, `closeOnActivate`, outside
  pointerdown vs. pointerdown inside a pane, per-level Escape, Tab, typeahead, and a `hover intent`
  block with fake timers.
- `menu/headless/menu-search.directive.spec.ts` — query model, Escape-clears-first, the input as an
  arrow-key cycle stop, focus retained while the pointer crosses items, `aria-busy`, the error
  element wiring, printable-key forwarding.
- `menu/headless/menu-selection-group.directive.spec.ts` + `menu/menu-selection-groups.component.spec.ts`
  — single/multi selection, Enter-closes vs. Space-keeps-open, external value writes, standalone
  items, the icon variant, `formField` integration both directions.
- `command-palette/headless/internals/fuzzy-match.spec.ts` (20 cases) and `rank-commands.spec.ts`
  (18 cases) pin the ranking properties, not just examples — "matches every query character exactly
  once", "ranges ascending and non-overlapping", "the whole label across the segments".
- `command-palette/command-palette-registry.spec.ts` covers registration lifetime, signal sources,
  id collisions, double-destroy and `clear()`.

**Real logic with zero tests.**
- `command-palette-shortcut.directive.ts` (106 lines) — no spec at all. Neither chord matching, the
  bare-attribute transform at `:54`, the `ET4801` guard, nor `toggle()`'s ref tracking (the
  double-open Medium above) is exercised.
- `menu/headless/menu-context-trigger.directive.spec.ts` covers opening and repositioning but never
  the document-level listener's attach/detach cycle (`:81-108`) — the one place a listener could
  outlive its menu.
- `menu.component.ts` — the search spinner's deferred-loading gate (`:46`), the error-id effect
  (`:65-67`) and `injectAnimatedBlockSize` (`:71-74`) have no direct spec; only the
  directive-level `aria-busy`/`aria-describedby` are asserted, from the search spec.
- `menu-item.component.ts` — the `destructive` variant's forced error theme (`:43-55`) and the
  static `isSubmenuTrigger` chevron (`:40`) are untested.
- `tooltip/headless/tooltip.directive.spec.ts` (81 lines, 4 cases) tests only the description element,
  the describedby swap and the two guards. Untested: the whole hover pipeline with `showDelay`
  (`:203-240`), `pointerType === 'touch'` exclusion, the focus-visible gate (`:265-292`), and
  `dismissOnOutsidePointer` (`:247-263`).
- `toggletip/headless/toggletip.directive.spec.ts` (83 lines, 4 cases) never exercises the `(click)`
  toggle, `[(etToggletipOpen)]`, outside-click/Escape dismissal, focus restore, or
  `ToggletipCloseDirective` (13 lines, zero tests).
- `command-palette-item.component.ts`'s `afterRenderEffect` scroll-into-view (`:41-47`) and
  `command-palette-labels.ts`'s locale selection are untested.

**A spec that asserts the wrong thing.**
- `command-palette/command-palette.component.spec.ts:188` — "clears the query on Escape instead of
  leaving it". It mounts `CommandPaletteComponent` directly, with no overlay runtime, so the
  document-capture escape listener that actually wins in production is absent. The spec is green and
  the documented behaviour is broken (first High finding). Any fix must run the assertion through
  `injectCommandPalette().open()`, not the bare component.

---

### Improvements

#### Features (ranked)

- **Give the menu a virtualized / paged long-list mode, or at least an `activeItem`-driven scroll anchor.**
  `menu.directive.ts:557-612` walks `enabledItems()` linearly and `menu-item.directive.ts:124-129`
  scrolls each into view; a 500-row "assign to player" menu (the shape
  `menu-search-async-storybook.component.ts` demonstrates) renders every row. Material's
  `mat-select` and Ark UI's combobox both pair the panel with a virtual scroller.

- **Add `MenuDirective.openAt` support for the `contextmenu` key and long-press.**
  `menu-context-trigger.directive.ts:69-79` only listens for `contextmenu` from a mouse. The
  keyboard `ContextMenu`/`Shift+F10` key does fire `contextmenu` in browsers, but with
  `clientX/clientY` at 0 (or the element centre), so the menu lands in the viewport corner. Falling
  back to the focused element's rect when the event has no usable coordinates would make context
  menus keyboard-reachable, which they currently are not.

- **Let the command palette nest: sub-command modes ("go to file →", "change theme →").**
  `command-palette.directive.ts` has exactly one `query` and one flat `results`; every real palette
  (VS Code, Linear, Raycast) supports a command that swaps the list for its own arguments. The
  registry already keys by id (`command-palette-registry.ts:30-40`), so a `parent?: string` on
  `CommandPaletteCommand` plus a `mode` signal would be a small addition to a type that already has
  ten fields.

- **Add recency/frecency ordering to the palette.** `rank-commands.ts:90-101` breaks score ties by
  `priority`, label length, then alphabetically — deterministic but blind to what the reader actually
  runs. A `lastRun` timestamp kept by the registry and folded into the tie-break is the single
  highest-value ranking change; every peer palette does it.

- **Ship a `menu-item` loading/busy state.** `menu.component.ts` already knows about deferred
  loading for the search spinner (`:46`), but an item that kicks off async work has nowhere to show
  it — consumers currently disable the row, which also removes it from the roving focus order
  (`menu.directive.ts:121`).

#### DX (ranked)

- **`MenuDirective.show()` should focus by default, or take focus as an explicit option.**
  `show(source: MenuOpenSource = 'api', initialFocus: 'first' | 'last' = 'first')` overloads a
  *provenance* parameter with a *behaviour* decision — `applyInitialFocus` (`:687-690`) reads
  `openSource` to decide whether to focus at all, so the only way to open programmatically *and*
  focus is `show('keyboard')`, which is a lie about where the gesture came from. `show({ focus: true })`
  or a separate `focusOnOpen` argument would say what it means; either way the `autoFocus` docs
  (`menu.md:143`) need the caveat.

- **Make the toggletip/tooltip content bindings reactive instead of snapshots.**
  Replacing `inputBinding('content', () => content)` with
  `inputBinding('content', () => this.content())` in `toggletip.directive.ts:186` /
  `tooltip.directive.ts:153` is a one-line fix each and removes a whole class of "why didn't it
  update" reports. The aria fields (`toggletip.directive.ts:191-193`) need the overlay to accept
  signals or a post-mount setter, which is the larger part of the work.

- **Give the tooltip/toggletip a shared `[etTooltipOpen]`-style model.**
  The toggletip has `open` as a two-way model (`toggletip.directive.ts:62`); the tooltip has only
  `show()`/`hide()` and an internal `overlayRef` signal (`:70`). Sibling components with the same job
  should expose the same surface — a consumer wiring a tour or an onboarding hint has to reach for
  the imperative API on one and the declarative one on the other.

- **Reuse `lib/testing/driver-core.ts` in these specs instead of re-declaring its helpers.**
  `menu/headless/menu.directive.spec.ts:57-69` hand-rolls `keydown`, `pointerdown`, `pointerenter`
  and `flushFrames`; `driver-core.ts` already exports `flushFrames`, `latestPane`,
  `pointerDownOutside`, `pressKey`, `resetOverlays` and `tick`, and
  `overlay-control-driver.ts` wraps the two-frame open/close dance jsdom needs. Every spec in the
  batch pays for its own copy.

- **`ET1303` covers two unrelated misuses.** `menu-errors.ts:1303` is thrown both for "item outside
  a menu surface" (`menu-item.directive.ts:109`) and "selection item without `etMenuItem` on the
  same element" (`menu-selection-item.directive.ts:97`). `error-codes.md:178` has to describe both in
  one row. The 13xx range has plenty of room for a second code.

#### Bundle size (ranked)

- **Split `menu.component.css` (411 lines): the search header is a minority feature.**
  Lines 173-229 (header, search field, spinner slot, error line) plus the `--et-menu-search-height`
  property serve only a menu with `input[etMenuSearch]`, and lines 86-118 + 251-271 (the
  `@property`/`@keyframes`/mask block for the scroll fade) only a menu long enough to scroll. Both
  are exactly the "opt-in feature" case AGENTS.md describes: a styles-only component mounted from
  `MenuSearchDirective` via `injectStyleManager().mount(...)`, like
  `etTableVirtualScroll → TableVirtualScrollStylesComponent`.

- **`MenuComponent` eagerly imports `ScrollbarComponent` and `SpinnerComponent` for features most menus never use.**
  `menu.component.ts:11-12,22` — `<et-scrollbar>` is unconditional in the template
  (`menu.component.html:24`) and `<et-spinner>` only ever renders behind
  `@if (showSearchSpinner())` (`:5-7`). Both references are static, so both components and their
  stylesheets land in any bundle that imports a menu. The spinner is the easy win (move the header
  into a component the search directive pulls in); the scrollbar needs the panel to decide at runtime
  whether it scrolls.

- **`tooltip.component.css` (183 lines) and `toggletip.component.css` (205 lines) are near-duplicates.**
  The surface tokens (`--_et-*-background/color/border/shadow/radius/max-width`), the
  `> :nth-child(2)` fix, and all five animation blocks (enter/leave × four placements +
  `prefers-reduced-motion`) differ only in the class prefix and two timing values. An
  `et-floating-panel` base stylesheet both opt into, with per-component overrides, would remove ~150
  duplicated lines — and the menu's animation block (`menu.component.css:344-410`) is a third copy
  of the same structure.

- **`CommandPaletteItemComponent` pulls in `KbdComponent` for a field most commands omit.**
  `command-palette-item.component.ts:16` imports it statically for
  `@if (currentCommand.shortcut)` (`command-palette-item.component.html:27-29`). `shortcut` is
  documented as display-only and optional (`command-palette.md:92`), so the common palette pays for
  the keycap renderer and its stylesheet unconditionally.

#### UI/UX (ranked)

- **Nothing about the menu is reachable by keyboard after a programmatic open** — see the High
  finding. Even with `autoFocus` deliberately off, the panel should stay focusable enough that
  `Tab` lands somewhere sensible; today `activeItem()` is `null` and the first enabled item quietly
  holds `tabindex="0"` (`menu-item.directive.ts:69-83`) inside a pane appended at the end of `body`.

- **The tooltip is not hoverable, so the pointer cannot travel to it.**
  `tooltip.component.css:40,62` set `pointer-events: none` on both the pane and the surface, and
  `setupHoverBehavior` (`tooltip.directive.ts:228-239`) hides on `pointerleave` of the trigger. With
  `offset: 8` there is also a gap to cross. WCAG 1.4.13 requires hover content to remain visible
  while the pointer is over it — a "safe polygon" between trigger and panel (what Floating UI ships
  as `safePolygon`) plus dropping `pointer-events: none` is the standard fix, and it is what makes a
  tooltip with a link inside usable at all.

- **`hoverOpenDelay`/`hoverCloseDelay` are wall-clock only; there is no pointer-path intent.**
  `menu-hover-intent.ts` is a pair of timers. Crossing a sibling row on the way to a submenu still
  cancels the open (`menu.directive.ts:536,545`) and starts a 300ms close, which is the diagonal-travel
  problem every nested menu has. Tracking the pointer's direction — or the same safe-polygon trick —
  would make deep submenus feel intentional rather than twitchy.

- **A palette row's `mouseenter` steals the active row from the keyboard.**
  `command-palette-item.component.ts:27` (`(mouseenter)': 'palette.setActive(result())'`) fires
  whenever the list scrolls under a stationary pointer, because `afterRenderEffect` at `:41-47`
  scrolls the active row into view — arrow-keying past a row that happens to land under the cursor
  hands the highlight straight back. The usual guard is to ignore `mouseenter` until a real
  `mousemove` has been seen. The menu has the equivalent problem handled well
  (`menu.directive.ts:462-474`) and its reasoning is worth copying.

- **The palette's empty state is a bare centred sentence.**
  `command-palette.component.html:21-23`. `empty-state.md` exists as a domain in this library; a
  palette that found nothing is precisely where it belongs, and `noCommands` (nothing registered at
  all) deserves different treatment from `empty` (nothing matched) beyond a different string.

- **Nothing in the batch reflects `prefers-reduced-motion` for the *content* transitions.**
  All four stylesheets guard their overlay enter/leave (`menu.component.css:393`,
  `tooltip.component.css:165`, `toggletip.component.css:187`), and
  `menu-selection-item.component.css:82-86` guards the check mark. But
  `menu.component.css:296-299` (item background/colour/opacity, 120ms) and the whole
  `et-menu--resizing` block-size animation (`:163-171`, driven by `injectAnimatedBlockSize`) keep
  animating.

#### Testing (ranked)

- **First: an overlay-mounted palette spec.** The Escape bug, the `aria-controls`/`aria-expanded`
  mismatch and the double-open are all invisible to a bare-component fixture. One `describe` that
  opens through `injectCommandPalette()` — the way `command-palette/__scan-verify.spec.ts` did during
  this review — would have caught all three, and `overlay-control-driver.ts` already has the
  open/close plumbing.

- **Second: a hover/focus timeline spec for the tooltip.** `showDelay`, the `pointerType === 'touch'`
  exclusion, the focus-visible gate and `dismissOnOutsidePointer` are the whole point of the
  directive and none is tested. It needs `vi.useFakeTimers()` for the RxJS `timer` — and note the
  repo memory that fake timers never patch `window.setTimeout`, only the bare global.

- **Third: `command-palette-shortcut.directive.ts` from scratch.** `matchesKbdChord` is tested in the
  `kbd` domain, but the bare-attribute transform (`:54`), the `ET4801` guard and `toggle()`'s ref
  tracking are not. A spec here is cheap: dispatch a `KeyboardEvent` at `document` and assert one
  pane exists.

- **Fourth: a menu a11y-shape assertion.** A single spec that walks the open pane and asserts every
  child of `[role="menu"]` is an allowed owned role would have caught the header/scrollbar/wrapper
  problem, and would keep catching it as the panel template grows.

- **Fifth: `ToggletipCloseDirective` and `[(etToggletipOpen)]`.** Thirteen lines and a two-way model,
  both documented (`toggletip.md:38,48`), neither exercised.

---

`Clean:` The ranking core is genuinely solid — `fuzzy-match.ts`'s DP table, its traceback and the
`runs` third-state trade-off are correct and honestly documented, `rank-commands.ts` keeps the label
whole across segments, and both are pinned by property-style specs. The command palette registry
(`command-palette-registry.ts`) is leak-free: every `registerCommands` is tied to a `DestroyRef`,
`destroy()` is idempotent, and the id-collision rule is specified and tested. Subscription hygiene
across the batch is good — `menu.directive.ts`'s root document listeners are attached on mount,
detached on close *and* on destroy, `MenuContextTriggerDirective` mirrors that for its reposition
listener, `createMenuHoverIntent` cancels both timers on destroy, and the `MenuDirective` destroy
hook also unhooks itself from its parent's `openSubmenu`. Every registration directive
(trigger/surface/panel/search/item/selection item/group label) pairs its `set` with an
identity-checked `unregister`, so a re-rendered piece cannot null out its replacement. All eight
stylesheets are correctly wrapped in `@layer components`, use `:where()` for config modifiers while
leaving interaction states bare, resolve every colour from `--et-surface-*` / `--et-theme-color-*`
with static fallbacks only, and contain no Tailwind. Reactive-state conventions hold throughout:
synchronous state is signals, the only RxJS is genuinely async (document events, hover timers,
`afterClosed`), and there is no subscribe-and-assign anywhere. The menu's placement reasoning
(`resolvedMinAvailableSpace`, `resolvedArrow`, `resolvedOffset`) matches its docs, the roving-tabindex
computation correctly handles the no-active-item case, `sortByDomOrder` keeps late-registered items in
visual order, and the submenu-trigger-item's dual registration (item belongs to the parent, trigger to
the child) is both subtle and right. Story ids referenced from all four docs pages resolve against the
actual story titles.

---

## grid + masonry

Scope: `libs/components/src/lib/grid/**`, `libs/components/src/lib/masonry/**`, `apps/docs/components/grid.md`,
`apps/docs/components/masonry.md`. All non-spec sources read in full; specs read; four claims verified at runtime
with throwaway specs (now deleted, tree left clean).

Runtime verification command used:
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`

## High

- **A `Shift+Arrow` keypress inside any text field in a grid item resizes the widget and swallows the text
  selection.** `grid-item.component.ts:53` binds `(keydown)` on the item host and `applyKeyboardShortcut`
  (`grid-item.component.ts:261-330`) never checks `event.target`, so every keydown that bubbles up from
  projected content is treated as a grid command. Any dashboard widget containing an `<input>`, `<textarea>`,
  `contenteditable` or a `<select>` is affected — `Shift+ArrowRight` is "extend selection by one character" in
  every OS. **Runtime-verified**: a projected `et-grid-item` with an `<input>` inside, `keydown`
  `{key:'ArrowRight', shiftKey:true, bubbles:true}` dispatched from the input →
  `before {"col":0,"row":0,"colSpan":2,"rowSpan":2} after {"col":0,"row":0,"colSpan":3,"rowSpan":2}` and
  `defaultPrevented: true` (the selection is cancelled by `event.preventDefault()` at line 318).
- **`Ctrl/Cmd+Backspace` inside a text field in a grid item deletes the whole widget.**
  `grid-item.component.ts:323-328` removes the item for `Delete`/`Backspace` with a ctrl/meta modifier, again
  without an event-target check. `Ctrl+Backspace` (Windows/Linux "delete previous word") and `Cmd+Backspace`
  (macOS "delete to line start") are ordinary text editing keys, so a user editing a widget's title loses the
  widget — and the layout change is emitted, so the app persists the deletion. **Runtime-verified**: dispatching
  `{key:'Backspace', ctrlKey:true, bubbles:true}` from an `<input>` inside the item left
  `grid.currentItems() === []` (was `['test-item']`).
- **Grid items are focusable but have no focus indicator at all.** `grid-item.component.ts:52` sets
  `tabindex="0"`, `grid-item.component.ts:75` sets `outline: none` on `.et-grid-item`, and there is no
  `:focus`/`:focus-visible` rule anywhere in the domain (`grep -rn focus libs/components/src/lib/grid` returns
  nothing). Every keyboard interaction the docs advertise (`grid.md:118`) requires focusing an item first, so a
  keyboard user must move/resize blind. WCAG 2.4.7. Code-verified only (needs a browser to see, but the CSS is
  unambiguous — `outline: none` with no replacement).
- **Masonry never reveals its items if an item's border box is wider than the width the masonry assigns it.**
  `masonry-item.directive.ts:84-89` treats an item as measured only while
  `|rect().width - columnInlineSize| < 1`; `masonry-styles.component.css:41` never sets `box-sizing`. In an app
  without a global border-box reset, a card with padding or a border reports a border box wider than the
  content width the masonry set, so `isMeasured()` is false forever → `isSettled()` false forever →
  `hasBeenPlaced` never latches → every item stays at `opacity: 0` (`masonry-styles.component.css:49`), and an
  infinite scroll gated on `isSettled()` (the documented pattern, `masonry.md:102-112`) never fires.
  **Runtime-verified consequence chain**: with the spec's layout stub reporting a border box 10px wider than the
  assigned width, `isSettled: false`, `any [data-positioned]: false`, container height still `300px` — i.e. a
  blank block the size of the layout, no error. The trigger itself (getBoundingClientRect returns the border
  box while `style.width` sets the content box under `box-sizing: content-box`) is standard CSS and was not
  re-verified in a browser; Tailwind's preflight is why Storybook doesn't show it.
- **`masonry.items()` goes stale when the DOM is re-ordered, so a re-sorted feed does not re-lay-out.**
  `masonry.directive.ts:86` computes the pack order with `sortByDomOrder(...)` inside a `computed` whose only
  dependency is `registeredItems()`. A `@for` with `track` re-orders DOM nodes without creating or destroying
  directives, so nothing invalidates it. **Runtime-verified**: after reversing a 4-item list,
  `DOM order: [d,c,b,a]` but `items(): [a,b,c,d]`, and every placement is byte-identical to before the reverse
  (`d` still at column 1, block `116px`) — the item that is now first in reading order still renders stacked
  under `b`. This breaks the exact invariant both the code and the docs sell ("DOM order is reading order",
  `masonry.md:183`; "`items()` — the items in DOM order, which is the order they are packed in",
  `masonry.md:144`). `repack()` does not help: **runtime-verified** that after a reorder + `repack()` the
  placements are still the pre-reorder ones.

## Medium

- **The `remove` output on `et-grid-item` does not fire when the built-in remove button is used.**
  `grid-item-default-actions.component.ts:48-50` calls `grid.removeItem(itemId())` directly; the only
  `this.remove.emit()` is in the keyboard path (`grid-item.component.ts:326`). A consumer following
  `grid.md:83` ("the `remove` output … only reachable this way") and binding `(remove)` on a projected item gets
  nothing for the one removal path the UI actually offers. Code-verified.
- **An item removed with `removeItem()` (or the toolbar's remove button) comes back the next time the host's
  `items` signal emits.** The reconciliation effect classifies any id present in `items` but absent from
  `itemConfigs` as new and places it (`grid.directive.ts:387-391, 451-453`). Since `removeItem` only mutates the
  grid's own state, an app that persists `layoutChange` asynchronously (or not at all into that same signal) and
  then touches `items` for an unrelated reason — appending a widget, a re-fetch — resurrects the deleted item.
  Nothing in `grid.md:89` warns about it. Code-verified from the reconciliation branch.
- **`Ctrl+Shift+Arrow` performs a move *and* a resize in one keystroke.** `applyKeyboardShortcut` uses two
  independent `if` blocks (`grid-item.component.ts:271` and `:297`), not an `else if`, so both branches run.
  **Runtime-verified** on a 12-column breakpoint: `before {"col":0,…,"colSpan":2}` →
  `after {"col":1,…,"colSpan":3}`. The docs describe the two modifiers as separate gestures (`grid.md:118`).
- **`GridComponentRegistration.configComponent` and `GridItemRef` are dead config.**
  `grid.types.ts:92` accepts `configComponent`, and `grid.types.ts:99-103` declares an abstract `GridItemRef`
  documented as "Injectable reference provided to configComponent instances" — nothing in the domain reads
  either (`grep` across `libs/**`, `apps/**` finds only the declarations). A consumer wiring an edit-mode config
  component gets silence, and `GridItemRef` can never be injected because nothing provides it.
- **The grid's entire stylesheet is outside `@layer components`.** `grid.component.ts:74`,
  `grid-item.component.ts:55`, `grid-item-toolbar.component.ts:11` and
  `grid-item-default-actions.component.ts:27` are bare inline `styles`. AGENTS.md requires the wrap, and the
  reason bites here: `.et-grid-item { background: … }` (grid-item.component.ts:78) is unlayered, so it beats a
  Tailwind `bg-*` utility regardless of specificity and a consumer needs `!` to restyle a card. Siblings do wrap
  (`tabs/tabs/tab-group.component.ts`, `scrollable/headless/scrollable-*.component.ts`, and every `.css` file in
  the lib); grid is the largest bare sheet (~180 lines on the item alone).
- **Neither domain renders anything server-side, and masonry renders invisibly.** `grid.component.ts:27` gates
  every item behind `@if (grid.isReady())`, which is `containerWidth() > 0` — never true without a
  `ResizeObserver`, so SSR emits an empty region. Masonry emits the items but at `opacity: 0` with no offsets
  until JS measures. Neither is documented as a limitation, and for masonry it means a failed hydration leaves a
  correctly-sized but permanently blank block (same mechanism as the High above).
- **`masonry.isResizing()` / `data-resizing` is true for the first 150 ms after mount.**
  `masonry-resize-settled.ts:29` filters only the `0` emission, so the *first real* width flips `isResizing` on
  and it clears one debounce later — the exact opposite of the comment above it ("the first real width is not a
  resize") and of `masonry.md:141` ("changed width in the last 150ms"). **Runtime-verified**: right after the
  first measurement, `isResizing() === true` and the host carries `data-resizing=""`. Harmless for the built-in
  motion (nothing is armed to move yet), but any consumer styling or gating on it sees a phantom resize on
  every mount.
- **Masonry measures its container with `clientWidth`, so any horizontal padding on the host silently overflows
  the columns.** `masonry.directive.ts:93` reads `dimensions().client?.width`, which includes padding, while the
  absolutely positioned items are laid out from the padding box. `masonry.md:210` documents "don't put
  horizontal padding on the masonry element" as a constraint the consumer must remember — with no dev-mode
  check, unlike the two other things masonry does check. The grid solves the same problem properly by
  subtracting the computed paddings (`grid.directive.ts:246-274`).

## Low

- **`gridDebug()` / `isGridDebugEnabled()` / `GRID_DEBUG_STORAGE_KEY` are dead code with a module-level latch.**
  `grid.directive.ts:64-85`: `gridDebug` is never called anywhere in the repo, `cachedGridDebug` caches
  `localStorage` once per realm, and none of the three is exported from `headless/index.ts` — so they are neither
  used nor reachable.
- **`grid.imports.ts:16-18` claims a runtime gate that does not exist**: "the `et-grid-debug` localStorage flag
  only gates it at runtime". `GridDebugComponent` never reads that flag (or any flag) — once imported it always
  renders.
- **`layout-engine.ts:207` documents logging that does not exist**: "Log whenever a single-collision drag is
  evaluated so we can see why the swap does/doesn't fire" sits above a block with no logging in it.
- **All grid layout internals are public API of `@ethlete/components` and none are documented.**
  `grid/index.ts` → `headless/index.ts:11` → `internals/index.ts` re-exports `autoPlace`, `compactLayout`,
  `resolveCollisions`, `computeGeometry`, `createAutoScroller`, `findScrollableAncestor`, `hysteresisRound`,
  `SNAP_HYSTERESIS`, `clampResizeRect`, … Masonry does the opposite (`masonry/headless/index.ts` exports only the
  two directives and the token) — pick one.
- **`mapLayoutToBreakpoint` (`responsive.ts:29`) and `deserializeGridLayout` (`serialization.ts:36`) are used by
  nothing but their own specs**, yet are public exports with JSDoc. `deserializeGridLayout` also duplicates what
  `restoreState()` does.
- **Types used in the public API are not exported.** `ResizeItemOptions` and `GridDragState`
  (`grid.directive.ts:50-62`) are the parameter/return shapes of `resizeItem()` and `dragState()`, but
  `headless/index.ts` exports neither, so a consumer cannot name them.
- **Documented "One public token" is wrong.** `grid.md:220` lists only `--et-grid-padding` (+ the toolbar
  tokens), but the item stylesheet reads `--et-grid-item-radius`, `--et-grid-item-bg` and
  `--et-grid-item-resize-handle-color` (`grid-item.component.ts:77-78, 122`) and the directive publishes
  `--et-grid-gap` (`grid.directive.ts:170`).
- **Masonry's per-breakpoint maps resolve against the viewport, not the container.** `columnWidth`/`gap` use
  `numberBreakpointTransform`, which resolves through `injectCurrentBreakpoint()` (viewport media queries,
  `libs/core/src/lib/signals/breakpoint-input.ts:60`). The docs offer the map inside the section titled "Columns
  come from the container, not from breakpoints" (`masonry.md:44-61`) without saying the map is a window
  measurement — so a masonry in a collapsing sidebar gets its `md` column width from the window.
- **`MasonryItemDirective.isMeasured()`, `canMove()` and `inlineSize()` are public and undocumented**
  (`masonry.md:155-160` lists four members, the class exposes seven).
- **`aria-grabbed` is a deprecated ARIA 1.1 attribute** and is bound unconditionally (`"false"` when idle) at
  `grid-drag.directive.ts:30`; `grid.md:216` advertises it as the drag affordance. No AT support today.
- **An orphan projected `et-grid-item` (an id not in `items`) renders on top of the first item.** It gets no
  position, so `renderedRect()` is null and the host keeps `position:absolute; top:0; left:0` with intrinsic
  size, and no dev-mode error covers this direction (only the reverse, ET1904/ET1905). `grid.md:79` says such an
  item "has no position and is never placed", which reads as harmless.
- **Comment-policy violations are dense in this domain.** Beyond the three wrong comments above, `grid.directive.ts`
  carries ~20 explanatory/rationale comments (e.g. `:105-110`, `:129-134`, `:217-218`, `:393-395`, `:449-450`,
  `:516-518`, `:1065`, `:1085-1094`, `:1117-1128`), `layout-engine.ts` and `grid-math.ts` narrate most functions,
  and `grid.component.ts:29-31` puts a three-line explanation in the template. Masonry's are equally long, though
  more of them describe real invariants. Per AGENTS.md most of these are "rationale for a mechanical choice" and
  should go.
- **`grid-debug.component.ts` hardcodes ~20 hex colours** (`#d1d5db`, `#dc2626`, …) as primary values, against
  the token rule. Dev-only, but it also puts `takeUntilDestroyed` first in the pipe at `:219` (before `tap`),
  against the "`takeUntilDestroyed` last" rule; the same file gets it right at `:213`.
- **`masonry.directive.ts:17-20` interleaves `import` statements with a const declaration** (`isSameAssignment`
  sits between two import blocks).
- **`resolveBreakpoint` falls back to the string `'sm'`** for an empty `breakpoints` array
  (`responsive.ts:22`) — an SDK-invented breakpoint name in a domain where names are consumer-defined.

## Spec coverage

Well covered:

- `grid/headless/internals/*`: `layout-engine.spec.ts` (378 lines), `grid-math.spec.ts` (314),
  `responsive.spec.ts`, `serialization.spec.ts` — the pure geometry/packing is the best-tested part of the domain.
- `grid.directive.spec.ts` (675 lines): readiness, geometry, constraint layering incl. per-breakpoint merges and
  capping, item reconciliation (add/remove/data-only change), drag and resize lifecycles, withheld compaction,
  the uncovered-breakpoint warnings.
- `grid.component.spec.ts`: ET1904/ET1905 dev errors, ghost rendering, typed `layoutChange`.
- `masonry.spec.ts` (311 lines): column arithmetic (incl. the gap-aware count the docs promise), settling
  handshake, appending, re-columning, column-stability/pinning and `repack()`.
- `masonry-layout.spec.ts`: `resolveMasonryColumns` and the greedy/pinned packing.

Zero tests despite real logic:

- `internals/auto-scroll.ts` — a rAF loop with root-vs-element rect branching and four edge conditions; nothing
  exercises it.
- `grid-debug.component.ts` — 224 lines of diff/issue computation plus clipboard, untested.
- `grid-item-default-actions.component.ts` / `grid-labels.ts` — the remove button and the label wiring.
- `grid-adapter.ts`'s `toGridPosition`/`fromGridPosition` (the `mapGridLayout`/breakpoint parts are covered).
- `masonry-resize-settled.ts` — no spec, which is why the phantom-resize-on-mount above went unnoticed.
- `grid-drag.directive.spec.ts` is 84 lines with two smoke assertions ("instantiates without error", "not
  dragging by default"): the whole pointer drag path — grab-offset re-anchoring, the clamp to grid bounds, the
  document scroll/Escape listeners, breakpoint-change cancellation — is untested.
- Keyboard: only "no modifier does nothing" and "Shift+ArrowRight grows" exist
  (`grid-item.component.spec.ts:132-154`). `Ctrl+Arrow` moves, `Ctrl+Delete` removal, the `remove` output and
  the event-target problem behind the two High findings have no coverage.

Specs asserting the wrong thing:

- `masonry.spec.ts:198` "re-packs in DOM order when the items are re-ordered" passes while the reorder bug is
  live: it reverses three items across three columns and only asserts that all three `block` offsets are `0px`
  plus the container height — both true whether the pack order updated or not. It never checks `data-column`,
  the inline offsets, or `items()`.
- `grid-item.component.spec.ts:143` asserts `newPos.colSpan` is `toBeGreaterThanOrEqual(initialPos.colSpan)`,
  which also passes if nothing happened.
- `grid-item.component.spec.ts:26`, `grid.component.spec.ts:215/226/244` and `grid-drag.directive.spec.ts:36`
  put a `version: 1` property on `GridItemConfig` literals; the type has no such member, so these specs are not
  being type-checked by the vitest run (leftover from an older config shape).

Missing infrastructure: five grid spec files and the masonry spec each hand-roll a ~40-line `ResizeObserver`
mock plus `clientWidth`/`getBoundingClientRect` stubs. There is no grid or masonry test driver, unlike the
recently added form/dropzone drivers.

## Improvements

### Features (ranked)

- **Per-item `static` / `isDraggable` / `isResizable`.** The single biggest gap against react-grid-layout and
  gridstack for real dashboards: a KPI strip that must stay put currently has to be faked with
  `min*Span === max*Span` (which only pins size, not position). The constraint resolver
  (`grid.directive.ts:135-156`) is the natural place to carry the flags, and `resolveCollisions` already has the
  per-item `rowFloors` concept to build "immovable" on.
- **A drag-handle restriction on grid items.** Today the whole `.et-grid-item__content` is the handle
  (`grid-item.component.ts:216-219`), so a widget with a scrollable body, a chart with pan, or a text field is
  fighting the gesture. An `etGridItemHandle` marker directive that scopes `GridDragDirective`'s handle would
  also remove the need for the three `pointerdown` `stopPropagation` patches in the item's template.
- **Masonry windowing / measurement pooling.** One `ResizeObserver` per item (`masonry-item.directive.ts:51`)
  is fine for a page of cards and expensive for the infinite feed the docs target; a single shared observer
  (one instance, many `observe()` calls) would cut it without changing the API.
- **A fixed `columns` count for masonry.** `columnWidth` is the only lever; `auto-fit`-style "exactly N
  columns, share the width" is the other half of what `repeat()` gives in CSS and is trivial on top of
  `resolveMasonryColumns`.
- **Either implement or delete `configComponent`/`GridItemRef`.** An edit-mode config overlay per widget type is
  a real dashboard feature and the type already promises it (see the Medium above).
- **`gap`/`rowHeight` as breakpoint maps on the grid.** Masonry accepts `BreakpointInput`; the grid takes plain
  `numberAttribute` (`grid.directive.ts:182-183`), so a denser phone layout needs a host-side computed.

### DX (ranked)

- **Ship a grid and a masonry test driver.** Six spec files duplicate the same `ResizeObserver` +
  `clientWidth` + `getBoundingClientRect` stub. A `createGridHarness({ width, breakpoints })` /
  `createMasonryHarness({ containerWidth, heights })` in `libs/components/src/test-helpers` would make the
  keyboard and gesture paths cheap enough to actually test.
- **`GridItemConfig.layout` should be `Partial<Record<TBp, …>>`.** It is typed total
  (`grid.types.ts:39`), but `addItem` writes `{}` and the docs devote a paragraph to that case
  (`grid.md:208`) — the type currently lies about the one value the grid itself produces.
- **Make the `items` reconciliation rules discoverable.** "Structural change wins over a layout change",
  "`data` is copied by reference identity", "`removeItem` is invisible to the input" are three surprising rules
  living in comments inside one effect (`grid.directive.ts:370-459`). A short "how reconciliation decides"
  subsection in `grid.md` (and a named private method per branch) would make the two Medium findings above
  self-evident to a reader.
- **Export `ResizeItemOptions`, `GridDragState`, and stop exporting `internals/*`.**
- **Warn in dev when the masonry host has horizontal padding**, next to the two checks it already has — the
  failure (columns overflowing) is silent and the docs can only ask the reader to remember.

### Bundle size

- **Split the grid item's resize chrome into a styles-only component.** ~120 of the ~180 lines in
  `grid-item.component.ts:55-240` are the eight `:hover`/`--resizing` handle-marker rules; mounted from
  `GridResizeDirective` via `injectStyleManager()` (the `MasonryStylesComponent` pattern that this same domain
  already models), a read-only grid would never inject them.
- **Collapse the duplicated hover/resizing selector groups.** Each marker rule is written twice, once for
  `.et-grid-item:hover` and once for `.et-grid-item--resizing`; `:is()` halves 16 selectors to 8 and removes the
  copy-paste risk.
- **`GridDebugComponent` is a 224-line dev tool exported from the same barrel as everything else.** It is
  tree-shakeable only as long as nobody in the graph touches `GRID_DEBUG_IMPORTS`; moving it (and the dead
  `gridDebug` helpers) behind a `grid/debug` sub-path would make "never in production" structural rather than
  aspirational, and would match how `query-devtools` is split.

### UI/UX

- **Announce keyboard moves and resizes.** Ctrl+Arrow / Shift+Arrow change the layout with no `aria-live`
  feedback and no `aria-keyshortcuts`/`aria-describedby` on the item, so a screen-reader user has no way to
  learn the shortcuts or to know what happened. `GRID_LABELS` is already the localization seam for the
  message.
- **Restore focus after a removal.** `removeItem` destroys the focused element (`grid-item.component.ts:325`),
  dropping focus to `<body>`; focusing the next/previous item would keep keyboard editing continuous.
- **Resize affordances are hover-only.** The marker bars appear on `:hover` (`grid-item.component.ts:103-124`), so
  on touch there is no indication an edge is grabbable — the docs' 14px targets are invisible. A
  `@media (hover: none)` always-on (or on-focus) variant would help; the same file already uses
  `@media (hover: hover)` correctly in the actions component.
- **`role="group"` + `tabindex="0"` per item scales badly**: 20 widgets are 20 tab stops before any content.
  A roving-tabindex `role="application"`-ish container (or `role="grid"`/`gridcell` proper) is the peer-library
  answer.
- **Masonry has no empty state and no way to know it is packing.** `isSettled()` exists, but between mount and
  the first placement everything is `opacity: 0` with the container already sized — a skeleton hook (e.g. an
  `data-settling` attribute on the host, which `data-settled` almost is) would let a feed show something.

### Testing (ranked)

1. The two High keyboard findings: a spec per shortcut, dispatched from a nested `<input>` as well as from the
   host, asserting the layout does *not* change.
2. Masonry reorder: assert `items()` equals DOM order and that placements change, not just that three
   equal-column offsets stay `0px` (the current spec cannot fail).
3. `masonry-resize-settled`: mount → `isResizing()` false; one width change → true → false after the debounce.
4. `auto-scroll.ts` as a unit (it takes an injected `document` and `getScrollElement`, so it is directly
   testable with fake rects) — the scroll conditions and the `scrollBy` deltas.
5. A real drag gesture through `GridDragDirective` with a fake pointer sequence: grab offset, clamp at the grid
   edges, Escape cancellation, breakpoint-change cancellation.
6. `masonry` measurement mismatch: an item whose reported width never matches the assigned one should be
   surfaced as a failure mode, whatever the fix (assert on a dev warning, or on `box-sizing: border-box`).

Clean: the layout engine's termination properties (`compactLayout`, `resolveCollisions`' cascade and
`autoPlace` all terminate — the cascade only ever increases rows, and `autoPlace`'s inner loop always runs for
`columns >= 0`); geometry/serialization arithmetic matches every number in `grid.md` and `masonry.md`
(incl. the 1000px/240px/16px → 3 × 322.67px worked example); every gesture directive tears down its
listeners, its rAF loop and its subscriptions on destroy (`grid-drag.directive.ts:129-132`,
`grid-resize.directive.ts:112-115`, `grid-item.directive.ts:149`) and `takeUntilDestroyed` is used correctly
everywhere except the one debug-component pipe noted above; disabling the core resize handles mid-gesture is
harmless (the gesture runs off document listeners, `libs/core/.../resize-handles.component.ts:51-81`, and
`disabled` only sets `inert`); constraint registration is correctly value-compared and `untracked` so an inline
object literal cannot loop; the masonry pin/freeze feedback loop is correctly guarded
(`masonry.directive.ts:188-196`); masonry's CSS is properly layered, token-free by design and reduced-motion
gated; no XSS sinks, no Tailwind in component source, no hardcoded colour used as a primary value outside the
dev-only debug overlay; both domains' dev-mode `RuntimeError` messages are specific and actionable, and the
error-code ranges match the docs.

---

## Batch 15 — carousel / scrollable / scrollbar

Scope: `libs/components/src/lib/{carousel,scrollable,scrollbar}` (all non-spec `.ts`/`.html`/`.css`, plus
specs), and `apps/docs/components/{carousel,scrollable,scrollbar}.md` (+ the `error-codes.md` and
`sport-recipes.md` rows that reference them).

Runtime verification used `NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`
with scratch specs in the domain folders; all scratch files were deleted and the working tree is as found.

---

## Carousel

### High

- **`playOnInit="false"` does nothing — a carousel told not to start plays anyway.**
  `carousel-autoplay.directive.ts:182` sets the initial stopped state in the constructor:
  `this.isStopped.set(!this.playOnInit())`. A signal input is not bound yet when the directive is
  constructed, so `playOnInit()` returns its declared default (`true`) and `isStopped` is set to
  `false` regardless of the binding. The input is forwarded from `<et-carousel>` too
  (`carousel.component.ts:101`), so both the component and the headless directive are affected.
  **Verified at runtime.** `<et-carousel [playOnInit]="false" autoplay>` logged
  `playOnInit(): false`, `isStopped(): false`, `pauseReason(): null`, `isPlaying(): true` — i.e. the
  input reads as `false` after binding, but the latch that consumed it ran before that. The fix is a
  `linkedSignal`/effect off `playOnInit`, or reading it in `afterNextRender`.

- **A looping carousel whose slides have no layout on the first alignment pass never scrolls off the
  clones — it opens showing the second-to-last slide, permanently.**
  `carousel-loop.ts:198-228`: the effect writes the latch (`alignedShape = shape`, line 215) *before*
  attempting the measurement, then bails at line 224 when `trackLength` is 0. The comment on 221-223
  says "The children signal will fire again once they do", but (a) `domCount` is a `computed` over a
  length, so a children-array change that keeps the count produces no notification, and (b) even if
  the effect did re-run, `alignedShape === shape` short-circuits at line 213. So the one-shot
  alignment is consumed by a failed attempt. `trackLength` is 0 whenever every child's `offsetLeft`
  is 0 — a carousel inside a hidden tab panel, a closed accordion, a `display: none` overlay, or one
  rendered before its stylesheet is applied.
  **Verified at runtime.** Case A (four slides, `loop`, `cloneCount()=2`, `domCount()=8`; layout
  stubbed only *after* the first pass, then the children signal nudged with an ignored child):
  `scroll calls: []` — the container is never repositioned, so the track stays parked on
  `children[0]`, which is the clone of slide 3. Case B (same carousel with `offsetLeft`/`offsetWidth`/
  `clientWidth` stubbed from the very first render) reached `ScrollableDirective.scrollToOffsetUnsnapped`
  → `scrollElement.scroll(...)` on the first pass, proving the difference is the latch and not the
  stubs. Fix: set `alignedShape` only after a successful `scrollTo`.

- **The play/pause control's ARIA state contradicts both the carousel's actual state and its own
  rendered icon whenever autoplay is paused for any reason other than `stop()`.**
  `CarouselPlayToggleDirective.isPlaying` (`carousel-controls.directive.ts:110`) is
  `!(autoplay?.isStopped() ?? true)` — it only looks at the explicit stop flag — while
  `CarouselAutoplayDirective.isPlaying` (`carousel-autoplay.directive.ts:179`) is
  `pauseReason() === null && duration() > 0`, and the template's `data-playing`
  (`carousel.component.html:74`) uses the latter. Two different `isPlaying()` in one domain.
  **Verified at runtime.** With `autoplay` on and `isHovered` set: `pauseReason: hover`,
  `directive isPlaying: false`, `data-playing: null` (so the *play* icon is the visible one), but
  `aria-pressed: "true"` and `aria-label: "Pause automatic slide show"`. A screen-reader user is told
  the slide show is running and offered a pause when it is stopped and showing a play button. The
  same mismatch holds for `reduced-motion`, `page-hidden`, `off-screen` and `focus` — and
  `prefers-reduced-motion` means it is the *permanent* state for those users, which is exactly the
  cohort WCAG 2.2.2 is about.

### Medium

- **`autoplayTime="0"` leaves `pauseReason()` reporting "running" while nothing ever advances.**
  `carousel-autoplay.directive.ts:157-179`: `pauseReason()` never inspects `duration()`, so it
  returns `null` (its documented "autoplay is running" value, and what the docs table at
  `carousel.md:269-278` enumerates), while `isPlaying()` is `false` because of the `duration() > 0`
  guard. The two public signals disagree and neither says why. `duration` comes from
  `numberAttribute`, so `autoplayTime=""` also yields `0`. Code-verified only (the interaction is
  visible in the two computed definitions).

- **`transition="wipe"` is silently a no-op at any `itemSize` other than `'full'`.**
  Both driver blocks gate the whole effect on `:where([item-size='full'])`
  (`carousel-transition-styles.component.css:137-138`, `:201`, `:230`), so
  `<et-carousel itemSize="half" transition="wipe">` reports `data-transition="wipe"`, mounts the
  transition stylesheet, and runs the JS progress driver on every scroll frame — while producing no
  visible effect at all. The restriction is documented (`carousel.md:204-206`) and justified, but
  there is no dev-mode warning and the wasted driver still costs a per-frame custom-property write
  per slide. Code-verified only (needs real layout).

- **`transition="custom"` + `transitionDriver="none"` fills nothing, with no warning.**
  `carousel.directive.ts:331-339` resolves the driver to `'none'`, so
  `--et-carousel-slide-progress` is never written and any consumer CSS hanging off it sits at the
  registered initial value `0` (`carousel-transition-styles.component.css:13-17`) — every slide
  reads as permanently centred. The existing spec (`carousel.component.spec.ts:435-445`) asserts this
  combination is accepted; nothing asserts or warns that it is inert.

### Low

- **`playOnInit`, `pauseOnHover`, `pauseOnFocus` and `pauseOnOffScreen` are public inputs on
  `<et-carousel>` that the docs table never lists.** `carousel.component.ts:101` forwards all four via
  `hostDirectives`; the input table at `carousel.md:74-85` stops at `labels`. `pauseOnOffScreen` is
  named once in prose (`carousel.md:283`); `playOnInit` appears nowhere in `apps/docs`, and is also
  absent from the story argTypes (`carousel/stories/carousel.stories.ts:33-44`).
- **`CarouselAutoplayPauseReason`'s doc comment claims the union is written "in the order the reasons
  are checked" and it is not.** `carousel-autoplay.directive.ts:27-28` puts `'no-slides'` last, but
  `pauseReason()` checks it fourth (line 161), ahead of `page-hidden`, `off-screen`, `hover` and
  `focus`. The docs table (`carousel.md:269-278`) uses a third order again.
- **`CAROUSEL_ERROR_CODES` declares `MISSING_SCROLLABLE: 3803` before
  `AUTOPLAY_WITHOUT_PAUSE_CONTROL: 3802`** (`carousel-errors.ts:8-10`) — out of numeric order relative
  to every sibling error-code file, and relative to the docs table.
- **`--et-carousel-wipe-dim-color` registers `#000` as its `initial-value`**
  (`carousel-transition-styles.component.css:36-40`), a hardcoded colour used as the primary value of
  `background:` at line 155. The comment argues the case (a dimming, not a tint) and it is overridable,
  but it is the one place in this batch that does not resolve from a `--et-surface-*` /
  `--et-theme-color-*` token.
- **Comment-policy: the carousel is by far the most heavily commented domain in the batch.**
  `carousel.directive.ts` alone carries ~120 lines of explanatory prose, including banner dividers
  (`carousel-transition-styles.component.css:42`, `:129`, `:161`, `:213`;
  `carousel-autoplay-styles.component.css:37-51`) and rationale-for-a-mechanical-choice paragraphs
  that AGENTS.md lists under "Always delete". Several are genuinely case 1/2/3 material (the snap
  overrule, the `scrollend`-not-mid-animation constraint, the ±1 progress range) and should survive;
  the perf archaeology and the "why the effects are written twice" essay belong in the docs page,
  which already carries most of it verbatim.
- **Typo in a comment: `--et-carousole-slide-progress`** (`carousel-transition-styles.component.css:48`).
- **The measured numbers in the code comment and in the docs disagree.**
  `carousel-autoplay-styles.component.css:50` says "~120 paints and ~45 recalculations";
  `carousel.md:318` says "~139 and ~89" for the same measurement.
- **The dots have no group label.** `carousel.component.html:38` renders a bare `<div class="et-carousel-dots">`
  around N buttons; each button is labelled, but the set is not named or exposed as a `tablist`/`group`,
  so a screen-reader user meets eight unrelated "Go to slide N" buttons.

---

## Scrollable

### High

- **`[etScrollableActiveChild]` does nothing at all, and three doc pages promise that it does.**
  `scrollable-active-child.directive.ts:19-26` builds the `ref` object and then only registers the
  *unregister* callback — there is no call that adds it to the scrollable. `ScrollableDirective` has
  no `registerActiveChild` method either: `activeChildren` (line 141) is only ever read by
  `getActiveChildren()` (line 420) and only ever *filtered* by `unregisterActiveChild()` (line 275).
  Nothing anywhere reads `getActiveChildren()`, so nothing scrolls to an active child even in
  principle. Meanwhile `apps/docs/components/scrollable.md:111` says "marks a child as active so it's
  auto-scrolled into view (great for tab-bar-like lists)", line 117 says `getActiveChildren()`
  "expose[s] the tracked children", the page's opening example uses it (line 8), and
  `apps/docs/components/sport-recipes.md:45` builds a recipe on it ("the rail opens on the match
  that's being played"). The `sport-recipes` story
  (`match/stories/sport-recipes-storybook.component.ts:35`) demonstrates the same dead binding.
  **Verified at runtime.** Two `[etScrollableActiveChild]="true"` children inside an `<et-scrollable>`:
  `getActiveChildren()()` logged `length: 0`. Also `isActiveChildEnabledSignal`
  (`scrollable-active-child.directive.ts:14`) is a `linkedSignal` nothing ever reads, and
  `ScrollableActiveChildRef` is an exported type describing a shape that is never constructed for a
  consumer.

- **`ScrollableNavigationComponent` puts `takeUntilDestroyed()` first in a pipe that `switchMap`s into
  `fromEvent`, so the scroll listener it opens is never torn down.**
  `scrollable-navigation.component.ts:198-215`: `takeUntilDestroyed()` is the first operator (line
  200), then `filter` → `switchMap(() => fromEvent(container, 'scroll'))`. On destroy the *source*
  completes, but `switchMap` does not complete until its inner observable does, and `fromEvent` never
  completes — so the subscription (and the DOM listener, and the `tap` that writes
  `manualActiveNavigationIndex` on a destroyed component) outlives the component. Triggered by any
  click on a navigation dot. This is exactly the AGENTS.md rule "`takeUntilDestroyed` last in pipes".
  **Verified at runtime** with the same operator chain in isolation: with `takeUntil` first,
  `scroll listeners added: 1`, `scroll listeners removed after destroy: 0`; moving `takeUntil` to the
  end of the pipe gives `scroll listeners removed: 1`.

### Medium

- **`(intersectionChange)` silently emits nothing unless some unrelated feature happens to have turned
  the observer on.** `ScrollableDirective.childIntersections` (`scrollable.directive.ts:129-133`) is
  gated on `childIntersectionsActivated`, which only `activateChildIntersections()` flips —
  called by the masks component, the snap/darken/navigation directives and `etCarousel`, but never by
  the output itself (`scrollable.component.ts:72-85`). So `<et-scrollable renderMasks="false"
  (intersectionChange)="…">` with no opt-in feature is a documented output
  (`scrollable.md:116`) that never fires.
  **Verified at runtime.** `renderMasks=false`, three children: one emission, `[[]]`. With
  `renderMasks` left at its default: one emission with three entries. The output should call
  `activateChildIntersections()` when it has a subscriber, or the docs should state the dependency.

- **The `ET2100` error message and its docs row both point at a `registerScrollContainer()` that does
  not exist.** `scrollable.directive.ts:255-257` tells the developer to "Use registerScrollContainer()
  from the Tier 3 template"; `apps/docs/components/error-codes.md:264` repeats it. `grep` over
  `libs` + `apps` finds the identifier only in those two strings. The actual mechanism is setting the
  public-but-`@internal` `scrollContainerRef` signal (`scrollable.directive.ts:85`), which
  `ScrollableComponent` does at `scrollable.component.ts:111-118`. The message also leaks internal
  jargon ("Tier 3 template") into a consumer-facing error, and there is no documented headless path
  for `[etScrollable]` at all despite the directive being exported.

- **`ScrollableComponent` bridges two view queries with `.subscribe()`-and-assign.**
  `scrollable.component.ts:111-127` runs `toObservable(viewChild).pipe(tap(set))` twice to copy a
  signal into another signal — the pattern AGENTS.md's reactive-state rule forbids ("never by
  `.subscribe()`-ing and assigning the value somewhere"). The carousel does the same job with an
  `effect` and an explicit `prefer-linked-signal` disable (`carousel.component.ts:204-209`), so the
  two siblings solve one problem two ways. It also means the `takeUntilDestroyed()` on line 112/121 is
  the only thing keeping two subscriptions alive for the component's whole life to do the work of one
  `effect`.

- **`scrollOneItemSize` / `scrollOneContainerSize` do nothing when the intersection observer was never
  activated.** `scrollable.directive.ts:353-357` returns early on an empty `childIntersections()`, and
  line 338 needs it too. Both are reachable from `scrollToStartDirection()` / `scrollToEndDirection()`
  — documented public API (`scrollable.md:117`) — on a scrollable with `renderMasks="false"` and no
  snap directive. Same root cause as the `intersectionChange` finding.

### Low

- **`ScrollableIntersectionChange`, `ScrollableScrollState` and `ScrollableActiveChildRef` are exported
  from `headless/index.ts` (lines 14, 18, 26) but `ScrollableActiveChildRef` describes a shape no
  consumer can obtain** — see the High finding.
- **A `FIXME` with no issue link.** `scrollable-navigation.component.ts:206-207` — AGENTS.md lists
  "`TODO`/`FIXME` without an issue link" under "Always delete". (The sentence after it is also just
  restating the `eslint-disable` on the next line.)
- **Section-divider comments throughout.** `scrollable.directive.ts:69`, `:82`, `:87`, `:91`, `:102`,
  `:127`, `:135`, `:139`, `:143`, `:150`, `:175`, `:197`, `:224`, `:264`, `:329`; and
  `scrollable.component.css:51`, `:94`, `:182`, `:285`, `:315`, `:347`, `:380`, `:388`, `:410`, `:431`.
  All are the `// --- Inputs ---` / `/* --- Vertical --- */` form AGENTS.md says to delete.
- **`ScrollableNavigationComponent` reads `--et-theme-color-primary` where the rest of the library
  reads `--et-theme-color-primary-solid`.** `scrollable-navigation.component.ts:60` vs 233 uses of the
  `-solid` form under `libs/components/src`. The alias is legitimate here (the component does not
  override `--et-theme-color-primary-opacity`), but `libs/core/src/lib/theming/color-theming.docs.mdx:183`
  warns the alias resolves at its declaring scope, so this is the fragile choice of the two.
- **Un-prefixed custom properties on a public component.** `scrollable.component.css:3-5` declares
  `--mask-size` and `--darken-non-intersecting-items-amount` — the two knobs a consumer would want to
  set — with no `--et-` prefix, no `@property` registration, and no mention in `scrollable.md`'s
  options table. Every sibling in this batch (`--et-carousel-*`, `--et-scrollbar-*`) does the opposite.
- **`showLoadingTemplate` is missing from the docs options table** (`scrollable.md:53-65`); it is only
  named in passing at line 111, while its companion `loadingTemplatePosition` gets a row.
- **`scrollable.md:102-108` has a broken list: an em-dash clause starting the next bullet** ("- a mouse
  button produces no fling…"), which renders as a second list item mid-sentence.

---

## Scrollbar

### Medium

- **A headless `[etScrollbar]` marks its target `et-scrollbar-host` and then leaves the native
  scrollbar visible, so the container shows two scrollbars.** `scrollbar.directive.ts:213-219` adds the
  class unconditionally, but the rule that acts on it lives in `scrollbar.component.css:27-33` — i.e.
  it only reaches the document once `<et-scrollbar>` is instantiated. Both the directive JSDoc
  (`scrollbar.directive.ts:55-56`) and the docs (`scrollbar.md:107-118`) state this and give the
  snippet to copy, so it is a documented cost rather than a surprise — but it is the one piece of the
  domain that the styles-only-component pattern used elsewhere in this repo (see
  `CarouselTransitionStylesComponent`, mounted by the *directive* via `injectStyleManager()`) would
  fix outright, and the class the directive writes has no effect without it.

### Low

- **`--et-scrollbar-thumb-color` and `--et-scrollbar-thumb-active-color` are read
  (`scrollbar.component.css:73`, `:97`) but neither `@property`-registered alongside the other four
  tokens (lines 2-24) nor listed in the docs theming table** (`scrollbar.md:137-142`); they are only
  mentioned in the prose at line 146. Unregistered means they cannot interpolate, which matters
  because the thumb transitions `background-color`.
- **`data-direction` is undocumented.** `scrollbar.md:104-105` lists what the headless directive writes
  and names only `data-orientation`; `scrollbar.directive.ts:197` also writes `data-direction="rtl"`,
  which `scrollbar.component.css:47-49` depends on — a consumer building their own track from the
  documented list will get a right-to-left thumb positioned from the wrong edge.
- **`ELEMENT_NODE_TYPE = 1`** (`scrollbar.directive.ts:42`) reimplements `Node.ELEMENT_NODE`.
- **`isRtl()` calls `getComputedStyle`** (`scrollbar.directive.ts:134`), as does
  `ScrollableDirective.gapValue` (`scrollable.directive.ts:232`). Neither is platform-guarded. Both are
  reached from a `computed` that the host bindings read, so a server render evaluates them; whether
  that throws depends on the SSR DOM shim, so this is flagged rather than claimed — no SSR harness
  exists in this workspace to check it against.

---

## Spec coverage

**Well covered**

- `scrollbar/headless/internals/scrollbar-geometry.spec.ts` (141 lines) is the strongest spec in the
  batch: thumb sizing, `minThumbSize` clamping, the track-size clamp, end-of-content offset, the
  no-overflow and no-layout cases, and both RTL paths (reading `scrollLeft` as a magnitude, writing a
  negative offset). Pure functions against a fake target, so it does not need layout.
- `scrollbar/scrollbar.component.spec.ts` covers the ref-counted `et-scrollbar-host` class across two
  axes and destruction, `preventDefault` on a thumb press (and its absence while `disabled`), and
  `et-scrollbar--visible` while disabled.
- `carousel/carousel.component.spec.ts` (447 lines) covers the region/slide/dot semantics, label
  localization, the `<et-carousel>`-must-not-autoplay override, the pause-control hover/focus
  subtraction, `pauseReason` transitions, `autoplayTimeFor`, and a thorough `looping` block (clone
  count and placement, `slideIndexOf` mapping, no clones without `loop` or without overflow, re-cloning
  on a slides change, `itemSize="third"` growth and the cap at `count`).

**Files with real logic and zero tests**

- `carousel/headless/internals/carousel-loop.ts` — the seam crossing, `restingChildIndex`, the
  centred-vs-start resting offset, and the alignment effect that carries the latch bug above. Nothing
  covers any of it; it is also the file the two carousel High findings live in or next to.
- `carousel/headless/internals/carousel-slide-progress.ts` — the progress formula, the
  `WRITE_THRESHOLD` skip, `clearWrittenProgress`, and `flush()`. The formula is a pure expression over
  three numbers and is directly unit-testable.
- `carousel/headless/internals/carousel-scroll-settled.ts` — the `scrollend`-vs-debounced-`scroll`
  fallback, and the deferral while a pointer is down (`isSettleDeferred`), which is the whole reason
  the file exists.
- `carousel/headless/carousel.directive.ts` — `goToDomIndex`'s two-hop instant-then-animate scroll,
  `stepDomIndex`, `nearestDomIndexOf` (the "shorter way round" the docs promise at
  `carousel.md:141-142`), and `requestedDomIndex` bookkeeping. The spec only ever reads
  `slideIndexOf`; no test calls `next()`, `previous()` or `goTo()`.
- `carousel/headless/carousel-controls.directive.ts` — the `aria-pressed`/label logic that the third
  High finding is about.
- `scrollable/headless/scrollable-navigation.component.ts` — the `navigation()` computed (start/end
  overrides, highest-ratio reduce, `activeOffset`), the sliding-window `transform`, and the manual-index
  reset that leaks. Zero tests.
- `scrollable/headless/scrollable-snap.directive.ts` — the ref-counted suspend/release around a cursor
  drag, and `glideToNearestChild`'s three-way race (`scrollend` / `pointerdown` / timeout). Zero tests.
- `scrollable/headless/scrollable-buttons.directive.ts`, `scrollable-darken.directive.ts`,
  `scrollable-drag.directive.ts`, `scrollable-loading-template.directive.ts` — the shared
  `config === '' ? … : …` shorthand and the `enabled` gate are only touched indirectly by the one
  opt-in-features test (`scrollable.component.spec.ts:126-138`).
- `scrollable/headless/scrollable.directive.ts` — `suspendSnap`'s ref counting, `scrollToOffsetUnsnapped`,
  the `isScrollableChildIgnored` filter and the whole `registerChrome`/`activeChrome`
  filter-sort-resolve pipeline. Only `snap` presence and the chrome *stamping* are asserted.
- `scrollbar/headless/scrollbar.directive.ts` — `startThumbDrag`'s delta→offset mapping (including the
  RTL sign flip and the `cancelled` restore) and `pageTowardsPointer`'s direction choice. The geometry
  helpers they call are tested; the mapping is not.
- `scrollbar/headless/internals/scrollbar-host-class.ts` — covered indirectly by the component spec,
  which is adequate.

**Specs asserting something questionable**

- Nothing asserts a wrong behaviour. Two things are worth noting:
  `carousel.component.spec.ts:435-445` locks in `transition="wipe"` + `transitionDriver="none"` as
  "accepted" without asserting that anything happens, which is the inert combination flagged under
  Medium; and `carousel.component.spec.ts:128-130` correctly annotates that it is asserting a
  jsdom-no-layout artefact (`canGoPrevious()` false because the active slide never leaves 0) rather
  than real behaviour — fine as written, but it means the non-looping end-of-track behaviour is
  effectively untested.
- `scrollable/scrollable.component.spec.ts:12-69` hand-rolls `ResizeObserver` and
  `IntersectionObserver` mocks in the spec file even though it already imports `../../test-helpers`,
  which is where the repo's jsdom shims live. That divergence is why this spec cannot assert anything
  about intersections.
- `scrollable/headless/scrollable-ignore-child.directive.spec.ts` binds `[enabled]` but never checks
  the thing the attribute exists for — that `ScrollableDirective.scrollableChildren()` actually drops
  the child, and that the CSS snap rule
  (`scrollable.component.css:87`) skips it.

---

## Improvements

### Features

1. **Give the carousel keyboard navigation on the track.** Material's and Ark UI's carousels answer
   `ArrowLeft`/`ArrowRight`/`Home`/`End` on the region; here the only keyboard path is the native
   scroll container's, which moves by scroll step rather than by slide, so a keyboard user cannot
   reach "slide 4" the way a mouse user can. `CarouselDirective` already has `goTo`/`next`/`previous`
   and the region host — a `(keydown)` host binding on `carousel.directive.ts:91-99` is nearly the
   whole feature.
2. **Add `activeIndexChange` (and a `scrollend`-settled `slideChange`) to `etCarousel`.** `activeIndex()`
   is a signal a consumer has to `effect` over to react to; every peer library exposes an event. The
   settle callback in `carousel.directive.ts:359-384` is already the exact place a "the carousel has
   arrived at slide N" output belongs.
3. **A `role="scrollbar"` opt-in for `etScrollbar`.** `scrollbar.md:120-133` argues well for the
   default, but a container that is *not* itself focusable (a virtualised list, a `contenteditable`
   sibling) has no keyboard path at all, and PrimeNG/Radix both offer the ARIA scrollbar as a choice.
   `geometry().progress` already supplies `aria-valuenow`.
4. **Expose the scrollable's `activeSnapOrigin`/`isSnapSuspended` and `suspendSnap()` as public API.**
   All three are `@internal` (`scrollable.directive.ts:161`, `:173`, `:297`) yet `scrollable.md:92-108`
   documents `suspendSnap()` to consumers by name. Any app writing its own scroll offset onto a
   snapping track needs it for the reason that section explains.
5. **Vertical `wipe`.** `carousel-transition-styles.component.css:101-108` hardcodes the inline axis
   (`50cqw`, `translate:` with one value), so `direction="vertical"` + `transition="wipe"` produces a
   horizontal wipe on a vertical track. `dim` is axis-agnostic already.

### DX

1. **Delete or finish `etScrollableActiveChild`.** It is the single worst DX item in the batch: a
   documented, story-demonstrated, recipe-endorsed directive that does nothing. Either wire
   `registerActiveChild` + an effect that scrolls the first enabled child into view, or remove the
   directive, `ScrollableActiveChildRef`, `activeChildren`, `unregisterActiveChild` and
   `getActiveChildren`, and fix the three doc pages.
2. **Make `ET2100`'s message describe an API that exists.** See the Medium finding. While there,
   drop "Tier 3" from consumer-facing text — the tier vocabulary is internal architecture and appears
   nowhere in `apps/docs`.
3. **Have the intersection-dependent public API activate the observer itself.** `intersectionChange`,
   `scrollToStartDirection()`/`scrollToEndDirection()` and `scrollOneItemSize` all quietly no-op when
   no feature happened to call `activateChildIntersections()`. Making the output activate on
   subscription, and the scroll methods activate on first call, removes a whole class of
   "why is nothing happening" reports.
4. **A test driver for each of the three domains.** None exists. The carousel spec re-invents
   `settleChildren` (`carousel.component.spec.ts:65-68`) and the scrollable spec re-invents the
   observer shims; a `CarouselDriver` (slides, dots, controls, `settle()`), a `ScrollableDriver`
   (`fakeLayout(slideSize)`, chrome queries) and a `ScrollbarDriver` (thumb drag as a pointer
   sequence) would make the untested files above testable at all. A shared `fakeLayout` helper is the
   highest-leverage single piece: it is what let me verify the loop-alignment finding, and it is what
   every layout-dependent behaviour in this batch needs.
5. **`ScrollableChrome` registration is a good extension point with no documentation.**
   `scrollable-chrome.ts` is well commented and `registerChrome()` is public and unmarked
   (`scrollable.directive.ts:270`), but `scrollable.md` never mentions it, so the only way to learn how
   to add chrome is to read the buttons directive.
6. **`config === '' ? {} : config` is repeated in both chrome directives**
   (`scrollable-buttons.directive.ts:41-45`, `scrollable-navigation.directive.ts:26-30`) with
   slightly different shapes. One `resolveChromeConfig` helper would also give the two the same
   behaviour for `[etScrollableButtons]="undefined"`.

### Bundle size

1. **Move the `et-scrollbar-host` rule into a styles-only component the *directive* mounts.**
   `scrollbar.component.css:27-33` is four declarations that every headless consumer has to copy by
   hand (see the Medium finding). A `ScrollbarHostStylesComponent` mounted from
   `scrollbar.directive.ts:213` via `injectStyleManager()` follows the pattern AGENTS.md documents,
   costs nothing when unused, and makes the class the directive already writes actually work.
2. **`scrollable.component.css` is the largest sheet in the batch (472 lines) and roughly half of it
   serves opt-in features.** The button positioning and sticky rules (lines 142-160, 224-242, 301-303,
   317-345 partially, 388-408), the navigation/dots rules (350-359, 275-282), the footer block
   (410-429) and the darken rules (373-386) are all reachable only through
   `SCROLLABLE_NAVIGATION_IMPORTS` / `SCROLLABLE_DARKEN_IMPORTS`. The chrome components already carry
   a small `styles:` block each (`scrollable-buttons.component.ts:45-58`,
   `scrollable-navigation.component.ts:39-108`), so the split direction is established — the
   position-dependent rules just were not moved with them. A track that only scrolls currently pays
   for all of it.
3. **The masks are ~40 lines of the same sheet and are opt-out, not opt-in.** `renderMasks` defaults
   to `true` (`scrollable.component.ts:65`), so `ScrollableMasksComponent` is a static import
   (`scrollable.component.ts:42`) and its rules (lines 125-140, 207-222, 294-308, 431-470) are always
   injected. Moving the mask CSS onto `ScrollableMasksComponent` itself would at least tie it to the
   `@if (renderMasks())` at `scrollable.component.html:24`.
4. **`carousel-autoplay-styles.component.css` and `carousel-transition-styles.component.css` are
   already the right pattern and worth citing as the model** — 188 and 240 lines that a default
   `<et-carousel>` never injects. No change needed; noting it so the scrollable split above is not
   reinvented.

### UI/UX

1. **The play/pause control should follow `pauseReason()`, not `isStopped()`.** See the third High
   finding. Beyond the ARIA contradiction, the button currently offers "pause" for a carousel the
   reader has already paused by hovering it, which reads as broken.
2. **Nothing tells a reader why autoplay stopped.** `pauseReason()` is a rich public signal
   (`carousel-autoplay.directive.ts:157`) that `<et-carousel>` never surfaces — no paused affordance
   on the dots, no `data-pause-reason` on the host. One host attribute would let an app style it
   without reaching into the directive.
3. **The navigation dots' sliding window is silent about what is off-window.**
   `scrollable-navigation.component.ts:168-191` shows five dots and translates the strip; with 40
   children the reader sees five dots and no indication that there are 40. A count, or fading the
   edge dots, is what Material's paginated dots do.
4. **`--et-carousel-dot-target-size` is 24px, below the 44px WCAG 2.5.8 (AAA) / 24px (AA) target.**
   `carousel.component.css:15-19` sits exactly on the AA minimum, and the dots are adjacent with no
   gap (`carousel.component.css:103-107` has no `gap`), so neighbouring targets touch. Bumping the
   default or adding a small gap costs nothing.
5. **`prefers-reduced-motion` is honoured for the carousel's transitions and autoplay but not for its
   programmatic scrolls.** `goToDomIndex` (`carousel.directive.ts:494-521`) and
   `ScrollableSnapDirective.glideToNearestChild` both request `behavior: 'smooth'` unconditionally.
   Chrome and Firefox map `scroll-behavior: smooth` to instant under reduced motion but do *not* do
   the same for a `behavior: 'smooth'` argument, so the one motion a reduced-motion user cannot avoid
   is the slide change itself. `injectPrefersReducedMotion()` is already injected in
   `carousel.directive.ts:103`.
6. **`et-scrollbar` has no minimum thumb hit area.** `--et-scrollbar-thumb-thickness` is 6px
   (`scrollbar.component.css:8-12`) and the thumb is the drag target, inside a 12px track. The track
   press handler softens this (a miss pages instead of doing nothing), but a 6px-wide grab target is
   below every pointer-target guideline; a transparent `::before` inflating the hit box to the track
   width would fix it without changing the look.

### Testing

1. **First pass: the two carousel High findings, as regression tests.** `playOnInit="false"` keeps
   `isStopped()` true; and a looping carousel whose layout appears late still gets positioned onto the
   real run. Both are cheap once the `fakeLayout` helper from the DX section exists — the second one
   is the A/B pair I used above.
2. **Then the RxJS teardown.** A spec that clicks a navigation dot, destroys the fixture and asserts
   no `scroll` listener remains on the container. Generalise it: grep the batch for
   `takeUntilDestroyed()` that is not the last operator — this was the only one here, but the pattern
   is worth a lint rule rather than a test.
3. **`carousel-loop.ts` and `carousel-slide-progress.ts` are the two files where a unit test buys the
   most.** `restingChildIndex` and the progress formula are pure functions over numbers; extracting
   the offset math the way `scrollbar-geometry.ts` already is would let them be tested exactly as
   `scrollbar-geometry.spec.ts` tests its own — which is the model to copy, and the reason the
   scrollbar is the best-covered domain in the batch.
4. **A driver-level test for `suspendSnap` ref counting.** `scrollable.directive.ts:297-308` is the
   invariant the whole loop-seam and drag-settle design rests on ("whichever finishes first must not
   hand snapping back to the other"), and it is asserted nowhere. It is pure signal arithmetic — a
   three-line test.
5. **Replace the local observer mocks in `scrollable.component.spec.ts` with `test-helpers`.** As long
   as they diverge, no scrollable spec can assert anything about intersections, which is what the
   dots, the darkening, the masks' `has-partial-items` class and the carousel's active slide all read.

---

`Clean:` I read every non-spec source file in the three domains plus all five spec files and the three
docs pages, and the following all held up. Carousel: the clone-run arithmetic (`cloneCount` capped at
`count`, lead clones taken from the tail, `slideIndexOf`'s modulo, `nearestDomIndexOf`'s three-candidate
shorter-way-round) is correct and well tested; clones are `aria-hidden` + `inert` + unlabelled and left
out of `count()`; the styles-only-component split for the transition and autoplay CSS is exactly the
AGENTS.md pattern and measurably worth it; `useCarouselScrollSettled`'s pointer deferral, the
`requestedDomIndex` "not this navigation's settle" guard, and `slideProgress.flush()` on a seam crossing
are each solving a real problem correctly; the `pauseControl` dev-mode WCAG 2.2.2 check and the
hover/focus subtraction for the control itself are right; all `takeUntilDestroyed` calls in the carousel
are last in their pipes; `CarouselItemDirective` and `CarouselSlideDirective` both unregister
defensively (identity-checked). Scrollable: the native-CSS-snap design and its `snap-suspended` gate are
sound, `suspendSnap` is correctly ref-counted and idempotent per release, `ScrollableSnapDirective`
releases on destroy, the mutation-observer `attributeFilter` narrowing (and the reasoning for excluding
`style`) is right, `activeChrome`'s filter/sort/resolve is correct, and the two chrome components'
`aria-hidden` + `tabindex="-1"` decision is deliberate and documented. Scrollbar: this is the
best-engineered domain in the batch — the RTL handling (magnitude on read, sign on write, direction read
off the *target*) is correct and tested, `markScrollbarHost` is properly ref-counted with a `WeakMap`,
`preventDefault` on the thumb press to avoid closing a focus-dismissed panel is a real fix with a real
test, the drag's `cancelled` branch restores the original offset, `pageTowardsPointer` relies on the
thumb's `stopPropagation` rather than a fragile hit test, and `measureScrollbar`'s clamps handle both
degenerate cases. All CSS in all three domains is wrapped in `@layer components { … }`, uses `:where()`
for config modifiers while leaving `:hover`/`:focus-visible` bare, contains no Tailwind, and resolves
every colour from `--et-surface-*` / `--et-theme-color-*` tokens (the one exception is noted above);
`prefers-reduced-motion` is handled in the scrollbar CSS and in the carousel's driver resolution; and
the `can-animate` first-render suppression is applied consistently in both the carousel and the
scrollable.

---

## Batch 16 — `calendar` + `time-picker`

Scope reviewed: every non-spec source file under
`libs/components/src/lib/calendar/**` and `libs/components/src/lib/time-picker/**`
(`.ts`/`.html`/`.css`, incl. `headless/` and `headless/internals/`), all 11 spec files in
those trees, the story files, and `apps/docs/components/calendar.md` +
`apps/docs/components/time-picker.md`.

Runtime verification was done with two scratch specs
(`libs/components/src/lib/calendar/__scan-verify.spec.ts`,
`.../time-picker/__scan-verify.spec.ts`, `.../calendar/__scan-verify2.spec.ts`) run as
`cd libs/components && NX_NO_CLOUD=true npx vitest run --config vite.config.mts <spec>`,
plus one node subprocess for the loop-bomb case. **All scratch files were deleted**; the
working tree in both domains is unmodified.

## High

- **Any range strategy whose preview does not require an already-open range paints a
  phantom band on a calendar nobody has touched yet.**
  `CalendarDirective.previewRange` (calendar/headless/calendar.directive.ts:526-541) takes
  its hover point as `this.hoveredDate() ?? this.focusedDate()`. `focusedDate` is a
  `linkedSignal` that is *never* null (calendar.directive.ts:293-310), so the fallback fires
  on first render, before any pointer or keyboard interaction, and before
  `CalendarGridDirective` has ever seen a `focusin`. The built-in strategy hides this
  because its `preview` returns `null` while `current.start === null`
  (calendar-range-strategy.ts:119-128) — but `createFixedLengthRangeStrategy` ships no
  `preview` at all, so line 536 falls through to `strategy.select(at, current)`, which
  always returns a closed range (calendar-range-strategy.ts:93-97); and
  `createWeekRangeStrategy.preview` deliberately bands from "the first hover" without
  checking whether there *is* a hover (calendar-range-strategy.ts:64-75).
  **Runtime-verified** on `<et-calendar mode="range" [activeMonth]="July 2026">` with no
  interaction whatsoever:
  - default strategy → `[]` banded (correct);
  - `createFixedLengthRangeStrategy({ days: 7 })` →
    `["1:start","2:middle","3:middle","4:middle","5:middle","6:middle","7:end"]` plus 7
    cells carrying `data-preview`;
  - `createWeekRangeStrategy({ weekStartsOn: 1 })` →
    `["29:start","30:middle","1:middle","2:middle","3:middle","4:middle","5:end"]`.
  A consumer opening the `FixedLengthRange` / `WeekRange` calendar (both shipped stories,
  both embedded in `calendar.md:148` and `:152`) sees a fully drawn seven-day selection
  they did not make. Same root cause suppresses nothing in a coarse grid either: the
  cell directive refuses to set `hoveredDate` outside the selection view
  (calendar-cell.directive.ts:75-85, and the spec at calendar.directive.spec.ts:462 checks
  exactly that), but `previewRange` reads `focusedDate()` regardless, so the guard only
  covers the pointer path. The fix is a "focus/hover is real" gate — e.g. only fall back to
  `focusedDate()` while `CalendarGridDirective.focusIsInside()`.

- **`minuteStep`/`secondStep` accept values that hang or silently disable a column;
  unlike `monthsShown`, they are not clamped.**
  `TimePickerDirective.minuteStep`/`secondStep`
  (time-picker/headless/time-picker.directive.ts:130-131) are
  `input(5, { transform: numberAttribute })` with no floor, while the calendar's sibling
  input does clamp (`Math.max(1, Math.trunc(numberAttribute(value, 1)))`,
  calendar.directive.ts:161). `generateSteppedValues`
  (time-picker/headless/internals/time-format.ts:42-56) is a bare
  `for (let value = 0; value < options.end; value += options.step)`:
  - `minuteStep="0"` or any negative → the loop never advances toward `end`.
    **Runtime-verified** by running the function body verbatim in a node subprocess:
    `RangeError: Invalid array length at Array.push` after seconds of allocation. In the
    browser this happens inside the `minuteValues()` computed, i.e. during change
    detection, so the picker (and the tab) is gone.
  - a non-numeric value → `numberAttribute` yields `NaN` (its default fallback), the loop
    exits after one iteration (**verified**: `generateSteppedValues({end:60,step:NaN})` →
    `[0]`), so the minute column renders a single `00` option; worse, `anchorTime`'s
    `this.now.getMinutes() - (this.now.getMinutes() % NaN)` is `NaN`
    (time-picker.directive.ts:271), so no option ever gets `focused: true`
    (time-picker.directive.ts:384), every option keeps `tabindex="-1"`, and the column
    becomes unreachable by keyboard.
  Not a hypothetical input: these are plain numeric attributes on a public component and a
  `[minuteStep]="form.step()"` binding can easily be `0` while a form is empty.

- **The calendar's `role="grid"` accessibility tree is not the one the docs promise:
  the row groups are not owned by the grid, and they nest.**
  `calendar.component.html:54-73` puts `role="grid"` on `.et-calendar-grid`, then wraps the
  rows in a role-less `.et-calendar-weeks-viewport` (the CSS crossfade container,
  calendar.component.css:135-148) before reaching `.et-calendar-weeks[role=rowgroup]`
  (line 78-81), which in the day view contains another role-less `.et-calendar-months`
  (line 106) around `.et-calendar-month[role=rowgroup]` (line 108).
  **Runtime-verified** on the default single-month calendar:
  `rowgroup parent role: null (.et-calendar-weeks-viewport)`,
  `rowgroup is direct child of grid: false`, `rowgroup count: 2`, and the only
  `role="row"` that *is* a direct child of the grid is `.et-calendar-weekdays` — the
  header row sits at depth 1 while the data rows sit at depth 3, under two generic
  containers and a nested rowgroup. `calendar.md:250` states "`role="grid"` with
  `row`/`columnheader`/`gridcell` structure", and `:253` repeats the claim for the coarse
  grids. Roles must be owned to compose; a generic element between `grid` and `rowgroup`
  (and a `rowgroup` inside a `rowgroup`) is invalid per the ARIA `grid` required-owned-
  elements rule, and is what makes table-navigation mode in screen readers report the
  wrong row/column counts. Fixable without touching the layout by moving `role="rowgroup"`
  onto the viewport/`.et-calendar-months` wrappers (or `role="presentation"` + a single
  rowgroup), since neither wrapper needs a role of its own.

- **For `precision="year"` the header's zoom button is enabled, named "Choose date", and
  does nothing — `canZoomOut()` exists but the default component never reads it.**
  `CalendarDirective.canZoomOut` (calendar.directive.ts:516) is `view() !== 'multiYear'`,
  and `zoomOut()` from `multiYear` sets `view` to `selectionView()`
  (calendar.directive.ts:652-661) — which for year precision *is* `multiYear`, i.e. a
  no-op. The default header button (calendar.component.html:21-38) has no `[disabled]`
  binding at all, and `resolvedZoomLabel()` returns `labels.switchToMonthView`
  (`'Choose date'`) for the `multiYear` case (calendar.component.ts:113-124).
  `grep canZoomOut` across `libs/` + `apps/` finds it only in its own definition, two
  assertions in `calendar.directive.spec.ts` (:315, :862 — the latter asserts `false` for
  exactly this configuration) and the header docs. **Runtime-verified** on
  `<et-calendar precision="year">`: `view: multiYear`, `aria-label: "Choose date"`,
  `disabled: false`; after `click()` the view is still `multiYear` and the header label is
  unchanged (`2016 – 2039`). A button that announces an action it can never perform is an
  a11y defect, and `calendar.md:62` sells the header as "never a dead end".
  Same run also shows the month-precision variant mislabelled: at `precision="month"`,
  view `multiYear`, the label is `"Choose date"` but clicking returns to the **month**
  grid (`view: year`), which is what `calendar.md:90` documents ("the header zooms back to
  the selecting grid rather than the day grid") — the label set has no string for that.

## Medium

- **In `range` mode an off-step value on the *inactive* end is invisible in its column,
  contradicting the docs' "every column marks both ends".**
  `minuteValues`/`secondValues` splice in an off-step value only from `selectedParts()`,
  i.e. the **active** end (`time-picker.directive.ts:315-321`, `include:
  this.selectedParts()?.minute`). The range markers are then keyed on exact option values
  (`rangeStart: start !== null && start[unit] === optionValue`,
  time-picker.directive.ts:655-659), so a start of `09:07` with `minuteStep=5` has no
  option to attach to. **Runtime-verified** with
  `rangeValue = { start: 09:07, end: 11:00 }`, `activeSide="end"`, `minuteStep=5`:
  minute labels `00,05,…,55`; `minute [data-range-start]: 0`, `minute [data-range-end]: 1`,
  while `hour [data-range-start]: ['09']`. `time-picker.md:165` ("The end that is **not**
  being edited is outlined rather than filled, so both stay readable") and `:159`
  ("Every column marks **both** ends") both promise otherwise. Reachable through the time
  range input, whose typed entry is deliberately ungated (`time-picker.md:79`).

- **12-hour typeahead: typing `1` selects 12.**
  `selectByQuery` (time-picker.directive.ts:563-572) takes the first option whose *label*
  or `String(value)` starts with the buffer, and the 12-hour hour column's first option is
  value `0` labelled `"12"` (`toLabel`, time-picker.directive.ts:372-374).
  **Runtime-verified** on `format="h:mm a"`: `hour labels: 12,1,2,…,11`; after a `1`
  keydown the selected option is `12`. `time-picker.md:89` documents typeahead as
  "Jump to the matching option (`2`,`3` → 23)" — true in 24-hour, wrong in 12-hour, where
  a reader has to type `1` then wait out the 500 ms typeahead reset
  (`internals/typeahead.ts`) to reach hour 1 at all. Preferring an exact `String(value)`
  match over a label prefix would fix it.

- **"Today" and "now" are frozen at construction, so a long-lived picker marks the wrong
  day / anchors the wrong time after midnight.**
  `CalendarDirective.today = startOfDay(new Date())` (calendar.directive.ts:224) feeds
  `cell.today` in all three grids (`:396`, `:468`, `:492`) — which drives
  `aria-current="date"` (calendar-cell.directive.ts:22) and the today ring
  (calendar.component.css:371). `TimePickerDirective.now = new Date()`
  (time-picker.directive.ts:188) feeds `anchorTime`, `periodLabels` and
  `availability.day`. Both are plain fields, not signals, so nothing recomputes. An SPA
  left open across midnight (a dashboard, a booking kiosk) shows `aria-current="date"` on
  yesterday, and a `timeFilter` that switches on weekday
  (`time-picker.md:76`, and the `weekdayHours` story preset) is asked about the wrong day.

- **With `monthsShown > 1` some grid rows carry fewer than seven gridcells.**
  `calendar.component.html:128-131` renders a spill-in day as
  `<span class="et-calendar-cell--empty" aria-hidden="true">` instead of a
  `role="gridcell"`. The reasoning (one date, one cell, one roving target) is right for
  the pointer, but ARIA `grid` expects a rectangular grid: the first and last rows of each
  month column then expose 3-6 cells while the middle rows expose 7, so screen-reader
  column navigation and "column 3 of 7" announcements go wrong across the seam.
  `role="gridcell" aria-hidden="true"` — or `aria-disabled` placeholders — would keep the
  geometry. Code-verified only (needs a real AT to observe the announcement).

- **The range picker's one-time auto-advance can never come back.**
  `autoAdvanceSpent` (time-picker.directive.ts:190) is set by `activateOption` and by
  `setActiveSide` (`:500-515`) and is never reset. A form that clears `rangeValue` back to
  `{start: null, end: null}` — a reset button, a wizard step revisited — keeps the picker
  in "already hopped" mode, so filling the start no longer opens the end and the reader
  has to find the side switch. `time-picker.md:144` describes the hop as belonging to
  "the pick that *completes* the start", which reads as per-range, not per-instance. A
  `linkedSignal` sourced on `rangeValue().start === null` would restore it.

- **`scrollOptionIntoView` reads layout from inside a plain `effect`, and only half of it
  is environment-guarded.**
  `TimePickerOptionDirective` (time-picker-option.directive.ts:64-68) calls
  `this.column.scrollOptionIntoView(...)` from an `effect`, i.e. during change detection,
  and the method's first statements are two `getBoundingClientRect()` calls plus a
  `scrollTop`/`clientHeight` read (time-picker-column.directive.ts:118-127) — a forced
  synchronous reflow per focused option per `columns()` recompute, and a read taken before
  the browser has necessarily laid the new options out. The `columnElement.scrollTo?.()`
  on line 127 is explicitly optional-chained for environments that lack it, which shows
  the author knew this can run outside a real browser — but `getBoundingClientRect` on
  line 120 is not, and this effect *does* fire without any user interaction (the anchor
  option always has `focused: true`). `afterRenderEffect` with a `read`/`write` split is
  the pattern this wants. The sibling calendar focus pull is safe by accident: it is gated
  on `grid.focusIsInside()`, which needs a real `focusin`.

## Low

- **`time-picker-range.directive.spec.ts` names a directive that does not exist.** There is
  no `time-picker-range.directive.ts`; the file tests `TimePickerDirective`'s range mode
  and its own `describe` says so (`'TimePickerDirective - range mode'`). Rename to
  `time-picker.directive.range.spec.ts` or fold into the main spec — the current name
  makes `ls` suggest a missing source file.
- **`CalendarDirective.hoveredDate` is a public writable signal with no JSDoc beyond
  "Range-preview endpoint" (calendar.directive.ts:312-313) and no mention in
  `calendar.md`.** Either document it as the hover-injection hook (useful for a custom
  cell renderer) or mark it `@internal` — as it stands it is public API by accident.
- **`weekNumbers` means two different things one `.` apart.**
  `CalendarComponent.weekNumbers` is a `boolean` input (calendar.component.ts:70) while
  `CalendarDirective.weekNumbers` is `number[]` (calendar.directive.ts:415). Both are
  reachable from a custom header via `calendar.weekNumbers()`. `calendar.md:48` explains
  the split, but `showWeekNumbers` on the component would remove the trap.
- **`precision="year"` has a story (`YearPrecision`) that no docs page embeds**, and
  `calendar.md:81` covers it in one clause with no demo, while month precision gets two
  (`:88`, `:92`). Same for the `German` calendar story and the time picker's `WithSeconds`,
  `Bounded`, `RangeEmpty`, `RangeWithinOneHour`, `RangeCustomLabels`. Every id the docs
  *do* reference resolves to a real export — checked.
- **`time-picker.md:29` types `timeFilter` as `((date: Date) => boolean) | null`**, but the
  real signature is `(date: Date, side: TimeRangeSide) => boolean`
  (`TimePickerTimeFilterFn`, time-picker.directive.ts:40). The range table at `:132` gets
  it right; the first table is what a single-mode reader copies.
- **`CalendarDirective.handleKeydown` claims every arrow/Page/Home/End key inside the
  grid** (calendar.directive.ts:690-705) with no `event.target` check. A consumer who puts
  a text input or a `<select>` inside `[etCalendarGrid]` — a "jump to date" field in a
  custom grid — loses caret movement to `preventDefault()`.
- **The time-picker band's `z-index: -1` (time-picker.component.css:160-168) has no
  stacking context to sit in.** `.et-time-picker-option` is `position: relative` with
  `z-index: auto`, so it does not establish one, and neither `.et-time-picker-column` nor
  `.et-time-picker-column-wrapper` does — the band therefore paints behind the
  backgrounds of every ancestor up to whatever the *host* establishes. It works today
  because nothing between the option and the overlay pane paints an opaque background,
  but a consumer who gives `.et-time-picker-columns` (or any wrapper) a background loses
  the band entirely. `isolation: isolate` on the option, plus `z-index: 0` on its content,
  would pin it. Code-verified only — confirming the failure needs a real browser.
- **`hasSelectableDayIn` is O(days) per coarse cell whenever a `dateFilter` is set**
  (calendar-view.ts:140-156, called from `isYearDisabled`, calendar.directive.ts:566-568).
  The year grid recomputes 24 cells; a filter that rejects a whole year costs 366 calls
  per cell, so ~8.8k `dateFilter` invocations for one `yearCells()` recompute — and that
  recomputes on any input change. The JSDoc at calendar-view.ts:130-139 owns the trade-off
  honestly; a memo keyed on the filter identity would still be worth having.
- **Comment volume sits well outside the AGENTS.md allowlist.** `calendar.directive.ts`,
  `calendar-selection.ts`, `calendar.component.html` and both stylesheets carry a lot of
  narration that is neither an ordering constraint, an unexpressible invariant, a
  workaround, nor public-API JSDoc — e.g. calendar.directive.ts:56-58 (migration/rationale
  narration on an `export`), :399-400, calendar-selection.ts:70, :105-107,
  calendar.component.html:1-2, :56-57, :63-65, calendar.component.css:26-29, :126-127,
  :133-134, :193-195. Some are genuinely load-bearing (the `transitionParity` NG0956 note
  at calendar.directive.ts:277-283, and the "two cells for one date" note at
  calendar.component.html:129-130), but most restate the code below them.

## Spec coverage

**Very well covered** — this is one of the better-tested domains in the lib.

- `calendar/headless/calendar.directive.spec.ts` (1002 lines, ~60 cases) covers single/
  range/multiple selection, hover preview, keyboard roving in all three views, min/max +
  filter, nav guards, `startAt`, view drilling, coarse-cell disabling, range strategies,
  comparison ranges, multi-month spans (seam banding, one roving target, span shifting),
  week numbers, all three precisions and `dateClass`.
- `time-picker/headless/time-picker.directive.spec.ts` (431 lines) covers column derivation
  per format, held picks incl. the AM/PM rule, off-step retention, 12-hour mapping, arrows/
  typeahead/edges, bounds + filter disabling, the "finer parts move" rule and the half-day
  hour walk. `time-picker-range.directive.spec.ts` (255) covers the side switch, the
  one-time hop, the band in all columns and the side-aware filter.
- All four internals modules have focused unit specs
  (`calendar-month`, `calendar-view`, `calendar-keyboard`, `time-availability`,
  `time-format`), and `calendar-range-strategy.spec.ts` covers the three strategies.

**Files with real logic and no tests:**

- `calendar/calendar-header.directive.ts` — the `ngTemplateContextGuard` and template
  plumbing are exercised only indirectly by `calendar.component.spec.ts:48`.
- `calendar/headless/calendar-grid.directive.ts` — `handleFocusOut`'s `queueMicrotask`
  settle (the whole reason `focusIsInside` exists) is never asserted; nor is
  `pointerleave` clearing `hoveredDate`, nor either `RuntimeError` guard
  (`GRID_OUTSIDE_CALENDAR` / `CELL_OUTSIDE_CALENDAR`, or `ET3020`/`ET3021` on the time
  picker side).
- `time-picker/headless/time-picker-column.directive.ts` — `scrollOptionIntoView`'s
  auto-then-smooth behaviour, and the typeahead reset on focus-out, are untested.
- `calendar/calendar-labels.ts` / `time-picker/time-picker-labels.ts` — no test that
  `provideCalendarLabels`/`provideTimePickerLabels` actually reach
  `resolvedPreviousLabel()`/`resolvedHoursLabel()`, or that a partial override keeps the
  rest of the defaults.
- Neither component spec asserts any ARIA structure. `calendar.component.spec.ts` checks
  `role="rowheader"` on one element (line 78) and nothing else — which is why the broken
  `grid` → `rowgroup` ownership (High #3) went unnoticed.

**Specs that encode a wrong behaviour:** none assert something false, but two are one
assertion short of the High findings:

- `calendar.directive.spec.ts:485` ("snaps a pick to its whole week, and previews the week
  under the pointer") dispatches `pointerenter` *before* reading the band, so it cannot
  distinguish "bands on hover" from "bands always". Its own comment — "the whole
  Monday-13th week bands before anything is picked at all" — is accidentally describing
  High #1.
- `calendar.directive.spec.ts:862` asserts `calendar.canZoomOut()` is `false` at year
  precision, which is true of the directive; nothing asserts that the **component** acts
  on it, and it does not (High #4).

**Missing test infrastructure:** there is no calendar or time-picker driver, while
`libs/components/src/lib/forms/testing/` ships drivers for rating, slider, dropzone etc.
Both domains' specs re-implement the same helpers by hand (`cellFor`, `focusedCell`,
`optionButton`, `labelsWith`, a `keydown` dispatcher) in four separate files.

Clean: verified sound — `generateMonthGrid` (six-week spill, week-start handling),
`multiYearPageStart`/`multiYearPageInterval`/`isInMultiYearPage` page tiling and its `min`
anchoring, `clampCalendarView`, `startOfCalendarUnit` + `CALENDAR_UNIT_IS_SAME` precision
normalization, `createCalendarSelectionReader`'s single implementation across all three
grids (incl. the either-way-round comparison interval and the `single`-band rule),
`resolveCalendarKeyboardDate` for all three views against the documented key table
(checked row by row against `calendar.md:193-201` — every cell matches),
`adjacentUnit`/`canGoPrev`/`canGoNext` incl. stepping from the right end of a multi-month
span, `moveFocus`'s minimal span shift, `toggleMultiple`'s immutable ascending updates,
`deriveTimeFormatSpec`'s probe-date approach (correct for localized `p`/`pp`),
`getTimeParts`/`toHour24`/`candidateFor` hour-cycle round-tripping,
`findSelectableTime`/`hasSelectableTime` fixed-vs-open column semantics, `nextEnabledIndex`
wrapping and its fully-disabled-column bail-out, `sides()`'s bare `sideFormat` derivation
(which is what lets the date-time range input pass `Pp`), the held-parts state machine
including the AM/PM exception, and both label systems' `defineLabels` wiring. Both
stylesheets are correctly wrapped in `@layer components`, use `:where()` for config
modifiers while leaving `:hover`/`:focus-visible`/`:active` bare, carry
`prefers-reduced-motion` handling (calendar) and `@media (hover: hover)` guards, and use
no Tailwind and no hardcoded colour as a primary value (the two literals present —
`rgb(255 255 255 / 0.08)` at time-picker.component.css:129 and the `currentColor`
fallbacks — are `var()` fallbacks, which AGENTS.md permits). Tailwind appears only in the
two `stories/` components, as allowed. State is signals throughout with no
subscribe-and-assign anywhere; the only RxJS in either domain is the typeahead's `timer`,
which is torn down via `destroyRef.onDestroy` (time-picker-column.directive.ts:40).

---

## Improvements

### Features (ranked)

- **A `disabled`/`readonly` input on both headless directives.** Today "disabled belongs
  to the hosting control" (`time-picker.md:174`) and there is no way to freeze a bare
  `<et-calendar>` or `<et-time-picker>` — every consumer that wants a read-only summary
  view has to wrap it in a `pointer-events: none` div and lose keyboard blocking. Material,
  PrimeNG and Ark all ship this on the inline component.
- **`min`/`max` awareness for the time picker's initial anchor.** `anchorTime`
  (time-picker.directive.ts:252-277) snaps "now" to the steps but never to the bounds, so
  an opening-hours picker opened at 07:00 lands the roving focus and the initial scroll on
  a disabled `07`. Clamping the anchor into the first selectable time would make the column
  open where the reader can actually pick.
- **A `dateClass`-equivalent for time options.** The calendar has a per-cell class hook
  (`CalendarDateClassFn`) that lets an app mark busy days; the time picker has nothing, so
  "this slot is half-booked" has to be expressed as `timeFilter` (all or nothing). A
  `timeClass: (date, unit) => …` mirroring the calendar's shape would close the gap.
- **`maxSelections` for `mode="multiple"`.** `toggleMultiple`
  (calendar.directive.ts:772-784) has no cap, so "pick up to 3 dates" needs the consumer to
  intercept `multipleValueChange` and roll back — which fights the `model()`. A cap plus a
  `selectionLimitReached` output is what PrimeNG's multiple-date calendar exposes.
- **A comparison-range legend/`aria-describedby` hook.** `calendar.md:181` admits the
  comparison band "is visual: pair it with a legend if the comparison needs naming" —
  which means the SDK ships a presentation-only feature with a known a11y hole. A
  `comparisonLabel` input folded into the affected cells' `aria-label` ("July 3, also in
  the comparison period") would close it inside the component.

### DX (ranked)

- **Ship calendar and time-picker test drivers under a `testing/` entry, like the forms
  domain does.** Four spec files independently re-implement `cellFor`, `focusedCell`,
  `optionButton(unit, value)`, `labelsWith(unit, attr)` and a `keydown` helper. A
  `calendarDriver(fixture)` / `timePickerDriver(fixture)` exposing `cell(day)`,
  `focusedCell()`, `bandedCells()`, `column(unit)`, `option(unit, value)`, `press(key)`
  would delete ~150 lines of duplicated harness and make the missing ARIA assertions cheap
  to add.
- **Clamp the numeric inputs and say so.** `minuteStep`/`secondStep`
  (time-picker.directive.ts:130-131) should use the same
  `Math.max(1, Math.trunc(numberAttribute(value, 1)))` transform `monthsShown` already has
  (calendar.directive.ts:161) — one shared `positiveIntegerAttribute` helper would make the
  three consistent and kill the High finding above. Same for `createFixedLengthRangeStrategy`,
  which already does clamp (`Math.max(1, Math.trunc(options.days))`) — the pattern exists,
  it is just not applied uniformly.
- **`resolveCalendarKeyboardDate`'s `view`/`multiYearPageStart` should not be optional.**
  Their optionality (calendar-keyboard.ts:12-16) exists only for the day-grid default, and
  it silently degrades `Home`/`End` to `null` in the year grid when `multiYearPageStart` is
  forgotten — a case the spec has to test for (`calendar-keyboard.spec.ts:94`, "has nowhere
  to send Home/End without a page"). A discriminated options union per view would make the
  omission a type error.
- **Name the coarse-grid label strings for what they do.** `switchToMonthView`
  (`'Choose date'`) is the string the header shows when returning to *whatever the finest
  grid is*, which at month precision is the month grid — so the label is wrong for two of
  the three precisions. Splitting it into `switchToSelectionView` per precision (or letting
  the component pass `precision` into the label lookup) fixes both the year-precision
  dead-end name and the month-precision mislabel in one change.
- **The structural `RuntimeError`s fire in `afterNextRender`, one per element.** A grid with
  35 misplaced cells throws 35 times, and the first throw happens after render rather than
  at construction, so the stack points at Angular's render hooks rather than the template.
  Hoisting the check to the constructor (where the optional `inject` result is already
  known) would report once, earlier, with a usable stack.

### Bundle size (ranked)

- **Split the calendar's coarse-grid CSS into a styles-only component.** `calendar.component.css`
  is 508 lines and its `.et-calendar-cell--coarse` / `.et-calendar-coarse-row` /
  `[data-view='year'|'multiYear']` rules (lines 196-212, 419-438) only matter once a reader
  drills out — which for a `precision="day"` picker may be never. Per the "Splitting a large
  stylesheet" section of AGENTS.md, mounting a `CalendarCoarseGridStylesComponent` from an
  `effect` when `view() !== selectionView()` first becomes true is the same on-demand trick
  the table's detail-row animation already uses.
- **The comparison-range and week-number CSS are opt-in features carrying no reference.**
  `[data-comparison-band]` (calendar.component.css:304-337) is dead for every calendar
  without `comparisonStart`, and `--_et-calendar-week-column` / `.et-calendar-week-number*`
  (`:154-173`, `:251-263`) for every calendar without `weekNumbers`. Both are natural
  styles-only components referenced from the feature that needs them, which also removes
  them from the bundle of an app that never imports the feature.
- **`CalendarDirective` imports 22 date-fns functions eagerly** (calendar.directive.ts:2-23)
  and drags four internals modules with it, so the headless tier is not meaningfully lighter
  than the component. `isSameMonth`/`isSameYear`/`isSameDay` are also re-imported by
  `calendar-view.ts` and `calendar-selection.ts`; date-fns is tree-shakeable per function so
  this is mostly fine, but `getWeek` (calendar.directive.ts:9) pulls the locale-aware week
  machinery in for **every** calendar even though only the `weekNumbers` opt-in reads
  `weekNumbers()`/`monthPages()[].weekNumbers` — computing it lazily behind the same feature
  reference would drop it from the default path.
- **`et-time-picker` pulls `ScrollbarComponent` in eagerly** (time-picker.component.ts:10)
  for a decoration on a 240px column. If the scrollbar is heavier than the picker's own
  chrome, an `@defer (on interaction)` or a `showScrollbar` input defaulting to the native
  bar would keep the picker cheap for consumers who never look at it.
- **`nextEnabledIndex` / half-day walking / `findSelectableTime` are three near-identical
  "walk until selectable" loops** across `time-picker.directive.ts:92-102`, `:681-687` and
  `internals/time-availability.ts:63-83`. One `firstWhere(values, predicate)` primitive
  would collapse them and is the kind of duplication the calendar's own
  `hasSelectableDayIn` docs (calendar-view.ts:130-139) already point at as the mirrored
  case.

### UI/UX (ranked)

- **The time picker's columns have no way to reach each other by keyboard.**
  `TimePickerColumnDirective.handleKeydown` (time-picker-column.directive.ts:55-90) handles
  only Up/Down/Home/End and typeahead — Left/Right do nothing, so moving from hours to
  minutes needs Tab, which in an overlay competes with the focus trap's own Tab handling.
  Every multi-listbox time picker (Material's, Ark's) wires Left/Right between columns;
  `time-picker.md:85-89` documents the current table honestly, which makes the gap visible.
- **A range calendar shows no way back to a half-built state.** Once `rangeValue.end` is
  set, the only way to re-open the range is a third pick that restarts it — there is no
  "clear" and no way to nudge just one end. `hoveredDate` is nulled on completion
  (calendar.directive.ts:762-764) but nothing tells the reader the range is closed. An
  `activeRangeEnd` model mirroring the time picker's `activeSide` would make the calendar
  and time picker behave the same way in the date-time range input, where they currently
  do not.
- **The leaving grid stays tab-reachable for 140ms.** `.et-calendar-weeks--leave` gets
  `pointer-events: none` (calendar.component.css:235-238) but its previously-focused cell
  still carries `tabindex="0"`, so a fast Tab during the crossfade can land on a cell of
  the month the reader just left. `inert` on the leaving element (or `tabindex="-1"` in the
  leave class's JS counterpart) would close it.
- **Nothing scrolls the calendar's focused cell into view.** The time picker centres its
  focused option (time-picker-column.directive.ts:118-127); the calendar's cell effect only
  calls `.focus()` (calendar-cell.directive.ts:68-72). In a short bottom sheet where the
  six-week grid overflows, keyboard navigation can move focus off-screen.
- **No empty/loading affordance on either component.** A calendar whose `dateFilter`
  rejects the entire visible month renders 35 struck-through cells with no explanation, and
  a fully-bounded-out time column renders 12 dimmed rows. A `noSelectableDates` slot (the
  `empty-state` domain already exists in this lib) would say why.
- **`user-select: none` on both hosts** (calendar.component.css:18,
  time-picker.component.css:23) also blocks copying the header label or a time — a small
  loss, and `user-select: none` scoped to the cells/options would keep the chrome
  selectable.

### Testing (ranked)

- **Assert the ARIA tree in both component specs, first.** One test per component walking
  `role="grid"` → `rowgroup` → `row` → `gridcell` (and `listbox` → `option`) and asserting
  parent-child ownership plus a uniform cell count per row would have caught High #3 and
  the multi-month uneven-row Medium, and would guard `calendar.md:250`'s promise.
- **Add a "nothing has happened yet" test per range strategy.** Reading `[data-band]` /
  `[data-preview]` immediately after `detectChanges()`, before any pointer or key event, is
  the whole of High #1 and is two lines.
- **Test the numeric input edges.** `minuteStep`/`secondStep` at `0`, `-1`, `''` and `61`,
  and `monthsShown` at `0`/`-1`/`2.7`, are all currently untested; the step cases are a
  crash and a silently keyboard-dead column.
- **Test the label providers.** Neither domain has a spec that
  `provideCalendarLabels({ previousMonth: 'X' })` reaches the rendered `aria-label`, or that
  a partial override keeps the other nine defaults — the documented contract of
  `defineLabels` in `apps/docs/components/localization.md`.
- **Test the focus-out microtask settle.** `CalendarGridDirective.handleFocusOut` and
  `TimePickerColumnDirective.handleFocusOut` both exist purely to survive a cell/option
  being removed mid-interaction; neither path has a test, so the roving-focus pull could
  regress into "steals focus from outside the grid" without a failure.
- **Test the day-boundary behaviour.** Freezing time with `vi.setSystemTime`, constructing a
  calendar, advancing past midnight and asserting `aria-current="date"` would pin the
  stale-`today` Medium — and note the repo's own memory that `vi.useFakeTimers()` never
  fakes `window.setTimeout`, so a rAF/timer-based fix would need the bare global.

---

## form-field / input / textarea / masked-input / form / description

Scope reviewed: every non-spec `.ts` / `.html` / `.css` under
`libs/components/src/lib/forms/{form-field,input,textarea,masked-input,form,description}`, all 18
spec files in those folders, plus `apps/docs/components/{forms.md,text-inputs.md}` and the
`localization.md` / `mixed-state.md` / `description-list.md` rows that touch them.

Runtime verification was done with a scratch spec at
`libs/components/src/lib/forms/form-field/__scan-verify.spec.ts`, run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <path>`
(note: the config path must be **relative** to `--root`, the absolute form fails). The file has
been deleted; no source file was modified.

---

### High

- **`[warnings]` is documented as a general control input, but `et-input` is the only control in the
  whole forms library that exposes it — on every other control the binding is a hard NG0303 error.**
  `apps/docs/components/forms.md:391-400` presents it as the escape hatch for an unbound control
  ("A control that is **not** bound to a signal-forms field ... takes its advisories directly -
  `[warnings]` accepts the same shapes a `warn()` rule may return"), and
  `forms.md:387-389` says the controls with their own support region "show warnings in the same
  place, from the same rule". The input is declared once, on the shared base
  (`form-field/headless/text-field-control.directive.ts:52`), and read by the field at
  `form-field/headless/form-field.directive.ts:87`. But a `hostDirectives` entry only exposes the
  inputs it lists, and `'warnings'` appears in exactly one list — `input/input.component.ts:27`.
  It is absent from `input/number-input.component.ts:43-65`,
  `input/password-input.component.ts:29-48`, `textarea/textarea.component.ts:13-36`,
  and `color-input/color-input.component.ts`; and no other control directive in the lib declares a
  `warnings` member at all (`grep -rn "warnings = input" libs/components/src/lib/forms` returns
  nothing outside `text-field-control.directive.ts`).
  **Verified at runtime.** Four hosts, one per control, each binding `[warnings]="'careful'"`:
  ```
  INPUT warning text: careful
  et-textarea       [warnings] -> THREW / NG0303: Can't bind to 'warnings' since it isn't a known property of 'et-textarea'
  et-number-input   [warnings] -> NG0303: Can't bind to 'warnings' since it isn't a known property of 'et-number-input'
  et-password-input [warnings] -> NG0303: Can't bind to 'warnings' since it isn't a known property of 'et-password-input'
  ```
  Consumer failure: `<et-textarea [(value)]="x" [warnings]="advice()">` — copied from the doc
  example one control over — fails template type-check at build. The headless form
  (`<textarea etTextarea [warnings]="…">`) works, because the directive input is reachable
  directly; only the wrapper components drop it.

### Medium

- **A warning message and the character counter keep the frame's inline padding in an
  `underline` + `transparent` field, while the error and the hint are reset to flush — the support
  row is visibly misaligned depending on which message is showing.**
  `form-field/form-field-text-shell-styles.component.css:315-324` resets
  `padding-inline-start: 0` for `.et-form-field-errors` and `.et-form-field-hint` only.
  `.et-form-field-warnings` sets the same padding at
  `form-field/form-field.component.css:408-410` and is not in that list, and
  `.et-form-field-support-counter` sets `padding-inline-end` at
  `form-field/counter.component.css:5` and is not either. Concrete result on
  `<et-form-field appearance="underline">` at `size="md"`: the frame's `padding-inline` is 0, the
  error text starts at x=0, and a `warn()` message on the same field starts at x=13px — the two
  messages occupy the same slot and jump sideways as they swap. The counter sits 13px in from the
  underline's end for the same reason. **Code-verified only** (needs real CSS cascade + layout;
  jsdom drops these sheets whole — see the `vite.config.mts` `onConsoleLog` note).

- **Two components in this scope put their inline `styles` outside `@layer components`, so a
  consumer's Tailwind utility cannot override them.** `description/description.component.ts:10-16`
  and `form-field/headless/label.directive.ts:23-43` both open with a bare selector. AGENTS.md
  ("Component styling") requires the whole file inside one `@layer components` block precisely
  because unlayered component CSS beats `@layer utilities` regardless of specificity. Every other
  inline-`styles` component in the lib does wrap it — `tabs/tabs/tab-group.component.ts`,
  `scrollable/headless/scrollable-masks.component.ts`,
  `breadcrumb/breadcrumb-outlet.component.ts` all start `styles: \`\n @layer components {`.
  Consumer failure: `<et-description class="text-base">` renders at
  `--et-description-font-size` (12px) and `<et-label class="text-blue-500">` keeps the muted
  label colour, because `et-description { font-size: … }` / `et-label { display: inline }` win the
  layer comparison before specificity is even consulted. **Code-verified only** (layer precedence
  is not observable in jsdom).

- **`createCurrencyMask({ allowNegative: true })` cannot accept a minus typed into an empty field —
  the natural way to enter a negative amount is silently erased.**
  `masked-input/masks/currency-mask.ts:64-68`: with no digits yet, `normalized` is `''` and `toRaw`
  returns `''` *before* the `negative` flag is applied, so the sign is dropped. The mask then
  repaints the element from that empty raw. **Verified at runtime** through the real engine
  (`applyMaskEdit`):
  ```
  typed "-":                 {"raw":"","display":"","caret":0}
  then "5":                  {"raw":"5","display":"5","caret":1}
  "-" before an existing 5:  {"raw":"-5","display":"-5","caret":0}
  ```
  So `allowNegative` only works if the user types the digits first and then goes back to insert the
  sign. `text-inputs.md:324` documents `allowNegative` with no such caveat.

- **The field's `aria-describedby` targets are built verbatim from the consumer-supplied `name`, so
  two unbound controls that share a `name` on one page produce duplicate DOM ids and the second
  control describes the first field's message.** `form-field/headless/form-field.directive.ts:54-73`
  builds `et-form-field-error-${name}` / `-hint-` / `-warning-` and only falls back to the
  unique `FALLBACK_ID` when `name` is empty. Realistic case: the same `<et-input name="search"
  [(value)]="…">` rendered in a toolbar and in a modal — both fields emit
  `id="et-form-field-error-search"`, and `aria-describedby` resolves to the first in document
  order.
  **Verified at runtime that signal-forms-bound controls are safe** — signal forms generates
  globally unique names, so the bound path never collides:
  ```
  control names:      [ 'a.form0.email', 'a.form1.email' ]
  aria-describedby:   [ 'et-form-field-error-a.form0.email', 'et-form-field-error-a.form1.email' ]
  error ids / text:   [ '…form0.email => Create email required', '…form1.email => Edit email required' ]
  ```
  The exposure is limited to hand-set `name`s. Appending the `FALLBACK_ID` unconditionally would
  close it. (Side note from the same output: those generated ids contain `.`, so they are valid
  HTML ids but not usable in an unescaped CSS/`querySelector` id selector.)

- **The counter's screen-reader announcements are hardcoded English, outside the label-token system
  the rest of the library uses.** `form-field/counter.component.ts:106-114` emits
  `` `${current - max} characters over the limit of ${max}` ``,
  `` `Character limit of ${max} reached` `` and `` `${max - current} characters remaining` `` into
  the `aria-live` region. `FORM_FIELD_LABELS` right next door
  (`form-field/form-field-labels.ts:11-25`) exists exactly for "the strings every form control
  shows" and carries `mixed` / `clear` / `selectAll`; `apps/docs/components/localization.md:104-135`
  presents its table as "Every token". A German app localizes every other string the field emits
  and still announces English here. They are also pluralization-naive ("1 characters remaining").

- **A support-state swap that happens while the field is inside a `display: none` container never
  clears `leavingState`, leaving a stale hidden message node in the DOM for the field's lifetime.**
  `form-field/headless/support-presentation.ts:102-128` only drops the leaving state on
  `animatable.animationEnd$`, and `libs/core/src/lib/animations/animatable.directive.ts:93-117`
  only emits that after an `animationstart`/`transitionrun` was actually seen (`didEmitStart`).
  A `display: none` subtree runs no transitions. So a field in a collapsed accordion or an inactive
  tab whose error clears to a hint ends up with `renderedState: 'hint'` **and**
  `leavingState: 'error'` permanently: `shouldRenderError()` and `shouldRenderHint()` are both true
  (`form-field/form-field.component.ts:241-266`), and the error div stays rendered at
  `opacity: 0; position: absolute` (`form-field.component.css:374-388`) holding on to
  `renderedErrors`. Cosmetically invisible, but the node and the errors it pins never go away, and
  the same reducer is shared by `injectFormSupport` (`form-field/headless/form-support.ts:139-145`)
  so every control with its own support region inherits it. The narrower version of the same gap:
  `createCanAnimateSignal()` (`libs/core/src/lib/signals/render-utils.ts`) only flips true on the
  next frame, so a swap in the very first frame after creation also has no transition to end on.
  **Code-verified only** — jsdom runs no CSS transitions at all, so this cannot be distinguished
  from normal test behaviour there.

### Low

- **`FORM_FIELD_CONTROL_TYPES.RADIO` and `.SEGMENTED_BUTTON` are dead entries.**
  `form-field/headless/form-field.tokens.ts:15,17`. No control in the lib ever sets them —
  `grep -rn "controlType = signal"` shows radio groups and segmented button groups both register as
  `SELECTION_LIST` (`selection-list/headless/selection-list.directive.ts:79`). They widen the public
  `FormFieldControlType` union with values a consumer can never observe on `data-control-type`.
  Separately, the `usesTextFieldShell` list itself
  (`form-field/headless/form-field.directive.ts:136-155`) **is consistent** with the shipped
  controls: all 17 shell types are claimed by a real control, and the 10 non-shell types
  (checkbox, switch, selection-list, rating, slider, range-slider, otp-input, dropzone, plus the
  two dead ones) are correctly excluded. Every shell type also reaches
  `mountTextFieldShellStyles()` — via `TextFieldControlDirective` (text/number/password/color/
  textarea), `DatePickerInputDirective` / `DateRangePickerInputDirective` (the seven date/time
  types), or its own constructor (select, cascader, tag, phone, rich-text, duration).

- **`FormFieldControl.effectiveDisabled` is declared and read but never implemented.**
  Declared at `form-field/headless/form-field.tokens.ts:52`, read as the preferred branch at
  `form-field/headless/label.directive.ts:51-56`. No control defines it — the only
  `effectiveDisabled` in the lib is `selection-list/headless/selection-option.directive.ts:57`,
  which is not a registered `FormFieldControl` (it feeds its value in as plain `disabled` at
  line 78). The first `??` branch is unreachable.

- **`control-suffix.directive.spec.ts:26` describes its fixture as "the phone input's shape: the
  control registers outside the barrier, the suffix template inside" — the real phone input does the
  opposite.** `phone-input/phone-input.component.html`: the `etFormFieldBarrier` div opens at line 2
  and closes at line 57; the `ng-template etControlSuffix` is at line 61, outside it — which is what
  `partials/form-field-barrier.directive.ts:9-10` says it must be ("never on the outer control:
  that control's own template still has to reach the field"). The assertion itself is a valid
  negative test of the barrier; only the comment is wrong, and AGENTS.md requires fixing a comment
  a change made wrong rather than leaving it.

- **`.et-input-clear` has no `:focus-visible` treatment while its sibling `.et-input-picker-trigger`
  does.** `form-field/form-field-control-suffix-styles.component.css:2-40` vs `:76-80`. The clear
  button never sets `outline: none`, so it falls back to the UA ring rather than the library's
  `2px solid var(--et-theme-color-primary-solid)` — an inconsistent keyboard indicator on two
  buttons that sit next to each other in the same suffix stack.

- **Three tokens are live in this scope's CSS but absent from the docs' theming tables.**
  `--et-form-field-support-gap` (`form-field/form-field.component.css:353`, no `@property`
  declaration either), `--et-form-field-counter-over-limit-font-weight`
  (`form-field/counter.component.css:25`) and `--et-description-font-size`
  (`description/description.component.ts:13`). `forms.md:661` lists all 17 declared
  `--et-form-field-*` `@property` tokens correctly, so these three are the only gaps.

- **`LabelDirective` is a `@Component` living in `label.directive.ts`, and it is the only registrant
  that writes the parent's signal directly instead of going through a `registerX` method.**
  `form-field/headless/label.directive.ts:59` does `this.formField?.registeredLabel.set(this)`,
  while hint (`hint.component.ts:15`), counter (`counter.component.ts:118`), control
  (`text-field-control.directive.ts:113`) and control-suffix
  (`partials/control-suffix.directive.ts:26`, via `registerSingleton`) all call a method.
  `FormFieldDirectiveBase` correspondingly has `unregisterLabel` but no `registerLabel`
  (`form-field.tokens.ts:129`). It also skips the `registerSingleton` guard that every other
  registrant gets, so a label replaced in place has no protection against the outgoing instance
  nulling the newcomer.

- **Docs: `FORM_FIELD_IMPORTS` is listed without `[etFormField]`.** `forms.md:45` names
  `et-form-field`, `et-label`, `et-hint`, `et-counter`, `etInputPrefix`/`etInputSuffix`; the array
  also exports `FormFieldDirective` (`form-field/form-field.imports.ts:9`), which is what a control
  rendering its own support region needs.

- **Docs: `description-list.md:3` calls `et-description` "a single hint/help line under an input" —
  inside an `et-form-field` it is not.** The field's template has no `select="et-description"` slot,
  so an `<et-description>` falls to the catch-all `<ng-content />`
  (`form-field/form-field.component.html:17`) and renders *inside the control frame*, next to the
  input. `et-hint` is the hint. `choice-inputs.md:100,180` documents the real use (a secondary line
  in a checkbox/radio option) correctly; only that one sentence is misleading.

- **Docs: `forms.md:236` ("others fall back to an explicit `[max]`") implies a counter is usable
  outside `et-form-field`; it is not.** None of the controls with their own support region project
  an `et-counter` slot (`grep -rn "et-counter" choice-field dropzone otp-input rating slider
  selection-list` is empty), and `form-field/headless/form-support.ts:72-77` — unlike the field's
  own `shouldRenderSupport` (`form-field.component.ts:229-239`) — does not consider
  `registeredCounter()`, so the region would not open for a counter even if one were projected.

- **`ControlSuffixDirective` and `FormFieldBarrierDirective` are public exports in no imports array
  and in no doc page.** `form-field/partials/index.ts` re-exports both, `FORM_FIELD_IMPORTS`
  contains neither, and neither appears in `apps/docs`. They are control-authoring API (used by the
  password input, phone input, select, cascader, date pickers), which is a legitimate reason to omit
  them from `FORM_FIELD_IMPORTS` — but `forms.md`'s "One suffix stack" section describes the
  behaviour without ever naming the directive that produces it, so an app writing its own control
  has no documented way in.

- **`counter-storybook.component.ts` binds `bioForm.tagline` to two different controls**
  (lines 31 and 54), so one signal-forms field has two `formFieldBindings()`. Harmless in the story,
  but it is the shape that makes `focusFirstInvalidField`'s DOM-order tie-break
  (`form/focus-first-invalid-field.spec.ts:105`) ambiguous, and it is the kind of thing copied out
  of a story.

- **`[etForm]` swallows nothing but reports nothing either when the submission action rejects.**
  `form/form.directive.ts:52-61`: `from(submit(field))` with a `tap`-only pipe and a bare
  `.subscribe()`. A `submission.action` that throws produces an unhandled RxJS error routed to the
  global `ErrorHandler`, and `focusFirstInvalidField` never runs. `forms.md:555-575` documents the
  happy path and the `mapViolationsToFormErrors` path but not this one.

### Spec coverage

**Well covered.** The headless layer is in good shape:
`form-field/headless/form-field.directive.spec.ts` (registration, `describedBy` precedence,
ET2200/ET2201 dev throws), `label.directive.spec.ts` (id, required marker),
`field-warnings.spec.ts` (`warn()` accumulation, the error taking the slot back),
`partials/control-suffix.directive.spec.ts` (projection into the suffix, ordering before the
consumer suffix, in-place fallback, barrier), `form-error.component.spec.ts` (resolver
precedence + fallback), `input/headless/input.directive.spec.ts` (aria forwarding, mixed commit
semantics, mask interop), `number-input.directive.spec.ts` (448 lines — stepping, multipliers,
clamping, precision), `password-input.directive.spec.ts`, `textarea.directive.spec.ts` (autosize
hooks, both bounds, teardown), `masked-input`'s three engine/pattern/mask specs plus the directive
spec, `form/focus-first-invalid-field.spec.ts` (DOM order, unrendered skip, reaching the native
input inside the wrapper) and `form/form.directive.spec.ts`.

**Files with real logic and zero tests:**

- `form-field/headless/support-presentation.ts` — the severity/direction reducer
  (`reduceSupportPresentation`, `occupyingState`, `SUPPORT_STATE_SEVERITY`) is ~110 lines of pure,
  trivially testable branching shared by the field shell *and* every headless support region, and
  nothing exercises it. `grep -rln reduceSupportPresentation --include='*.spec.ts'` is empty.
  This is the highest-value gap in the batch.
- `form-field/counter.component.ts` — `defaultLengthOf` (string / array / Set / Map / stringify),
  `resolvedMax` precedence, the "explicit max compares, schema max reads the validation error"
  split at lines 81-89, and the three announcement thresholds. No spec references `et-counter` or
  `CounterComponent` anywhere in the lib.
- `form-field/headless/form-support.ts` — the entire `injectFormSupport` provider (the
  non-`et-form-field` support path for slider/rating/otp/dropzone/selection groups). Untested.
- `form-field/form-warning.component.ts` — its sibling `form-error.component.ts` has a 4-test spec
  for exactly the same resolver-vs-message logic; the warning copy has none.
- `form-field/form-field.component.ts` — only two tests
  (`form-field.component.spec.ts`: label projection into the label area, `data-disabled` from the
  registered control). Untested: `effectiveErrors` synthesising the `etParseError` entry (the
  behaviour `forms.md:315-318` promises), `isBusy`/`showBusySpinner`, `prefixOffset`,
  `shouldRenderSupport` for a counter-only field, and the `isHidden` → `display: none` path.
  I did verify the counter-only case at runtime and it works — `counter rendered: true
  hidden: false text: "0 / 5"` — but nothing in the repo guards it, and it depends on the subtle
  fact that content projected into an `@if`-ed `<ng-content>` is still instantiated.
- `form-field/headless/anchored-panel-controller.ts` (253 lines) — no spec in this folder; it may be
  exercised indirectly through the select/cascader/date-picker specs, which is worth confirming.

**No spec asserts a wrong behaviour.** The one thing to fix is the misleading comment at
`control-suffix.directive.spec.ts:26` (see Low). Note also that `lib/forms/testing/` ships drivers
for `textarea`, `number-input` and `password-input` but **not** for plain `et-input`,
`et-form-field` or the mask — the three most-used pieces in this scope have no harness.

**Clean:** the suffix-stack ordering matches `forms.md:106-114` exactly (control affordance →
consumer `[etInputSuffix]` → busy spinner, `form-field.component.html:21-35`); the transient-vs-
persistent split matches `forms.md:119-140` (only `.et-input-clear` and
`.et-form-field-busy-spinner` trigger the overlap/mask rules at
`form-field.component.css:283-346`, so the picker trigger and the reveal toggle correctly keep
their space, and `textAlign="end"`/`"center"` correctly reserve room without focus); the 0.78
dimming correctly targets only projected affixes and the spinner (`form-field.component.css:212`),
not a control's own buttons; `signalDeferredLoading`'s 200ms/300ms defaults
(`libs/core/src/lib/signals/deferred-loading.ts:31-32`) match `forms.md:249`; the
`sm`-underline 27px figure in `forms.md:166` checks out against
`form-field-text-shell-styles.component.css:303-306` (12 × 1.5 + 4 × 2 + 1px border); the
`0`/`9`/`a`/`*`/`\` pattern semantics, the `31.12.2024 → 00-00-0000` paste example and the
`31-1_-____` guide example in `text-inputs.md:316-335` all trace correctly through
`pattern-mask.ts`; the mixed-state contract is implemented identically in all four text controls
(display masked, placeholder swapped, empty edit keeps the raw value, `data-mixed` on the host);
no hardcoded colour is used as a primary value anywhere in scope (the one `black` is a mask alpha
stop, deliberately); every `.css` file in scope is wrapped in `@layer components`; `takeUntilDestroyed`
is last in every pipe (`support-presentation.ts:125`, `number-input.component.ts:145,229`,
`form.directive.ts:59`); no subscribe-and-assign; SSR guards are in place
(`supportsNativeAutosize` checks `typeof CSS`, `NumberInputComponent` injects `DOCUMENT`,
`getComputedStyle` is only reached on the measurement path behind a non-zero width check); the
number input's scrub cleans the document class up in a `finalize` and stops the repeat timer on a
document-level `pointerup` even when `setPointerCapture` throws; and `et-form-field` correctly
gates every shell-only `data-*` host binding on `usesTextFieldShell()`.

---

### Improvements

#### Features (ranked)

1. **Give `et-input` a `clearable` clear button.** Every machinery it needs already exists and is
   already paid for: the `.et-input-clear` styles
   (`form-field/form-field-control-suffix-styles.component.css:2-40`), the enter/leave keyframes,
   the "takes no space" suffix-overlap and mask rules keyed on that exact class
   (`form-field.component.css:283-346`), and `mountControlSuffixStyles()`. The date/time, phone,
   select and cascader controls all have one; the plain text field — the classic home for a clear
   affordance on a search or filter input — does not. It is a `<ng-template etControlSuffix>` and a
   `value.set('')`.
2. **Ship `isComplete` on the three mask factories, and Luhn/mod-97 validators next to them.**
   `text-inputs.md:337-341` tells the reader to "wire `complete()` into schema validation to require
   fully-filled masks", but `createCardMask`/`createIbanMask`/`createCurrencyMask`
   (`masked-input/masks/*.ts`) define no `isComplete`, so `complete()` returns `null` for exactly
   the three masks a consumer is most likely to want it for. A length-based `isComplete` for card
   (13-19) and IBAN (15-34) is two lines each; a `luhn(path)` / `iban(path)` validator alongside
   `hexColor`/`rgbColor` would complete the story the docs already tell.
3. **A password strength meter component.** `PasswordInputDirective.strength`
   (`input/headless/password-input.directive.ts:35`) is a 0-4 score and the docs say "render any
   meter you like" (`text-inputs.md:153-156`). Material, PrimeNG and shadcn all ship the meter.
   A small `et-password-strength` reading the directive through DI would remove the one piece of
   boilerplate every consumer writes.
4. **`et-form-field` `[hint]` / `[error]` string inputs.** Material's `hintLabel` covers the
   overwhelmingly common single-line case without a projected element. Cheap: forward to a
   synthesised `HintComponentBase` registration.
5. **`Intl.PluralRules` in the counter announcement.** Once the strings move into
   `FORM_FIELD_LABELS` (see the Medium finding) they should take the count as a parameter rather
   than being interpolated, so "1 characters remaining" stops happening in every language.

#### DX (ranked)

1. **Stop hand-listing the base control's inputs in every `hostDirectives` entry.** This is the
   direct cause of the High finding: `input.component.ts:13-34`, `number-input.component.ts:43-65`,
   `password-input.component.ts:29-48` and `textarea.component.ts:13-36` each repeat ~20 input names
   from `TextFieldControlDirective`, and one of them dropped `warnings` while the other three
   dropped it *and* nobody noticed because there is no test that a wrapper exposes what its base
   declares. Two fixes worth doing together: export a shared `const TEXT_FIELD_CONTROL_INPUTS = [
   'value', 'mixed', 'touched', 'mixedLabel', 'disabled', 'readonly', 'hidden', 'invalid', 'errors',
   'warnings', 'required', 'name', 'maxLength', 'pending', 'aria-label', 'aria-labelledby' ] as
   const` next to the base directive and spread it (`inputs: [...TEXT_FIELD_CONTROL_INPUTS,
   'placeholder', 'rows', …]`), and add one spec that asserts every wrapper's
   `ɵcmp.inputs` is a superset of the base's declared inputs.
2. **An `et-input` driver and an `et-form-field` driver in `lib/forms/testing/`.** The folder has 17
   drivers including `textarea-driver.ts`, `number-input-driver.ts` and
   `password-input-driver.ts` — but nothing for the plain text field or for the shell itself, so
   every assertion about the support region, the suffix stack ordering or the busy spinner is
   written by hand against raw class selectors (`.et-form-field-warnings`,
   `.et-form-field-support-counter`) in each spec. A `formFieldDriver(fixture)` exposing
   `errorText()`, `warningText()`, `hintText()`, `counterText()`, `suffixOrder()`, `isBusy()` would
   pay for itself immediately given how thin `form-field.component.spec.ts` is.
3. **Dev-mode validation of a `MaskSpec`.** `masked-input/headless/input-mask.types.ts:7-35`
   documents three contracts the engine relies on — `toRaw` idempotent, `toDisplay(raw)` round-trips
   through `toRaw`, `toDisplay('') === ''` — and nothing checks any of them. A custom mask that
   breaks one produces caret jumping and value thrash that is very hard to trace back. A dev-only
   `assertMaskSpec(spec)` in `InputMaskDirective`'s constructor, probing the three properties with a
   couple of sample values, would turn that into an error code in the `ET32xx` range.
4. **`createCurrencyMask` should reject its own documented-illegal options in dev mode.**
   `masked-input/masks/currency-mask.ts:10-11` says `prefix`/`suffix` "must not contain digits or
   the separators", and nothing enforces it; `groupSeparator === decimalSeparator` is likewise
   unguarded and silently produces an unparseable display. Three `ngDevMode` throws.
5. **`et-counter`'s `lengthOf` is `(value: unknown) => number`.** Every consumer override starts by
   casting. Making `CounterComponent` generic over the value type, or at least accepting
   `(value: never) => number` with a typed helper, would remove that.

#### Bundle size (ranked)

1. **Move the suffix-overlap / mask block out of the always-injected base sheet into the existing
   `FormFieldControlSuffixStylesComponent`.** `form-field.component.css:281-346` (~65 lines,
   including three `:has()` selectors and a `linear-gradient` mask) only ever matches when
   `.et-input-clear` or `.et-form-field-busy-spinner` is present in the suffix. The styles-only
   component that owns exactly those affordances already exists
   (`form-field-control-suffix-styles.component.css`) and is mounted by the five controls that
   produce them. An app with only `et-input`/`et-textarea` fields pays for this block today and can
   never match it. Same argument, smaller: the counter's `.et-form-field-support-counter` rules are
   already correctly on `counter.component.css`, which is the pattern to copy.
2. **Split the warning branch of the support region into its own styles-only component.**
   `.et-form-field-warnings` (`form-field.component.css:402-411`) plus the `--et-form-field-
   warning-font-size` `@property` are dead weight for any app that never writes a `warn()` rule —
   and the code already goes out of its way not to resolve the warning *theme* until one renders
   (`form-field.component.ts:271-273`, with a comment saying so). Mount the sheet from the same
   place, for the same reason.
3. **`FormFieldTextShellStylesComponent` is 328 lines mounted by every text control, and roughly a
   third of it serves one `labelMode`.** The `[data-label-mode='inline']` block (lines 72-111) and
   the two `floating-*` blocks (lines 113-185) are mutually exclusive at runtime, and `labelMode` is
   an input on the *field*, so the field could mount a per-mode sheet from an effect the way
   `etTableVirtualScroll` mounts `TableVirtualScrollStylesComponent`. An app that uses only the
   default `static` mode currently ships all four. Caveat worth designing around: the comments at
   lines 46-48 (and in the textarea/rich-text sheets) explain that these use bare attribute
   selectors precisely so injection order cannot lose a source-order tie against the base sheet —
   splitting further multiplies that hazard, so the split should keep each mode's rules at strictly
   higher specificity than the base rather than relying on order.
4. **The four `syncFromNativeInput` implementations are byte-identical modulo the parse step.**
   `input.directive.ts:98-108`, `password-input.directive.ts:73-83`,
   `textarea.directive.ts:158-168` and `number-input.directive.ts:166-178` all run the same
   mixed-commit dance. A `commitFromNative(element, parse)` helper on `TextFieldControlDirective`
   would collapse them (and give the mixed-commit rule one place to be documented, per the
   comment-policy "explain a pattern once" rule — the same 5-line comment is currently repeated
   four times).

#### UI/UX (ranked)

1. **Give `.et-input-clear` the library's focus ring** (see Low). Two buttons side by side in the
   same suffix with two different keyboard indicators is the kind of inconsistency a keyboard user
   notices immediately.
2. **The counter announces on every keystroke past 90% of the limit.** `counter.component.ts:114`
   returns a new "N characters remaining" string for each character, and the live region is
   `polite` — so the last 18 characters of a 180-char bio produce 18 queued announcements while the
   user is still typing. Announcing at a few thresholds (90%, 100%, and then every N over) or
   debouncing the region's text would make it usable; the visible count needs no change (it is
   already `aria-hidden`).
3. **The frame shows an I-beam around a control that cannot be typed into.**
   `.et-form-field-control-frame { cursor: text }` (`form-field.component.css:188`) applies to
   every shell type; `et-select` and `et-cascader` set `cursor: pointer` on their own element
   (`select/select.component.css:25`, `cascader/cascader.component.css:18`), so the frame's padding
   and affix gutters around them still read as a text field. `forms.md:189-193` hedges this as
   "`text` / `pointer`", but a `[data-control-type]`-keyed cursor would match what the docs
   actually promise ("Type here, **or** open this picker").
4. **The textarea gives no signal that it has hit `maxRows`.** Past the bound the content simply
   scrolls (`textarea-autosize-styles.component.css:13`) with no scrollbar affordance in the
   library's own scrollbar treatment and no shadow/fade — the reader cannot tell there is more text
   above. The `et-scrollbar` work already in flight in this repo is the natural fit.
5. **The number input's stepper buttons are unreachable by keyboard** (`tabindex="-1"`,
   `number-input.component.html:36,49`). Defensible — the arrow keys on the input do the same job
   and are documented (`text-inputs.md:86-97`) — but it means the coarse/fine modifier vocabulary is
   the *only* keyboard path, and a touch user who cannot type has no modifier. Worth a deliberate
   decision rather than an omission.

#### Testing (ranked)

1. **`reduceSupportPresentation` first.** It is pure, it is ~110 lines of nested ternaries deciding
   four transition directions from a severity table, it is shared by the field shell and eight other
   controls, and it has zero tests. A table-driven spec over all 12 `from → to` state pairs
   (including `none`) asserting `renderedState`, `leavingState`, the two `directions` entries and
   whether `renderedErrors`/`renderedWarnings` are retained or cleared would be maybe 60 lines and
   would lock down the most-shared logic in the batch.
2. **`counter.component.ts`.** `defaultLengthOf` across string / array / `Set` / `Map` / number /
   `null`; `resolvedMax` preferring `[max]` over the schema limit; the deliberate asymmetry at lines
   81-89 (explicit `max` compares the measured length, schema `maxLength` reads the validation error
   — the property the docs promise at `forms.md:232`, that the count can never turn red while the
   field reports itself valid); and the three announcement thresholds.
3. **A "wrapper exposes its base's inputs" spec.** One loop over
   `[InputComponent, NumberInputComponent, PasswordInputComponent, TextareaComponent,
   ColorInputComponent]` asserting each `ɵcmp.inputs` covers every input declared on
   `TextFieldControlDirective`. This single test catches the High finding and every future
   recurrence of it, and it is the cheapest test in this list.
4. **`form-field.component.ts`'s parse-error synthesis.** `effectiveErrors`
   (`form-field.component.ts:176-186`) turning a bare `parseError` into a rendered
   `etParseError` message is the behaviour `forms.md:315-318` sells as "no more silent invalid
   state", and nothing asserts it. A fake control with `parseError: () => true` and
   `resolvedParseErrorMessage` is enough — no date library needed.
5. **`injectFormSupport`.** A single host component using it (a stub control plus
   `FormFieldDirective`) exercising error → warning → hint → none would cover the second consumer of
   the reducer and the `provideColor.forceColor`/`clearForcedColor` effect at
   `form-support.ts:157-171`.
6. **Test infrastructure**: the `et-input` / `et-form-field` drivers from the DX section — the
   support-region assertions in items 1, 2 and 4 above all want them.

---

## Batch 05 — selection controls

Scope: `libs/components/src/lib/forms/{selection-list,choice-field,checkbox,switch,rating}` plus
`forms/selection-card-{styles.component.ts,styles.component.css,types.ts}` and `forms/selection-card.spec.ts`.
Docs: `apps/docs/components/choice-inputs.md`, `apps/docs/components/mixed-state.md`.

Runtime verification used a scratch spec at
`libs/components/src/lib/forms/selection-list/__scan-verify.spec.ts`, run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`, and deleted
afterwards. Working tree left unmodified.

### High

- **Clicking a selection group's `<et-label>` silently selects (radio/segmented) or toggles (checkbox)
  the group's first option.** `SelectionListDirective.activate()`
  (`libs/components/src/lib/forms/selection-list/headless/selection-list.directive.ts:115-125`) calls
  `this.selection.select(firstItem)` before focusing it. `LabelDirective` fires `activate()` on every
  click on the projected label (`libs/components/src/lib/forms/form-field/headless/label.directive.ts:21`
  → `:63-65` → `form-field.directive.ts:278-279`). Because the group's `et-label` is the caption for the
  *whole* group rather than for one option, a user who clicks the words "Favorite color" mutates the form
  value with no visible relationship to what they clicked — and in a checkbox group a second click on the
  caption toggles option one back off. Every sibling group-shaped control only focuses on activate:
  `slider/headless/slider.directive.ts:146-148`, `rating/headless/rating.directive.ts:119-121`,
  `select/headless/select.directive.ts:768-770`. **Runtime verified**: `et-radio-group` value went
  `null → "red"`, `et-checkbox-group` value went `[] → ["a"]`, `et-segmented-button-group` value went
  `null → "day"`, each from a single `label.click()`.

- **The hint / error / warning under `et-checkbox-group`, `et-radio-group`,
  `et-segmented-button-group` and `et-rating` is never announced — `aria-describedby` points at an id
  that does not exist.** `FormFieldDirective` writes the control's `describedBy` to
  `hintId()`/`errorId()`/`warningId()` (`form-field/headless/form-field.directive.ts:167-192`, ids built
  at `:54-73`), and the group hosts reflect it (`selection-list.directive.ts:19`,
  `rating/headless/rating.directive.ts:38`). But none of those four templates ever puts that id on the
  support block: `selection-list/checkbox-group/checkbox-group.component.html:7-51`,
  `selection-list/radio-group/radio-group.component.html:7-51`,
  `selection-list/segmented-button-group/segmented-button-group.component.html:12-56`,
  `rating/rating.component.html:51-95`. The only two templates that do are
  `choice-field/choice-field.component.html:27,46,65` and `form-field/form-field.component.html:47,68,89`
  — so this is an omission in four of six support regions, not a design choice.
  **Runtime verified**: `et-radio-group` rendered `aria-describedby="et-form-field-hint-ff-3"` while the
  hint div was `<div etanimatable class="… et-radio-group-hint" data-active="true">` with no `id`;
  `document.querySelector('#et-form-field-hint-ff-3')` → `null`. Same for `et-checkbox-group`.
  Consequence: a screen reader announces the radiogroup with no description at all, and an error message
  the group is showing visually is never spoken.

- **`<et-description>` inside an option reaches no assistive tech.**
  `SelectionOptionDirective` deliberately pins `aria-labelledby` to the label span
  (`selection-list/headless/selection-option.directive.ts:29-31`) so the description does not fold into
  the accessible name — but nothing then wires it as a description: the option never sets
  `aria-describedby`, and `forms/description/description.component.ts` emits no `id`. Because
  `aria-labelledby` is present, name-from-contents is off, so the description text is dropped entirely
  rather than merely being in the wrong slot. **Runtime verified** on `<et-radio value="team">Team
  <et-description>Everything in Solo, plus shared workspaces.</et-description></et-radio>`:
  `aria-labelledby="et-selection-option-label-0"`, `aria-describedby` → `null`, `et-description` has no
  `id`. The docs advertise this as the way to give an option secondary text
  (`apps/docs/components/choice-inputs.md:100`, and the card examples at `:180` and `:203`), so a
  consumer following the guide ships options whose explanatory text is invisible to AT.

- **`et-segmented-button` has no accessible name of its own — its `aria-labelledby` is a dangling
  IDREF.** `SelectionOptionDirective` unconditionally binds `[attr.aria-labelledby]="labelId()"`
  (`selection-option.directive.ts:31`), and `radio.component.html:4` /
  `checkbox-option.component.html:14` render a span carrying that id. `SegmentedButtonComponent`'s inline
  template is only `<div #background class="et-segmented-button-bg"></div><ng-content />`
  (`selection-list/segmented-button-group/segmented-button.component.ts:8-11`) — no element ever carries
  `optionDirective.labelId()`. **Runtime verified**: rendered
  `<et-segmented-button … role="radio" aria-checked="false" aria-labelledby="et-selection-option-label-10"
  tabindex="0"><div class="et-segmented-button-bg"></div>Day</et-segmented-button>` with no element
  matching that id. The segment currently gets a name only because browsers fall back to
  name-from-contents when an `aria-labelledby` resolves to nothing — the third `et-description`-folding
  problem the `labelId` mechanism exists to prevent is simultaneously unsolved here, so projecting an
  `et-description` into a segment would silently fold into its name.

### Medium

- **`[checked]` / `(checkedChange)` on an option inside a group is dead config.** All three option
  components forward the directive's `checked` model as a public input
  (`checkbox-group/checkbox-option.component.ts:23`, `radio-group/radio.component.ts:23`,
  `segmented-button-group/segmented-button.component.ts:18`), but the group's value↔items effect
  (`selection-list/headless/internals/selection-state.ts:100-138`) recomputes every item's `checked` from
  the group `value` on registration and on every value change, so a consumer-supplied `[checked]` is
  overwritten before it can take effect and no `valueChange` is emitted either. **Runtime verified**:
  `<et-checkbox-option [checked]="true" value="a">` inside an `et-checkbox-group` bound to `[]` rendered
  `aria-checked` `['false','false']` and left the group value `[]`.

- **`choice-inputs.md` states the opposite of the code about `mixedLabel` on `et-rating`.**
  `apps/docs/components/choice-inputs.md:325-329` says these controls express mixed "through ARIA/visual
  masking only (**no `mixedLabel`**): `et-rating` masks its `aria-valuetext`". `et-rating` does take
  `mixedLabel` (`rating/headless/rating.directive.ts:58`, forwarded at
  `rating/rating.component.ts:47-58`) and uses it as the `aria-valuetext` while mixed
  (`rating.directive.ts:31,104-112`) with a `FORM_FIELD_LABELS.mixed` fallback (`:75`).
  `apps/docs/components/mixed-state.md:41` documents the real behaviour, so the two pages disagree and a
  consumer reading the component's own guide will not know the input exists. It is also missing from the
  rating input table at `choice-inputs.md:300-304`. Code-verified only (doc/text mismatch).

- **The severity-direction half of the support state machine is dead for every group and for the rating,
  and the leaving message has no exit animation.** `reduceSupportPresentation` computes a
  `directions` record on every transition
  (`form-field/headless/support-presentation.ts:170-186`), but `injectFormSupport` never returns it
  (`form-field/headless/form-support.ts:173-196`) — only `form-field.component.ts:281,290,299` exposes
  directions, from its own duplicate copy of the same state signal (`form-field.component.ts:152`). As a
  result the four group/rating templates bind only `data-active` and never `data-state` /
  `data-direction` (contrast `form-field.component.html:53-54,74-75,93-94`), and their stylesheets carry
  no `[data-state='leaving']` rules — so `checkbox-group.component.css:145-155` declares
  `transform: translateY(0)` in both the base rule and the `[data-active]` rule (a no-op pair), and the
  outgoing message cross-fades in place instead of sliding out the way the reducer's severity ordering
  intends. Same shape in `radio-group.component.css:137-147`,
  `segmented-button-group.component.css:169-179`, `rating.component.css:186-196`. Code-verified only
  (needs a real layout to see the missing motion).

- **`checkbox-group` / `radio-group` / `segmented-button-group` never expose the `activate()` /
  focus split that `FormFieldControl` documents.** `form-field/headless/form-field.tokens.ts:96-104`
  states `focus()` "only focuses — it never toggles, opens a panel, or selects", and every group *does*
  implement both `focus()` (`selection-list.directive.ts:102-113`) and `activate()`. Only `activate()` is
  reachable from a label click, so the correct, non-mutating entry point exists but is never used for the
  group case. This is the same defect as the first High finding, recorded here as the API-shape half:
  the group is the one control family where `activate()` cannot be a safe superset of `focus()`.

### Low

- **`et-radio-group` imports the selection engine through a redundant round-trip path.**
  `selection-list/radio-group/radio-group.component.ts:7` uses
  `'../../selection-list/headless'` where the two sibling groups use `'../headless'`
  (`checkbox-group/checkbox-group.component.ts:7`,
  `segmented-button-group/segmented-button-group.component.ts:18`).

- **`rating.directive.ts` imports one symbol through a path that walks out of `forms/` and back in.**
  `rating/headless/rating.directive.ts:15` is
  `'../../../forms/form-field/form-field-labels'`; every other import in the file uses the direct
  `'../../form-field/…'` form (`:13`). It is also the only import placed after the relative sibling
  imports.

- **`SelectionState` is part of a public type but is not exported.**
  `selection-list/headless/selection-list.tokens.ts:22` types
  `SelectionListDirectiveBase.selection` as `SelectionState<…>` imported from
  `./internals/selection-state`, which `selection-list/headless/index.ts` does not re-export — a consumer
  implementing `SELECTION_LIST_TOKEN` cannot name the type of the member it must provide.

- **`SwitchDirective` does not declare the signal-forms interface its sibling does.**
  `checkbox/headless/checkbox.directive.ts:35` is `implements FormCheckboxControl, FormFieldControl`;
  `switch/headless/switch.directive.ts:36` is only `implements FormFieldControl` despite carrying the
  same `checked` model. Binding still works — `@angular/forms/signals` detects a `checked` model at
  runtime (`node_modules/@angular/forms/fesm2022/signals.mjs:1396`) — so this costs type safety, not
  behaviour.

- **`activate()` disagrees between the two boolean controls.**
  `checkbox/headless/checkbox.directive.ts:91` focuses with
  `{ focusVisible: false } as unknown as FocusOptions`; `switch/headless/switch.directive.ts:89` calls
  bare `this.focus()`. Same control family, same label-click path, two behaviours (visible only in
  Firefox, which is the sole implementor of `focusVisible`).

- **`text-sm` / `text-xs` in the story files emit nothing.** Storybook's Tailwind theme resets the
  scale with `--text-*: initial` and re-declares only `h1…h6, huge, extra-large, large, base, medium,
  small, subline` (`apps/storybook/src/styles/storybook.css:32-97`). Dead classes:
  `switch/stories/switch-storybook.component.ts:26,28,62,66`;
  `rating/stories/rating-storybook.component.ts:26,31`;
  `selection-list/radio-group/stories/radio-group-storybook.component.ts:57`;
  `selection-list/checkbox-group/stories/checkbox-group-storybook.component.ts:51`;
  `selection-list/segmented-button-group/stories/segmented-button-group-storybook.component.ts:30`.
  (`text-et-surface-muted` / `bg-et-surface-bg` in the same files *are* valid —
  `apps/storybook/src/styles/surface-themes.css:84-88`.)

- **Comment-policy violations (rationale / migration narration, none of the four allowed cases).**
  Representative, not exhaustive: `selection-list/headless/internals/selection-state.ts:55-58` (why the
  teardown flag was introduced), `:66-70` ("Evaluating `every`/`length` over all items … meant a single
  disabled-and-unchecked item pinned `allSelected` to false forever" — pure history),
  `:152-156`, `:176-178`, `:210-212`; `selection-list/headless/selection-option.directive.ts:59-61`,
  `:65-66`; `selection-list/checkbox-group/checkbox-group-select-all.component.ts:39-40` (an HTML comment
  arguing a glyph choice); `rating/rating.component.ts:88-90`, `:111-113`, `:126-128`, `:198`;
  `rating/rating.component.html:3-4`, `:13-14`, `:36`.

- **Doc gaps.** `apps/docs/components/choice-inputs.md:362` lists 2 of the 8 rating tokens —
  `--et-rating-label-font-size`, `-support-duration`, `-support-offset`, `-error-font-size`,
  `-warning-font-size`, `-hint-font-size` all exist (`rating/rating.component.css:14-49`) and are absent.
  The groups' `disabled` / `invalid` / `errors` / `required` / `name` inputs are never tabulated even
  though all three forward them (`checkbox-group.component.ts:21-33` and siblings).
  `et-choice-field` also takes `color` via `ProvideColorDirective` (`choice-field.component.ts:42`)
  which the guide never mentions.

- **The card variant's error state never reaches the panel border.** `data-error` on the group sets the
  private `--_et-control-border` (`checkbox-group.component.css:124`, `radio-group.component.css:116`),
  which is read only by the small control's border (`radio.component.css:57,88`,
  `checkbox-option.component.css:58,92`). `.et-selection-card`'s own border
  (`selection-card-styles.component.css:52`) resolves from `--et-surface-border-solid`, so a card
  option in a group showing an error keeps a neutral panel edge.

- **`.et-choice-field-control-slot > *::after` stretches the hit area of *every* projected root node,
  not just the control** (`choice-field/choice-field-card-styles.component.css:33-39`). The slot is fed
  by a catch-all `<ng-content />` (`choice-field.component.html:8`), so any stray element a consumer
  drops next to the control gets its own full-panel overlay stacked on top.

- **The choice field animates errors and hints in but not warnings.**
  `choice-field.component.css:218-229` declares `@starting-style` for `.et-choice-field-errors[data-active]`
  and `.et-choice-field-hint[data-active]` only; `.et-choice-field-warnings` (`:186-193`) has a resting
  `translateY(offset)` and no entry keyframe, so a warning pops in.

### Spec coverage

Well covered:

- `selection-list/headless/selection-list.directive.spec.ts` (399 lines) — roles, single/multi select,
  registration, readonly (attribute reflection, blocked selection, arrow-roving without select, lifting
  readonly), the `aria-label`/`aria-labelledby` accessible-name rules, and both mixed contracts
  (single + multiple) through `describeMixedStateContract`, plus mixed-specific tab-stop and
  select-all-resolution cases. This is the strongest spec in the batch.
- `rating/headless/rating.directive.spec.ts` (292 lines) — arrow/Home/End/Backspace keyboard, half steps,
  click-to-clear, hover preview, drag commit, `pointercancel` discard, secondary-button rejection,
  disabled/readonly, and the full mixed block plus the shared contract.
- `checkbox/headless/checkbox.directive.spec.ts` — role, form-field registration, `labelId`, toggle,
  blur→touched, tabindex, and a good readonly block.
- `selection-list/checkbox-group/checkbox-group-select-all.component.spec.ts` — tri-state, Space/Enter,
  group-disabled propagation, shared vs per-instance label, and orientation reflection.
- `selection-card.spec.ts` — slot order, `data-control-position` reflection and its removal in the plain
  variant, across all three card hosts.

Files with real logic and zero tests:

- `selection-list/segmented-button-group/segmented-button.component.ts` — the FLIP animation effect
  (`:34-65`), the `lastActiveBackgroundElement` handoff, the `isConnected`/`canAnimate` guards, and the
  missing label span (High #4) are all untested. `segmented-button-group.component.ts` likewise has no
  spec for the `TabScaleStylesComponent` mount or the `tabs` variant.
- `choice-field/choice-field.component.ts` — no spec of its own at all. The `SelectionCardStylesComponent`
  + `ChoiceFieldCardStylesComponent` mount effect (`:82-87`), the support wiring, and the card hit-area
  behaviour are only touched indirectly by `selection-card.spec.ts`.
- `checkbox/checkbox.component.ts` — the two frozen-colour effects (`:48-73`) that call
  `getComputedStyle` are untested (and untestable in jsdom, which drops the stylesheets).
- `selection-list/checkbox-group/checkbox-option.component.ts`,
  `selection-list/radio-group/radio.component.ts` — the `variant === 'card'` style-manager mount effect
  has no spec.
- `rating/headless/rating-icon.directive.ts` — the register/deregister identity check (`:22-26`) and the
  last-one-wins single slot are untested.
- `rating/rating.component.ts` — `valueFromPosition` (`:199-215`) is exercised only through the directive
  spec's synthetic pointer flows; `handleIconClick`'s `pointerCommitted` latch (`:147-163`) has no direct
  test.
- `switch/headless/switch.directive.spec.ts` exists but is thin (66 lines): role, default
  `aria-checked`, click toggle, and the indeterminate pair. No readonly, no disabled, no `activate()`,
  no form-field registration — all of which the checkbox spec covers for its twin.

No existing spec asserts a wrong behaviour. Two blind spots would each have caught a High finding: no
spec clicks a group's `et-label` (finding 1), and no spec resolves a control's `aria-describedby` back to
a rendered element (finding 2). The three group *components* never run
`describeMixedStateContract` either — only the headless directive does — so their forwarding of
`mixed` / `mixedChange` through `hostDirectives` is unverified.

### Improvements

#### Features (ranked)

- **Add `Home`/`End` to the selection-list keyboard map.** `selection-option.directive.ts:38-45` handles
  only the four arrows plus Space/Enter. The ARIA radiogroup and checkbox-list patterns both specify
  Home/End to jump to the first/last enabled option, and Material, PrimeNG and Ark all ship them. The
  roving helpers at `:127-179` already know how to skip disabled items, so this is a third traversal
  mode over the same loop.
- **Typeahead on the groups.** With a dozen radios the only way to reach the last one is twelve arrow
  presses. The label text is already addressable through `labelId()`, so a first-letter matcher over
  `selection.items()` is cheap and is what a native `<select>` and Material's radio group give users.
- **Shift-click range selection in `et-checkbox-group`.** The multi-select branch of
  `selection-state.ts:190-196` toggles one item at a time; a shift-anchor over the registry order would
  make a 30-topping list usable and is standard in Ark UI and shadcn checkbox lists.
- **`size` on `et-rating`.** `et-rating` is the only control in this batch with no `size` input — a
  consumer scaling review stars has to reach for `--et-rating-icon-size` directly
  (`rating/rating.component.css:2-12`), while every neighbour accepts `FormFieldSize`
  (`checkbox-group.component.ts:50` and siblings). A `size` mapping to the icon-size and gap tokens would
  close the family gap.
- **Track icons / on-off glyphs for `et-switch`.** `switch.component.html` is a bare track + thumb.
  Material 3 and Ark both offer a checked/unchecked glyph inside the thumb, which is the accepted answer
  for the "is this on?" ambiguity at small sizes and for non-colour-perceiving users.
- **Let the standalone `et-checkbox` derive `indeterminate` from a child list.** The tri-state logic
  already exists as `SelectionListControlDirective` (`headless/selection-list-control.directive.ts`) but
  is reachable only through `et-checkbox-group`. A tree of checkboxes (the classic parent/child case)
  currently has to hand-roll it.

#### DX (ranked)

- **Split `activate()` into "activate" and "activate from label".** The single `activate()` hook forces
  one method to serve both "the user clicked me" and "the user clicked my caption", which is exactly what
  produced the first High finding. A second optional member on `FormFieldControl`
  (`form-field/headless/form-field.tokens.ts:95`) — or simply having `LabelDirective` prefer `focus()`
  when the control reports itself as a group — would make the safe behaviour the default for every future
  group-shaped control.
- **Give `injectFormSupport` the support ids and the directions it already computes.**
  `form-support.ts:173-196` returns 22 members but neither `formFieldDir.hintId()`-style ids nor
  `supportPresentation().directions`, which is why four templates forgot the ids (High #2) and why the
  exit animation is missing everywhere but `form-field` (Medium #3). Returning `errorId`/`warningId`/
  `hintId`/`errorDirection`/`errorState`/… and shipping one shared support-region *partial* would make the
  correct markup the only markup — `form-field.component.ts` could then drop its duplicate copy
  (`:152,230-299,337-348`).
- **A `ChoiceFieldDriver` and a `SegmentedButtonGroupDriver`.** `forms/testing/` has 17 drivers but
  neither of these, which is why both components have no spec. `SelectionListDriver` already parameterises
  its selectors (`checkbox-group-select-all.component.spec.ts:31-35`), so a segmented preset is one
  constant.
- **Reject a second `etRatingIcon` in dev mode.** `rating-icon.directive.ts:20` overwrites
  `registeredIconTemplate` with no warning, so two templates in one rating silently pick the last one —
  the repo's `RuntimeError` + error-code convention (`apps/docs/components/error-codes.md`) exists for
  exactly this.
- **Drop or hide `checked` from the option components' public inputs.** Since it is unconditionally
  overwritten inside a group (Medium #1), keeping it as a documented input on `et-radio` /
  `et-checkbox-option` / `et-segmented-button` is a trap; a dev-mode error when it is bound while a
  `SELECTION_LIST_TOKEN` is present would be honest.

#### Bundle size (ranked)

- **Extract the support region into one styles-only component mounted by `injectFormSupport`.** The
  ~90-line block (six `@property` declarations, `-support`, `-support-stack`, `-support-content`,
  `-errors`, `-warnings`, `-hint`, the `[data-can-animate]` transitions and the reduced-motion override)
  is duplicated near-verbatim five times *in this batch alone* —
  `checkbox-group.component.css:2-38,131-207`, `radio-group.component.css:2-38,123-199`,
  `segmented-button-group.component.css:2-38,155-231`, `rating.component.css:14-49,180-252`,
  `choice-field.component.css:8-42,154-231` — plus copies in slider, dropzone and otp. One
  `FormSupportStylesComponent` parameterised by a `--et-support-*` token layer, mounted from
  `formSupportFactory`, collapses all of them and removes the drift that produced the animation
  inconsistency above.
- **Split the horizontal-orientation rules out of the two group stylesheets.**
  `checkbox-group.component.css:210-240` and `radio-group.component.css:202-232` are inert for every
  group left at the default `orientation="vertical"` (`checkbox-group.component.ts:60`). They are a
  textbook opt-in feature slice for the `injectStyleManager().mount(...)`-from-an-effect pattern the repo
  already uses for `TableVirtualScrollStylesComponent` and `TabScaleStylesComponent`
  (`segmented-button-group.component.ts:98-102`).
- **Stop computing `directions` when nobody reads them.** `reduceSupportPresentation`'s direction
  branches (`support-presentation.ts:170-186`) run on every support transition for every
  `injectFormSupport` consumer and are discarded. Either expose them (preferred, see DX) or gate the
  work.
- **The three group components are ~85% identical TypeScript.**
  `checkbox-group.component.ts`, `radio-group.component.ts` and `segmented-button-group.component.ts`
  repeat the same 12-entry `hostDirectives` input list, the same six `viewChild` refs and the same
  `wireFormSupport` call. A shared base or a `provideSelectionGroup()` helper would cut three copies of
  the boilerplate and, more importantly, stop the input lists from drifting apart.

#### UI/UX (ranked)

- **`Home` on `et-rating` cannot reach the value the control advertises as its minimum.** The host
  declares `aria-valuemin="0"` (`rating.directive.ts:26`) but `Home` commits `step`
  (`:205-209`) and `clamp` floors at `step` (`:235-240`), so a screen-reader user told the range starts
  at 0 finds Home landing on 1. Either advertise `aria-valuemin` as `step`, or make Home clear to `null`
  the way `ArrowLeft` from the first step does (`:196-203`).
- **Dragging off the left edge of the stars commits one star instead of clearing.**
  `valueFromPosition` (`rating.component.ts:199-215`) seeds `value = step` and only ever raises it, so
  releasing a drag to the left of the first star commits `1` (`:181`). "Drag back past the start to
  clear" is the intuition a continuous rating sets up, and it is also the only clear affordance a pointer
  user has besides re-clicking the exact current value.
- **The plain-variant focus ring wraps the 20px control, not the option.**
  `radio.component.css:49` sets `outline: none` on the host and `:93-97` rings only `.et-radio-circle`
  (same in `checkbox-option.component.css:97`). With a long label the focused option is easy to lose,
  and the click target (the whole row, via the host `(click)`) and the focus indicator disagree about
  what is focused. The card variant already rings the whole panel
  (`selection-card-styles.component.css:78-82`).
- **A disabled option cannot carry a tooltip explaining why.** `pointer-events: none` on
  `[aria-disabled='true']` (`radio.component.css:105`, `checkbox-option.component.css:109` equivalent,
  `segmented-button.component.css:79`) is what makes the host cursor work, but it also means "Upgrade to
  unlock this plan" can never be surfaced on the thing it is about — the usual answer is to keep pointer
  events and block activation in the handler (which `SelectionOptionDirective.select():110` already does).
- **Give the card panel an error border.** See the corresponding Low finding — a required radio group in
  error currently signals it only on the small circle inside each card.

#### Testing (ranked)

- **First: a spec that clicks each group's `<et-label>` and asserts the value did not change.** It is
  one assertion per group and it is the guard the batch's worst finding needs.
- **Second: an `aria-describedby` resolution assertion in the shared form-field test surface.** Something
  like "for every control that registers with a `FormFieldDirective` and renders a hint, the id in
  `aria-describedby` resolves to an element in the fixture" would have caught four components at once and
  will catch the next one.
- **Third: a spec for `SegmentedButtonComponent`.** Its accessible name, the `aria-checked` reflection,
  the `tabs` variant's `TabScaleStylesComponent` mount and the FLIP guard chain
  (`segmented-button.component.ts:47-52`) are entirely untested; the missing label span slipped through
  precisely because nothing looks at this component.
- **Fourth: bring the switch spec up to the checkbox spec's coverage.** Readonly, disabled, tabindex,
  form-field registration and `activate()` are all covered for `et-checkbox`
  (`checkbox/headless/checkbox.directive.spec.ts:101-130`) and absent for `et-switch` — the two are
  intentionally twins, so the specs should mirror.
- **Fifth: run `describeMixedStateContract` against the three group components**, not only the headless
  directive, so the `hostDirectives` input/output forwarding is inside the contract.
- **Infrastructure: a `ChoiceFieldDriver`** — the component has no spec at all, and its card variant's
  hit-area trick (`choice-field-card-styles.component.css:33-39`) plus its `:has()`-based
  disabled/readonly/checked propagation (`choice-field.component.css:59-152`) are the most CSS-dependent
  logic in the batch. jsdom drops the stylesheets, so the driver should assert the DOM/attribute
  contract those selectors key off rather than computed styles.

Clean: read and found sound — `selection-list/headless/selection-list-control.directive.ts` (tri-state
`aria-checked`, disabled/readonly gating, Space+Enter parity); the `mixed` masking, first-commit-replaces
and pruning logic in `selection-list/headless/internals/selection-state.ts` (the teardown flag at
`:55-61` and the microtask prune at `:157-169` correctly distinguish `@for` churn from a full teardown,
and the `togglableItems` fallback at `:71-76` correctly avoids both the stuck-mixed and empty-set traps);
`SelectionOptionDirective`'s roving-tabindex computation and wrap-around traversal with disabled-skipping
and single-item termination; the `UNBOUND_VALUE` guard for late-binding required inputs (`:22,67-73`);
`RatingDirective`'s keyboard map, clamping, hover/commit split and mixed handling;
`rating.component.ts`'s gesture handling (`dragGestureFrom` completes with the gesture —
`libs/core/src/lib/drag-handle/drag-gesture.ts:138-153` — so the per-pointerdown subscriptions do not
accumulate, and the `pointerCommitted` latch is reset on both `pointerdown` and `cancelled`);
`CheckboxDirective`/`SwitchDirective` toggle-and-resolve-indeterminate semantics and the deliberate
`aria-checked="mixed"` vs `data-indeterminate` split (correctly documented in both docs pages);
`SegmentedButtonComponent`'s FLIP guards (`isConnected`, identity, `canAnimate`); the `@layer components`
wrap on all 13 stylesheets in scope; zero Tailwind in component source; no hardcoded colour used as a
primary value (every literal is a `var(--token, fallback)` fallback, which AGENTS.md permits); signals
used for all synchronous state with the one RxJS boundary (`rating.component.ts:129-134`) correctly
terminated by `takeUntilDestroyed` last in the pipe; all controls signal-forms native (`FormValueControl`
/ `FormCheckboxControl` / `checked` models, no `ControlValueAccessor` anywhere); and the documented token
names, `orientation`, `variant="card"`/`controlPosition`, card-slot and `variant="tabs"` behaviour in
`choice-inputs.md` all match the code.

---

## Batch 17 — notification / tabs / accordion / tree

Scope: `libs/components/src/lib/{notification,tabs,accordion,tree}` (all non-spec sources + specs) and
`apps/docs/components/{notification,tabs,accordion,tree}.md`.

Runtime verification was done with two throwaway specs
(`src/lib/__scan-verify-b17.spec.ts`, `src/lib/__scan-verify-b17b.spec.ts`), run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`, and **both
files have been deleted**. No source file was modified.

---

## notification

### High

- **The auto-dismiss timer's pause/resume is not reference-counted, so a toast dismisses itself out
  from under a keyboard user.** `notification.component.ts:61-64` wires four independent host
  listeners to the same pair of methods (`mouseenter`→`pauseTimer`, `mouseleave`→`resumeTimer`,
  `focusin`→`pauseTimer`, `focusout`→`resumeTimer`), and `notification-ref.ts:53-71` keeps no depth
  counter — `resumeTimer()` restarts the timer whenever `remainingDuration > 0`, no matter how many
  other reasons to stay paused are still true. Scenario: the user tabs into a toast (focus inside),
  then moves the mouse off it → `mouseleave` resumes the timer → the toast dismisses while it still
  holds focus, dumping focus on `<body>` mid-interaction.
  **Runtime-verified**: dispatching `mouseenter` → `focusin` → `mouseleave` on `et-notification`
  (default `success` duration 4000) and advancing fake timers 5000ms →
  `after mouseenter+focusin+mouseleave, isDismissing = true`.
- **A plain click on a hovered toast restarts its timer for the same reason.**
  `notification-swipe-to-dismiss.directive.ts:163` pauses the timer on every accepted `pointerdown`,
  and `:218` calls `resumeTimer()` unconditionally on `pointerup` — including the uncommitted case
  (`wasCommitted === false`, i.e. a click rather than a drag), with no regard for the hover that
  paused it first. So clicking anywhere non-interactive inside a toast the pointer is resting on
  re-arms the countdown, and the toast vanishes 4s later while still hovered.
  **Runtime-verified**: `mouseenter` → `pointerdown`(mouse, primary) → `pointerup` on document,
  advance 5000ms → `after hover + click, isDismissing = true`.

### Medium

- **`maxVisible: 0` shows every notification instead of none.** `notification-manager.ts:56` caps
  with `active.slice(-managerConfig.maxVisible)`, and `slice(-0)` is `slice(0)` — the whole array
  (**verified**: `[1,2,3].slice(-0).length === 3`). The same value also makes
  `notification-manager.ts:129` (`currentActive.length >= managerConfig.maxVisible`) true on every
  `open()`, so each new toast dismisses the oldest *and* the cap never applies. The config is typed
  `number` with no clamping, so `0` is a legal value that does the opposite of what it reads as.
- **The public JSDoc for `duration` contradicts the code and its own next sentence.**
  `notification-config.ts:38-42` opens with "`0` or `undefined` uses the manager's
  `defaultDuration` for the current status", but `notification-ref.ts:33-36` returns `cfg.duration`
  whenever it is `!== undefined`, so `duration: 0` means *never auto-dismiss* — which is what the
  third sentence of the same comment and `apps/docs/components/notification.md:53` both say. A
  consumer reading only the first sentence and writing `duration: 0` to mean "use the default" gets
  a permanently sticky toast.
- **Pending auto-dismiss timers are unmanaged subscriptions that outlive the injector.**
  `notification-ref.ts:48` and `:68` create bare `timer(...)` subscriptions in a plain factory
  (no injection context, no `takeUntilDestroyed`). The manager's teardown
  (`notification-manager.ts:108`) destroys the stack component only, so after the root injector is
  destroyed every toast that was still counting down fires once and calls `dismiss()` →
  `beforeChange()` → a write to a detached signal. The blast radius is bounded (one late tick per
  toast, and `captureBeforeState` is nulled at `notification-stack.directive.ts:56-58`), but it is a
  timer per toast that nothing can cancel — `dismissAll()` is the only way, and it is not called on
  destroy.
- **`registeredActions` / `registeredDismiss` are write-only state that retains destroyed
  directives.** `notification.directive.ts:40-42` declares them, `notification-action.directive.ts:37`
  appends to the array and `notification-dismiss.directive.ts:18` sets the slot — neither ever
  unregisters on destroy, and a repo-wide grep finds no reader outside
  `headless/notification.directive.spec.ts:65-66`. In a custom toast that renders its action
  conditionally (`@if`), the array grows unboundedly across toggles and holds references to
  destroyed directives. Contrast the accordion, which solved exactly this with
  `accordion/headless/internals/register-part.ts`.

### Low

- `notification.directive.ts:60` places `takeUntilDestroyed()` before the `tap()` that calls
  `markDismissed()` — AGENTS.md requires it last in the pipe.
- The swipe directive subscribes to three `document`-level pointer streams per toast
  (`notification-swipe-to-dismiss.directive.ts:122-146`) even when `swipeToDismiss: false`; `isEnabled`
  is only consulted inside `startGesture` (`:150`). With the gesture off, that is three dead document
  listeners per visible toast.
- `--et-notification-shadow`'s `initial-value` hardcodes `rgb(0 0 0 / 10%)` / `rgb(0 0 0 / 5%)`
  (`notification.component.css:29-31`) as the primary value rather than a surface token.
- Nested live regions: the stack is `role="log" aria-live="polite"` (`notification-stack.component.ts:15-17`)
  and every toast inside it is `role="status"` or `role="alert"` (`notification.directive.ts:37`). Two
  nested live regions is a known double-announcement shape; the docs (`notification.md:198`) present
  it as the design, so this is a deliberate choice worth re-testing with a screen reader rather than
  an outright bug.
- `NotificationStackComponent` is not exported from `notification/index.ts`, while
  `NotificationStackDirective`, `NotificationItemDirective` and `NOTIFICATION_STACK_CONTEXT_TOKEN`
  are. A consumer following the "build your own" path has the parts but not the reference
  implementation, and `NOTIFICATION_IMPORTS` omits `NotificationItemDirective` too.

### Spec coverage

Well covered: the manager's id/replace/cap semantics (`notification-manager.spec.ts`), the whole
`promise()` surface including query following, progress and post-dismiss silence
(`notification-promise.spec.ts`, 13 cases — the strongest spec in the batch), the component's
rendering/icon/action matrix (`notification.component.spec.ts`), the stack's ARIA and ordering
(`notification-stack.component.spec.ts`), surface elevation (`notification-surface.spec.ts`).

Zero tests: **`notification-swipe-to-dismiss.directive.ts` (279 lines)** — a grep for
`SwipeToDismiss` across all `*.spec.ts` in the lib returns nothing. Commit threshold, direction
resolution per writing direction, velocity-vs-distance dismissal, `settleBack`, `pointercancel` and
the momentum handoff are all untested. Also untested: the FLIP machinery in
`notification-stack.directive.ts:53-173`, `pauseTimer`/`resumeTimer` on the ref itself
(`notification-ref.spec.ts` covers id/entry/dismiss/afterDismissed only), and `dismissAll`.

Asserts a behavior that is arguably wrong: `notification.component.spec.ts:93-101` ("pauses and
resumes the timer on pointer and focus transitions") dispatches `mouseenter, focusin, mouseleave,
focusout` and asserts `pauseTimerCalls === 2 && resumeTimerCalls === 2` — it locks in the
unbalanced pause/resume that produces the High finding above. A ref-counted fix would have to
change this spec.

### Improvements

**Features**

1. **A `pause` reason set on the ref instead of a boolean latch.** `pauseTimer(reason)` /
   `resumeTimer(reason)` keyed by `'hover' | 'focus' | 'gesture' | consumer string` is the smallest
   fix for both High findings and makes the API honest about several owners.
2. **`updateContent`/`promise` for a toast that reports multi-step progress.** `promise()` settles
   once; a common shape (upload → process → done) needs a `step()` hook or an accepted
   `Observable<NotificationContentInit>` that drives the toast until completion.
3. **Position-per-notification override.** Every peer library (Sonner, PrimeNG, Material) lets one
   toast opt out of the app-wide corner; `NotificationConfig` has no `position`, and the stack is a
   single instance keyed off the static manager config (`notification-manager.ts:65`).

**DX**

1. **`maxVisible` should be clamped and documented at `>= 1`.** Either `Math.max(1, …)` at
   `notification-manager.ts:56` or a dev-mode error; the current `0` behavior is a trap.
2. **A notification test driver.** Every notification spec re-implements the same
   `provideNotificationManagerConfig` + fake-ref boilerplate (compare `notification.component.spec.ts:26`
   and `:44`). A `createNotificationHarness()` returning `{ open, advance, refs, dismiss }` would
   also make the swipe gesture testable.

**Bundle size**

1. **Split the swipe gesture out of `et-notification`.** `NotificationSwipeToDismissDirective` is a
   static `hostDirective` (`notification.component.ts:47`), so its 279 lines plus
   `createSwipeTracker`/`pointer-gesture-target` ship even for apps that set
   `swipeToDismiss: false`. Mounting it from the manager config (the way
   `mountTabScaleStyles`/`injectStyleManager` handles opt-in CSS) would make it droppable.
2. **`notification.component.css` (271 lines) carries the position/RTL/narrow-viewport matrix for
   all six positions.** Only one is ever active per app; a styles-only component per docked edge is
   the AGENTS.md pattern, though the win is smaller than the swipe split.

**UI/UX**

1. **A focused toast should never auto-dismiss at all**, not merely stay paused — once focus is
   inside, the countdown is a trap for keyboard and screen-reader users. WCAG 2.2.1 argues for
   dropping the timer entirely rather than pausing it.
2. **No `Escape` handling at the stack level.** `Escape` only dismisses the toast that has focus
   (`notification.component.ts:60`); there is no way to clear the stack from the keyboard without
   tabbing to each toast.

**Testing**

1. Cover the swipe gesture first — it is the largest untested surface in the batch and the only one
   that touches `setPointerCapture`, momentum and RTL sign resolution.
2. Then the pause/resume matrix (hover+focus, click-while-hovered, gesture-while-hovered) — the two
   High findings are one spec each.

---

## tabs

### High

- **A tab inserted anywhere but at the end desyncs selection, ARIA and the underline from the panel
  that is actually shown.** `tab-bar.directive.ts:82-84` (`registerTrigger`) appends triggers in
  *creation* order, while `tab-group.component.ts` indexes everything by the template's `$index`
  (`:32` active class, `:35` `aria-controls`, `:58-60` panel id + `aria-labelledby`, `:60-61`
  inert/hidden). Inserting a tab before the selected one leaves the two orders permanently out of
  step: `TabBarTriggerDirective.isSelected()` (`tab-bar-trigger.directive.ts:57-65`) and `tabIndex()`
  (`:67-81`) use `triggers().indexOf(this)`, so they name a different tab than the template does.
  **Runtime-verified** — a `@for`-driven `et-tab-group` with `['A','B']`, then `['Z','A','B']`:

  ```
  before: [A: aria-selected=true, active=true, tabindex=0]
  after : [Z: aria-selected=false, active=true,  tabindex=-1]
          [A: aria-selected=true,  active=false, tabindex=0]
  panels: [panel-0 "Z content" hidden=false labelledby=et-tab-trigger-2 (= A's trigger)]
          [panel-1 "A content" hidden=true]
  ```

  So: the visible panel belongs to Z, `aria-selected="true"` sits on A, the roving tab stop sits on
  A, and the visible panel is labelled by A's trigger. A screen-reader user is told the selected tab
  is A while reading Z's content. Nothing in the DOM recovers from this — the mismatch persists for
  the life of the group.

### Medium

- **`role="tab"` elements are not owned by their `role="tablist"` in either flavor.**
  **Runtime-verified** parent chains:
  `button[tab] < div < div < et-scrollable < div[tablist] < et-tab-group[none]` and
  `a[tab] < div < div < et-scrollable < et-nav-tabs[tablist]`. Three generic elements sit between the
  tablist and its tabs, none carrying `role="presentation"`, and there is no `aria-owns`. ARIA
  requires `tab` to be an owned element of `tablist`; assistive tech that walks required-owned
  relationships (rather than just reading roles) loses the set. Fix is `role="presentation"` on the
  scrollable wrappers, which is cheap since they are pure layout.
- **Arrow keys are not writing-direction aware.** `tab-bar.directive.ts:100-107` maps `ArrowRight` to
  `moveFocus(1)` unconditionally, so in an RTL bar the right arrow walks *backwards* through the
  visually ordered tabs. The tree in this same batch does resolve direction
  (`tree/headless/tree.directive.ts:464-466`), and `notification.md:169-175` documents RTL support in
  detail — so this is both an a11y bug and an inconsistency between siblings.
  Code-verified only (jsdom does not resolve `direction` from `dir` reliably enough to assert on).
- **A nav-tabs bar on a route that matches no link reports the first link as selected.**
  `tab-bar.directive.ts:47` seeds `selectedIndex = 0` and nothing ever clears it; because a nav tab
  link sets `deferSelection` (`nav-tabs/headless/nav-tab-link.directive.ts:32`) a click never selects
  either, so on an unmatched route `activeTrigger()` is still `triggers()[0]`.
  **Runtime-verified** — two links (`/one`, `/two`) on route `/other`:
  `[{One: ariaSelected:"true", activeClass:false, underlineActive:true, tabindex:"0"}, {Two: ...false}]`.
  The underline paints on link One and `aria-selected="true"` lands there, while the `--active` class
  (which reads `NavTabLinkDirective.isActive()`) is correctly `false` — i.e. the component contradicts
  itself on screen: an underlined tab whose text is not in the active color.
- **`aria-orientation` is bound on an element that is `role="none"`.** `tab-group.component.ts:104`
  puts `[attr.data-orientation]` and (via `TabBarDirective`'s host, `tab-bar.directive.ts:31`)
  `aria-orientation` on the `et-tab-group` host, but the component's own `host` block declares
  `role: 'none'` (`:103`) which wins (**runtime-verified**: `HOST role = "none"`,
  `HOST aria-orientation = "horizontal"`, `INNER role = "tablist"`, `tablist count = 1`). The host's
  `aria-orientation` is inert; the real tablist gets its own copy from the template (`:19`). Same
  for the `role="tablist"` the host directive tries to set. Dead bindings that read as if they matter.
- **`disabled` on `a[et-nav-tab-link]` is not equivalent to a disabled content tab, contrary to the
  docs.** `tabs.md:53` says nav links support `disabled` "just like content tabs". A content tab
  trigger is a native `<button [disabled]>` (`tab-group.component.ts:34`) and is genuinely inert; a
  nav link gets `[attr.disabled]` on an `<a>` (a no-op — **verified**, the anchor keeps its `href`),
  `aria-disabled`, and `pointer-events: none` from CSS (`nav-tab-link-styles.component.css:70-73`).
  Pointer clicks are blocked, but `NavTabLinkComponent.handleSpace` (`nav-tab-link.component.ts:52-55`)
  calls `.click()` with no disabled guard, and if the *selected* link is the disabled one it keeps
  `tabindex="0"` (`tab-bar-trigger.directive.ts:67-81`) and is therefore keyboard-reachable. Enter
  and Space then navigate.

### Low

- `NavTabsDirective.navigationVersion` (`nav-tabs/headless/nav-tabs.directive.ts:19-27`) is a
  computed that is never read anywhere in the repo — dead `@internal` API.
- `TabTriggerDirective` (`tabs/tabs/headless/tab-trigger.directive.ts`) is exported through
  `tabs/tabs/headless/index.ts` → the lib's public API, but the selector `[etTabTrigger]` appears in
  no template, no imports array and no doc page. Its only behavior is binding `aria-controls` from an
  input the consumer must compute anyway.
- `NavTabLinkStylesComponent` is marked `@internal` yet re-exported from
  `tabs/nav-tabs/index.ts:4`, while the sibling `TabScaleStylesComponent` is deliberately not
  exported. Pick one.
- With `preserveContent="false"`, non-selected panels still render as empty `role="tabpanel"` divs:
  `shouldRenderPanel` (`tab-group.component.ts:376-382`) gates only the content, and `isPanelHidden`
  (`:368-374`) returns `false` for every panel in that mode, so they are `inert` but not `hidden`.
  Empty tabpanels stay in the accessibility tree.
- Docs gaps in `tabs.md`: the auto session-memory key (`tab-group.directive.ts:176-183`,
  `createAutoSessionMemoryKey`) is mentioned only as "persists the selected tab" with no word on how
  the implicit key is derived or when it collides; `resolveSelectedIndex`'s "a disabled target falls
  back to the first enabled tab" behavior (`:145-167`) is compressed to "disabled tabs are skipped";
  and only 2 of the 8 stories are embedded (`Vertical`, `WithDisabledTabs`, `LazyRendering`,
  `SessionMemory`, `WithDisabledLinks` have no `<StoryEmbed>`).

### Spec coverage

Well covered: session memory in every direction (restore, persist, clamp, disabled target, auto key,
unavailable storage, repeated groups — `tabs/tab-group.component.spec.ts:187-283`), the initial
transition suppression (`:285-300`), panel unregistration (`:325-338`), the four structural dev
errors (`tab-errors.spec.ts`), `et-tab` inputs (`tabs/tab.component.spec.ts`), nav-tab routing and
the sibling-outlet labeling (`nav-tabs/nav-tabs.component.spec.ts`), and the overlay nav link's
guard behavior (`nav-tabs/overlay-nav-tab-link.component.spec.ts` — the guard-vetoes case is a nice
catch).

Zero tests: **the entire tab-bar keyboard model.** A grep for `ArrowRight|ArrowDown|'Home'|handleKeydown`
across `tabs/**/*.spec.ts` returns nothing, so `TabBarDirective.handleKeydown`, `moveFocus` (wrapping
and disabled-skipping), `focusFirst`/`focusLast`, `activateFocused` and `handleFocusout`'s roving-index
reset (`tab-bar.directive.ts:100-196`) are all unverified — 96 lines of a11y-critical logic, and
`tabs.md:87` promises all of it. Also zero: `TabBarUnderlineDirective`'s FLIP
(`tab-bar-underline.directive.ts`), trigger registration order under a dynamic `@for` (the High
finding), and `NavTabsRegistry`'s "more than one bar → `single()` is null" branch
(`nav-tabs-registry.ts:22-26`).

### Improvements

**Features**

1. **Key selection off the tab identity, not an index.** `selectedIndex` is the root cause of the
   High finding and of every `triggerElements()[idx]` lookup. A `selectedId` / `value`-based model
   (with `selectedIndex` kept as a derived convenience) makes dynamic tab sets correct by
   construction and matches Material's `<mat-tab-group>` direction of travel.
2. **`activateOnFocus` (automatic vs manual activation).** The ARIA tabs pattern distinguishes the
   two; today arrow keys only move focus and `Enter` activates
   (`tab-bar.directive.ts:117-119, 188-196`), with no way to get the automatic behavior that suits
   short, cheap tab sets.
3. **Closable tabs / an overflow menu.** Both are standard in PrimeNG and Ark UI, and the bar already
   owns a scrollable so the plumbing (`scrollable-buttons`) is half there.

**DX**

1. **`sortByDomOrder` the registered triggers, as masonry and the accordion already do.**
   `masonry/headless/masonry.directive.ts:86` and `accordion/headless/accordion-group.directive.ts:63-69`
   both solve exactly the ordering problem the tab bar has; reusing that helper in
   `tab-bar.directive.ts:82-84` is a small change with a High-severity payoff.
2. **A tab test driver.** Every tab spec re-declares the same `ResizeObserverMock` /
   `IntersectionObserverMock` / `HTMLElement.prototype.scroll` triple
   (`tab-group.component.spec.ts:54-84,139-152`, `nav-tabs.component.spec.ts:9-37`,
   `overlay-nav-tab-link.component.spec.ts`). Those shims belong in `src/test-helpers.ts` next to the
   existing ones; the missing keyboard specs are much cheaper to write once they are.
3. **`ET2003`'s message covers two unrelated situations** (`tab-errors.ts:11`, thrown from both
   `nav-tab-link.directive.ts:47` and `nav-tabs-outlet.directive.ts:31`); the outlet case in
   particular says "requires an et-nav-tabs element on the page", which is confusing when one exists
   but two bars do (the registry's `single()` returns null and the outlet silently loses its label).

**Bundle size**

1. **`et-tab-group` and `et-nav-tabs` duplicate ~120 lines of near-identical CSS**
   (`tab-group.component.ts:110-348` vs `nav-tabs.component.ts:53-135` plus
   `nav-tab-link-styles.component.css`) — the underline geometry, the `[data-variant='primary']`
   offsets, the divider `::after` and the three hover/focus/active tints are the same rules with a
   different class prefix. A shared styles-only component (the `TabScaleStylesComponent` pattern
   already established at `tab-scale-styles.component.ts`) would collapse them.
2. **`et-tab-group` pulls in the whole scrollable + scrollable-buttons stack** (`tab-group.component.ts:20-28,79-80`)
   whether or not the bar overflows. A tab set of three fixed tabs pays for `ScrollableDirective`,
   `ScrollableButtonsDirective` and their IntersectionObserver wiring.

**UI/UX**

1. **RTL arrow keys** (see Medium) — and while there, `tabs.md:87` should say what `Space` does on a
   content tab (nothing explicit; it works only because the trigger is a native `<button>`).
2. **A nav-tabs bar should render no selection when no route matches** (see Medium) rather than
   defaulting to tab one; `selectedIndex` wants a `-1` sentinel for the nav flavor.

**Testing**

1. The keyboard model first (arrow wrapping, disabled skipping, Home/End, focusout reset) — it is
   the largest untested block and it is what the docs sell.
2. Then a dynamic-`@for` tab set: insert, remove and reorder, asserting `aria-selected`, `tabindex`
   and the visible panel line up. That spec is the regression guard for the High finding.

---

## accordion

The cleanest domain in the batch — no High findings, and several patterns here are what the other
three domains should copy (`internals/register-part.ts` for symmetric registration,
`accordion-group.directive.ts:63-69` for DOM-order-not-creation-order, the self-destroying seed
effect at `accordion.directive.ts:100-111`).

Two docs claims I specifically tried to break and could not:

- `accordion.md:87` — "grab it with `#group="etAccordionGroup"`" on `<et-accordion-group>`, where
  `AccordionGroupDirective` is a `hostDirective`. **Runtime-verified working**: the template reference
  resolves to the directive instance (`ref ctor = AccordionGroupDirective`,
  `ref is the directive instance = true`) and `group.openAll()` expands both panels
  (`expanded triggers: ["true","true"]`).
- `accordion.md:82-84` — `preventCloseLast` "gates the header's own toggle" while `close()`/`closeAll()`
  still collapse. Matches `accordion.directive.ts:161-172` + `accordion-group.directive.ts:105-111`
  exactly, and `accordion.component.spec.ts:268-281` already asserts it.

### Medium

- Nothing I could substantiate.

### Low

- **`> .et-accordion:last-child` is fragile to any non-accordion trailing child.**
  `accordion-group.component.css:8-10` drops the trailing hairline via `:last-child`; a consumer
  putting anything after the last `<et-accordion>` inside `<et-accordion-group>` (a footer link, a
  "show more" button) leaves a double hairline. `:has(+ …)`-free alternative:
  `> .et-accordion:not(:has(~ .et-accordion))`.
- **An accordion with neither `label` nor `etAccordionLabel` renders an empty heading with no dev
  warning.** `accordion.component.html:1-9` falls back to `{{ label() }}`, whose default is `''`
  (`accordion.component.ts:45`). The domain already has dev-mode structural errors for a missing
  trigger and a missing panel (`accordion.directive.ts:120-141`); an unlabeled header is the same
  class of mistake and produces an unnavigable heading.
- **`AccordionTriggerDirective` sets `type: 'button'` as a static host attribute** regardless of what
  element it is applied to (`accordion-trigger.directive.ts:21`). Harmless on a `<div>`, but the
  directive's own JSDoc says "put it on a native `<button>`" — a dev-mode check would be more useful
  than an attribute that only means something on the element it already assumes.
- Docs gap: the `#accordion="etAccordion"` reference is shown only on a headless `[etAccordion]` div
  (`accordion.md:133`); that it works identically on `<et-accordion>` (giving `open`/`close`/`toggle`/
  `hasBeenOpened`) is never stated, even though it is the more common need.
- `accordion.md` documents `Home`/`End` (line 171) and the code implements them
  (`accordion-group.directive.ts:174-179`), but no spec covers them (see below).

### Spec coverage

Well covered, and unusually thorough on the group: `autoCloseOthers` including the "turned on later"
diff (`accordion.component.spec.ts:145-175`), unregistration of a removed accordion (`:176-186`),
`openAll`/`closeAll` (`:187-205`), the whole `preventCloseLast` matrix in six cases (`:206-293`),
arrow-key wrapping (`:295+`), `hasBeenOpened` surviving a collapse (`:115-132`), `aria-disabled` +
refused toggle (`:88-104`), and the id wiring (`:46-64`).

Gaps: `Home`/`End` navigation and `[arrowKeyNavigation]="false"` are untested
(`accordion-group.directive.ts:129-146, 174-190`); `isOpenByDefault`'s "seed once, never re-open"
contract (`accordion.directive.ts:100-111`) has no spec, and it is exactly the kind of subtlety a
future refactor would silently break; the `etAccordionHint` slot and `headingLevel` beyond the
default are only lightly touched; and `registerPart`'s teardown (a conditionally rendered trigger or
panel coming and going, which is what the trigger's `aria-controls` depends on) is untested.

No spec asserts a wrong behavior.

### Improvements

**Features**

1. **A group-level `value` / `[(openValues)]` model.** The group knows its accordions but exposes
   only imperative `openAll`/`closeAll`; a two-way set of open ids would make a
   persisted/URL-driven FAQ trivial and mirrors what the tree already does with `expandedValues`.
2. **`disabled` on the group.** `AccordionGroupDirective` has no `disabled`, so disabling a whole
   FAQ section means setting it on every child.

**DX**

1. **`isOpenByDefault` vs `[(isOpen)]` is the one confusing interaction here.** The JSDoc explains
   it well (`accordion.directive.ts:57-61`), but a dev-mode warning when both are bound would save
   the debugging session; the seed effect silently wins once and then stops.
2. **Reuse `registerPart` (or `sortByDomOrder`) in the other three domains.** This directory has the
   right abstraction; the notification action registry and the tab-bar trigger list are both bugs
   that this file already prevents.

**Bundle size**

1. `accordion.component.css` is 210 lines and every rule serves the default component — nothing worth
   splitting. The chevron icon is already registered per-component
   (`accordion.component.ts:29`) rather than globally, which is the right call.

**UI/UX**

1. **`grid-template-rows: 0fr → 1fr` has no fallback** (`accordion.component.css:165-180`). It is the
   nicest available technique, but in a browser that does not animate it the panel snaps — worth a
   `@supports` note in the docs rather than code.
2. **Focus is not moved into a newly opened panel, and nothing scrolls the header into view.** With a
   long panel above, expanding one below pushes it off screen; Material's accordion scrolls the
   expanded header into view.

**Testing**

1. `Home`/`End` and `arrowKeyNavigation=false` — two cases, both promised by the docs.
2. `isOpenByDefault` seeding semantics (set it true after first render and assert nothing reopens).

---

## tree

### High

- **Collapsing a branch programmatically while a descendant row holds focus drops focus to
  `<body>`.** `tree.directive.ts:306-312` (`collapse`) and `:340-344` (`collapseAll`) only rewrite
  `expandedValues`; the rows below are destroyed by the template's `@for`
  (`tree.component.html:1-20`) and nothing moves DOM focus to the surviving parent.
  `activeNode()` (`:209-219`) then falls back to `rows[0]`, so even the roving tab stop jumps to the
  *first* row rather than the collapsed parent — which contradicts `tree.md:158` ("the tab stop stays
  on the row the user last focused, so Shift+Tab back into the tree re-enters where they left off").
  **Runtime-verified**: a tree with `expanded = ['a']`, focus on the child row "Alpha one", then
  `expanded.set([])` →

  ```
  rows after collapse = ["Alpha","Bravo"]
  activeElement after collapse = BODY
  tab stops = [{Alpha, tabindex:"0"}, {Bravo, tabindex:"-1"}]
  ```

  The ArrowLeft path is safe (focus is already on the parent, `:499-506`), so this bites two-way
  `[(expandedValues)]` writes, `collapseAll()` from a toolbar button, and a data-source swap
  (`:254-257` clears `focusedNode`) — i.e. exactly the programmatic paths the docs encourage.

### Medium

- **A `loadChildren` observable that completes without emitting leaves the branch spinning
  forever.** `load()` (`tree.directive.ts:592-615`) sets `LOADING`, then leaves that state only in
  `tap`'s `next` (→ `LOADED`) or `error` (→ `ERROR`); `take(1)` plus a completing-empty source hits
  neither. `idleParents` (`:228-244`) only re-queues levels whose status is `IDLE`, so the row keeps
  `aria-busy="true"` and its spinner (`tree-node.directive.ts:30`) with no path to recovery except
  `retry()`. An `http.get` piped through a `filter` or a `takeUntil` that fires first is an ordinary
  way to produce this.
- **`clearSelection()` and `retry()` ignore the tree-wide `disabled`.** Every other mutator guards on
  it — `expand` (`:300`), `collapse` (`:307`), `expandAll` (`:327`), `collapseAll` (`:341`), `select`
  (`:353`), `deselect` (`:367`), `activate` (`:399`) — but `clearSelection` (`:389-391`) and `retry`
  (`:347-349`) do not. `tree.md:63` says a disabled tree does nothing, so a "clear filters" button
  wired to `clearSelection()` still wipes the value of a tree the app has disabled.
- **In `selectionMode="none"`, `Space` scrolls the page.** `handleNodeKeydown`'s `case ' '`
  (`:523-534`) returns *before* `event.preventDefault()` when the mode is `none`, so a focused row
  passes the key through to the document's default scroll. A navigation-only tree
  (`tree.md:87` calls it "a pure navigation tree", and `stories/tree.stories.ts:28` ships a
  `NavigationOnly` story) is precisely the case where a user holds the keyboard and arrow-walks the
  rows, and one stray Space jumps the viewport.

### Low

- `--et-tree-error-color` is consumed in three places (`tree.component.css:111,132,222`) and
  explained in `tree.md:166`, but is missing from the "Public design tokens" list at `tree.md:162` —
  the one place a reader looks for the token names.
- The root status rows (`tree.component.html:22-47`) are `role="treeitem"` with `aria-level="1"` but
  no `aria-posinset`/`aria-setsize`, which the tree's own contract says a flat DOM must state
  (`tree.md:144`, and every real row does — `tree-node.directive.ts:20-22`). While the root is
  loading there is also no tab stop anywhere in the tree.
- `expandAll()` (`:326-338`) expands every *loaded* branch, including ones nested inside collapsed
  parents, so a subsequent expand of an ancestor reveals a fully-open subtree. Documented ("every
  branch loaded so far") but surprising; worth an explicit sentence in `tree.md:79`.
- Docs gap: nothing shows how to reach `expandAll`/`collapseAll`/`focusFirst`/`retry` from the
  default `<et-tree>` (the headless snippet at `tree.md:129` uses `#tree="etTree"` on an `[etTree]`
  div). The same reference does work on `<et-tree>` — that is worth one line.

### Spec coverage

The strongest coverage in the batch: 28 cases in `tree.component.spec.ts` covering the ARIA
projection (`:121-141`), the single tab stop and its migration (`:142-152`), lazy load/collapse/
re-expand without unloading (`:153-191`), all three selection modes (`:192-234`), disabled node and
disabled tree (`:235-260`), the whole keyboard model including ArrowRight-into-branch,
ArrowLeft-to-parent, `*` and type-ahead (`:261-355`), empty/error/root-retry states (`:356-414`),
data-source swap (`:415-428`), promise sources (`:429-437`) and the projected row template's DI
(`:467+`).

Untested public API: `expandAll()`, `collapseAll()`, `clearSelection()`, `deselect()`,
`focusFirst()`, `toggleExpansion()`, and a non-default `compareWith` (object values) — a grep for
those identifiers in `tree.component.spec.ts` finds only `nodeActivate`. Given that `compareWith` is
threaded through fourteen call sites in `tree.directive.ts`, an object-valued tree is the highest-value
missing spec. Also untested: `toErrorMessage` as a custom function, the `seen` recursion guard
(`:176-178`), and the `TreeNodeDefDirective` teardown path (`tree-node-def.directive.ts:33-37`).

No spec asserts a wrong behavior.

### Improvements

**Features**

1. **Checkbox cascade / tri-state selection.** `tree.md:89` explicitly defers this to the cascader,
   but a file/permission tree is the canonical ARIA tree use case and every peer library ships it.
   The row already renders a check box in `multiple` mode (`tree.component.html:6-8`).
2. **Drag-and-drop reordering / re-parenting.** The flat-row design (`tree.md:136`) is unusually well
   suited to it — "re-parenting a node moves a row instead of destroying a subtree" — and
   `@ethlete/core` already ships the drag primitives the overlay and notification gestures use.
3. **Filter / search over the loaded rows.** `visibleRows()` is a single computed
   (`tree.directive.ts:135-185`); a `filterPredicate` that keeps matching rows plus their ancestor
   path is a small addition and is what turns a deep tree into something usable.
4. **Virtual scrolling.** A tree that flattens to rows is the easy case for it, and the table already
   has `etTableVirtualScroll` + a styles-only companion to copy.

**DX**

1. **`value` typed as `T | T[] | null` forces a cast at every call site.** Splitting the API by mode
   (or generic-narrowing on `selectionMode`) would remove the `values()` normalization
   (`:194-202`) from the consumer's mental model.
2. **`retry()` is doing two jobs.** `tree.directive.ts:347-349` resets a level to `IDLE`, which is
   both "retry this failure" and "refresh this branch" (as `tree.md:101` notes). A named
   `refresh(parent)` alias would make the intent readable at the call site.
3. **A `TreeDataSource` test double in the lib's testing surface.** Every tree spec hand-rolls the
   same `loadChildren` record (`tree.component.spec.ts` top, and my scratch spec did the same); a
   `createStaticTreeSource(nodes)` helper would make the missing `compareWith`/`expandAll` specs
   cheap.

**Bundle size**

1. **`tree.component.css` is 240 lines, and the `multiple`-mode check box is ~40 of them**
   (`:180-215`). A `multiple`-only styles-only component mounted from the component when
   `selectionMode() === 'multiple'` is exactly the AGENTS.md pattern, and single-select trees are the
   common case.
2. **`et-tree-marker` already pays its own way** — pulling the icon registration into a child
   component (`tree-marker.component.ts:31-38`, with a good comment explaining the DI reason) means
   the spinner and icons land per-marker rather than on the tree. Nothing to change; worth citing as
   the model for other domains.

**UI/UX**

1. **Move focus to the parent row when a branch collapses** (the High finding). ARIA's treeview
   pattern expects focus to follow the collapse; today only the ArrowLeft path is correct by accident.
2. **No indent guides.** At `--et-tree-indent: 18px` (`tree.component.css:6`) a five-level tree is
   hard to read without vertical rules; a `[data-guides]` opt-in is a few lines of CSS given the
   per-row `--_et-tree-node-depth` already exists.
3. **Type-ahead has no visible feedback and no timeout indication.** `createTypeahead()`
   (`internals/typeahead`) buffers silently, so a mistyped prefix simply stops matching with nothing
   on screen to explain it.

**Testing**

1. `compareWith` with object values, end to end (expand + select + focus + type-ahead) — the whole
   directive is written around it and none of it is exercised.
2. The collapse-focus behavior (the High finding), then `expandAll`/`collapseAll`/`clearSelection`.
3. A branch whose source completes empty (the Medium finding) — one case, and it pins the
   `LOADING` dead end.

---

## Clean

Checked and found sound:

- **Repo conventions.** Every stylesheet in all four domains is wrapped in `@layer components { … }`
  (`notification.component.css`, `notification-stack.component.css`, `accordion.component.css`,
  `accordion-group.component.css`, `tree.component.css`, `nav-tab-link-styles.component.css`,
  `tab-scale-styles.component.css`, and the two inline `styles:` blocks in `tab-group.component.ts`
  and `nav-tabs.component.ts`). No Tailwind outside story files. Colors resolve from
  `--et-surface-*` / `--et-theme-color-*` throughout, with hardcoded values only as `var()`
  fallbacks — the one exception noted above is a shadow's `@property` initial value.
  `:where()` is used for config modifiers and left off interaction states, per the styling notes.
- **Reactive state.** Signals for synchronous state everywhere; RxJS confined to genuinely async
  work (the tree's per-branch loading, the notification timer and swipe streams, the FLIP
  scheduling, `RouterLinkActive.isActiveChange`). No `BehaviorSubject` state, no
  subscribe-and-assign. `takeUntilDestroyed` present on every long-lived subscription
  (`tab-bar.directive.ts:73`, `nav-tab-link.directive.ts:37`, `notification-stack.directive.ts:147,164`,
  `notification-swipe-to-dismiss.directive.ts:117-145`, `tree.directive.ts:264`) — last in the pipe
  in all but `notification.directive.ts:60`.
- **Notification promise API** — the `isQuery` discrimination, the `hasSettled` latch, `stopFollowing`
  on dismissal (`notification-promise.ts:150-190`) and the deliberate "dismissing does not cancel the
  work" contract all match the docs, and the spec covers each branch.
- **Notification FLIP** (`notification-stack.directive.ts:60-172`): rects captured before the mutation,
  read in `earlyRead`, written in `write`, cleanup timers tied to the DestroyRef, and
  `captureBeforeState` nulled on destroy so a late `beforeChange()` from a ref is a no-op.
- **Notification surface/elevation** — pinning toasts to elevation 1 regardless of what is open
  underneath (`notification.component.ts:86-95`) is both explained and spec'd
  (`notification-surface.spec.ts`), and `NOTIFICATION_STACK_OVERLAY_LAYER` is consistent between the
  directive, the CSS and `notification.md:202`.
- **Notification RTL and viewport insets** (`notification-stack.component.css`): logical insets, the
  `center` shift computed from the reserved edges, and the `dir(rtl)` swap all match `notification.md:169-175`.
- **Status icon resolution** — `resolveNotificationStatusIcon` (`notification-config.ts:124-128`)
  correctly distinguishes "not listed" from "listed as `null`", the component layers the
  per-notification override on top (`notification.component.ts:108-114`), and both the docs and the
  spec cover the matrix. Icons are `aria-hidden` (verified in the icon directive's host binding), as
  `notification.md:200` claims.
- **Accordion**: `registerPart` teardown symmetry, the DOM-order sort, `enforceSingleOpen`'s
  previous-state diff, `canCollapse` being asked by the accordion rather than enforced by the group,
  `hasBeenOpened` as a `linkedSignal`, the trigger dropping `aria-controls` while no panel exists, and
  the `visibility` + `inert` pairing for find-in-page. All match the docs claim for claim.
- **Tabs**: session-memory restore/persist logic including the `restoredSessionMemoryKey` guard
  against a write-before-read race, `resolveSelectedIndex`'s clamp-then-skip-disabled, the two
  `selectedIndex` sync effects' equality guards, the underline FLIP cancelling its predecessor
  (`tab-bar-underline.directive.ts:40`), `animationsReady` suppressing the initial transition, and
  `deferSelection` letting the router (or a guard) own nav-tab selection — the overlay guard cases
  are spec'd and correct.
- **Tree**: the `seen` recursion guard against a self-referencing source, `mergeMap` (not `switchMap`)
  for sibling branch loads with `switchMap` on the source swap, `defer` so a throwing `loadChildren`
  fails one branch instead of the pipeline, `isIdle`'s re-check against a collapsed-in-flight branch,
  RTL-aware expand/collapse keys, non-wrapping arrow navigation (as documented), the flat-row
  `aria-level`/`posinset`/`setsize` projection, and `TreeMarkerComponent` existing specifically so
  icon registration does not shadow a consumer's own (a genuinely subtle DI point, correctly handled
  and correctly commented).
- **Error codes**: all four ranges (ET17xx, ET20xx, ET36xx, ET46xx) are declared, non-overlapping,
  thrown only under `ngDevMode`, and documented in `apps/docs/components/error-codes.md` with
  matching text.
- **Story ids**: every `<StoryEmbed id="…">` in the four docs pages resolves to an exported story
  (`components-feedback-notification--bottom-end`/`--promise-api`/`--bottom-end-right-to-left`,
  `components-navigation-tabs-tabs--default`, `components-navigation-tabs-nav-tabs--default`,
  `components-layout-accordion--default`/`--always-one-open`/`--lazy-content`/`--headless`,
  `components-data-display-tree--default`/`--multi-select`/`--lazy-loading`/`--custom-rows`).
- **Comment policy**: comments in these four domains are almost entirely load-bearing — ordering
  constraints (`notification-stack.directive.ts:56`, `accordion-group.directive.ts:157`), invariants
  the types cannot express (`tree.directive.ts:145`, `notification-manager.ts:57`), and workarounds
  with their cause named (`tab-scale-styles`, `tree-marker.component.ts:24-30`, the `!important` in
  `notification.component.css:146-148`). I found nothing that needs deleting.

---

## Batch 06 — slider, dropzone, color-input

Scope: `libs/components/src/lib/forms/{slider,dropzone,color-input}` (all non-spec `.ts`/`.html`/`.css`
plus every spec), and the matching docs: `apps/docs/components/slider.md`,
`apps/docs/components/dropzone.md`, and the `## Color input` section of
`apps/docs/components/text-inputs.md` (color-input has no page of its own).

Runtime verification used the lib's own vitest config:
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`.
Three scratch specs were written, run, and deleted; no source file was modified.

---

## slider

### High

- **A pointer press on a tick does not commit that tick's value unless `snapToMarks` is on — the docs
  say it always does.** `apps/docs/components/slider.md:101` states "A pointer press that starts on a
  tick (or its label) commits **that exact value**, not the value under the pointer." The track does
  read the exact stop (`slider-track.directive.ts:66`, `markValueUnderPointer`), but it then hands it
  to `commitThumbValue`, which unconditionally re-snaps through
  `SliderDirective.snapValue` (`headless/slider.directive.ts:193,218-222`). With `snapToMarks` off,
  `snapMarkValues()` is empty, so the tick value goes through `snapValueToStep` and is pulled onto the
  `step` grid. Any explicit `marks` array whose values are not multiples of `step` is therefore
  unreachable by clicking the tick that advertises it — including the exact case the docs illustrate
  (labelled stops).
  **Verified at runtime.** `et-slider` with `step=10` and `marks=[{value:25,label:'quarter'},{value:50}]`:
  pressing the rendered `data-et-slider-mark-value="25"` tick committed **30**. The same press with
  `snapToMarks` committed **25**. (Rendered tick values were `['25','50']`, so the tick itself is
  positioned at 25 — the visual and the committed value disagree.)

### Medium

- **A vertical slider with labelled ticks reserves no room for the labels, so they overflow the
  component box.** The room for tick labels is reserved by
  `slider.component.css:174-178` / `range-slider.component.css:180-184`
  (`&:where([data-mark-labels]) .et-slider-interaction { margin-block-end: … }`), which is a
  *block*-axis margin. In vertical mode the labels move to the **inline** side
  (`slider.component.css:370-375`: `.et-slider-mark-label { inset-inline-end: calc(100% + …) }`), and
  the vertical block at `slider.component.css:319-328` resets `margin-inline: 0` and overwrites
  `margin-block` wholesale (same specificity, later in source, so it wins). Net effect: nothing is
  reserved on the axis the labels actually occupy, and `et-slider` sets no `overflow`, so the labels
  spill out of the control into whatever sits inline-start of it. Same in both stylesheets.
  Code-verified only (needs real layout; jsdom resolves no logical properties).
- **`et-range-slider`'s pointer target is 28px tall where `et-slider` deliberately reserves 44px.**
  `slider.component.css:93` — `block-size: max(44px, var(--et-slider-thumb-size))`;
  `range-slider.component.css:94` — `block-size: max(28px, …)`, and the vertical counterparts differ
  the same way (`slider.component.css:323` vs `range-slider.component.css:329`). The two stylesheets
  are otherwise byte-identical apart from class names, so this reads as a slip rather than a decision:
  a range slider's thumbs are the harder pointer target of the two (they can sit adjacent), yet its
  track is 16px shorter and below the 44px minimum the sibling reserves. Code-verified only.

### Low

- **The docs say the mixed thumb parks "dimmed"; nothing dims it.**
  `apps/docs/components/slider.md:129` — "the thumb(s) park **dimmed** at the track start". The only
  `[data-mixed]` treatment on the thumb is `box-shadow: none`
  (`slider.component.css:211-213`, `range-slider.component.css:217-219`); there is no opacity or color
  change. Either the docs or the stylesheet is out of date.
- **`--et-slider-warning-font-size` is public (it is an `@property` with an initial value,
  `slider.component.css:62-66`) but absent from the token table** at
  `apps/docs/components/slider.md:187-199`, which lists the error and hint counterparts.
- **Self-referential import paths.** `slider.component.ts` has no issue, but
  `range-slider.component.ts:8` imports from `'../../forms/slider/slider-labels'` and
  `headless/slider.directive.ts:33` / `headless/range-slider.directive.ts:34` from
  `'../../../forms/form-field/form-field-labels'` — both walk out of and back into the same tree, and
  both sit outside the sorted import block above them. `'./slider-labels'` and
  `'../../form-field/form-field-labels'` are the same files.
- **`focus()` silently suppresses scroll-into-view.** `headless/slider-thumb.directive.ts:96` —
  `this.elementRef.nativeElement.focus(options ?? { preventScroll: true })`. A consumer calling
  `sliderComponent.focus()` with no argument (the documented way to focus a control) gets
  `preventScroll: true`, so a slider below the fold is focused invisibly. The `preventScroll` default
  exists for the track's pointer path, which always passes `{ origin: 'pointer' }` and therefore never
  reaches the fallback.

---

## dropzone

### High

- **`DROPZONE_LABELS.uploading` is never read — the live region hardcodes English.**
  `dropzone-labels.ts:24,35` declares `uploading: (count: number) => string` with the JSDoc
  "Announced while uploads are in flight", and `provideDropzoneLabels` is documented as the way to
  localize "every string the dropzone renders or announces itself" (`dropzone-labels.ts:3-9`, and
  `apps/docs/components/dropzone.md:222` describes the live region). But
  `dropzone.component.ts:144-153` builds the message inline:
  `return uploading === 1 ? 'Uploading 1 file' : \`Uploading ${uploading} files\`;` — `dropzoneLabels()`
  is not consulted. A grep for `uploading` across the domain finds no call site for the label. Any
  non-English app announces English to screen-reader users with no way to override it (there is no
  per-instance input for it either).
  **Verified at runtime.** With
  `providers: [provideDropzoneLabels({ uploading: (count) => \`LOCALIZED ${count}\` })]` on the host
  component, picking one file left `.et-dropzone-live-status` reading `"Uploading 1 file"`.

### Medium

- **Replacing the file in single mode never fires the configured `delete`, orphaning the previous
  upload server-side.** `headless/dropzone.directive.ts:240-249`: in single mode `selectFiles` disposes
  the current entry and calls `syncValue()`, but never `executeDelete`. `removeEntry`
  (`:273-281`) does. From the user's side the "Replace file" button
  (`dropzone.component.html:86-98`) and remove-then-pick produce the same outcome, yet only one cleans
  up. `apps/docs/components/dropzone.md:105-142` frames `delete` as "clean up the file server-side when
  a user removes an entry" and enumerates exactly one exemption (a still-uploading entry) plus the
  `includeExisting` rule — a silent replace is neither.
  **Verified at runtime.** Single-mode dropzone with
  `delete: { …, includeExisting: true }`: upload `a.png` → value `uuid-a`; then `selectFiles([b.png])`
  → **0** requests to `/media/uuid-a`. The equivalent `removeEntry` path issues the DELETE (existing
  spec `should fire the delete request when a successfully uploaded entry is removed`).
- **`clear()` ignores `disabled` and `readonly`.** `headless/dropzone.directive.ts:300-312` is the only
  mutator without an `interactive()` guard — `selectFiles` (`:192`), `removeEntry` (`:254`) and
  `retryEntry` (`:286`) all have one. `apps/docs/components/dropzone.md:154-156` states that
  `readonly` and `disabled` "both stop every mutation", and `:216` lists `clear()` as part of the
  headless surface a custom UI drives. A readonly dropzone whose app calls `clear()` (e.g. from a
  "reset form" button that is not itself disabled) wipes the value.
  **Verified at runtime.** With `readonly` set, `clear()` took entries from 1 → 0 and the control value
  to `null`; same with `disabled`. `removeEntry` on the same disabled dropzone correctly left the entry
  in place.
- **The single-file preview band hardcodes its colors instead of resolving tokens.**
  `dropzone.component.css:202-210`: `background-color: rgb(0 0 0 / 0.6)`, `color: white`, and
  `.et-dropzone-entry-size { color: rgb(255 255 255 / 0.7) }`. AGENTS.md ("Component styling") says
  never to use a hardcoded color as the primary value; every other color in this file goes through
  `--et-surface-*` / `--et-theme-color-*`. A black scrim over an arbitrary image is a defensible
  *design*, but it is not expressible or overridable through the theming system, and the file
  documents no reason for the exception (contrast with `color-picker-panel.component.css:140-141`,
  which does explain its `#fff` thumb ring).

### Low

- **A readonly dropzone in multiple mode has no reachable focus target.**
  `dropzone.component.css:503-505` hides the whole `.et-dropzone-area` when a readonly dropzone has a
  list, and the browse button inside it is the element `focusTarget` points at
  (`dropzone.component.ts:180-182`). `focus()` (`headless/dropzone.directive.ts:318-324`) then focuses a
  `display: none` button, i.e. does nothing — so clicking the `et-label` of a readonly multi-file
  dropzone has no effect. Harmless today, but it makes `activate()` a no-op for that shape.
- **`--et-dropzone-warning-font-size` is public** (`dropzone.component.css:74-78`) **and undocumented**
  in the token table at `apps/docs/components/dropzone.md:231-245`, which lists the error and hint
  counterparts.
- **The rejection reasons are not documented.** `DROPZONE_FILE_REJECTION_REASONS`
  (`headless/dropzone-validation.ts:13-18`) exports four reasons, one of which (`maxFiles`) can only
  ever occur in single mode when more than one file arrives at once
  (`headless/dropzone.directive.ts:210-214`). `apps/docs/components/dropzone.md:188` mentions the
  `filesReject` payload shape but never the reason union, so `maxFiles` reads as a general count
  constraint that does not exist.
- **Self-referential import path.** `dropzone.component.ts:37` imports from
  `'../../forms/dropzone/dropzone-labels'`, i.e. out of and back into its own directory, and out of
  the sorted import block. `'./dropzone-labels'` is the same file.
- **`executeDelete`'s promise is unguarded against destroy.**
  `headless/dropzone.directive.ts:420-426` emits `deleteSucceed`/`deleteFail` from a bare `.then()`. If
  the view is torn down while the DELETE is in flight, the emit lands on a destroyed `OutputEmitterRef`
  (Angular warns rather than throws, so this is cosmetic — noted only because every other async path
  in the domain is either signal-derived or `takeUntilDestroyed`-terminated).

---

## color-input

### High

- **The picker is wrong in RTL: the thumbs are positioned with a mirroring property while the pointer
  reading is deliberately not mirrored.** `headless/internals/color-picker-engine.ts:10-15` documents
  the reading as intentionally un-mirrored ("the gradients paint left to right in every direction"), and
  `ColorPickerAreaDirective.commitFromPosition`
  (`headless/color-picker-area.directive.ts:78-84`) measures from `rect.left` / `rect.top`
  unconditionally. But the thumbs are placed with **logical** offsets that *do* flip:
  `color-picker-panel.component.html:4` (`[style.inset-inline-start.%]="area.saturationPercent()"`),
  `:19` (hue thumb) and `:33` (alpha thumb), against gradients that are pinned physical
  (`color-picker-panel.component.css:78-80` `linear-gradient(to right, #fff, …)`, `:101-110` the hue
  ramp, `:117` the alpha ramp). In an RTL container a press at 25% from the left commits saturation
  0.25 and then draws the thumb 25% from the **right** — the thumb lands on a visibly different color
  from the one the click chose, and the hue track's thumb likewise runs opposite to its own gradient.
  Nothing pins the pane to LTR (no `direction`/`dir` handling anywhere in `forms/color-input` or
  `overlay/`). Either the thumbs must use physical `left`, or the whole picker must be pinned LTR.
  Code-verified only (jsdom resolves no logical properties; needs a browser with `dir="rtl"`).

### Medium

- **`ColorInputDirective` never reports `expanded`, so the field drops its open-popup styling while
  the picker is up.** `FormFieldControl.expanded` exists precisely for this
  (`../form-field/headless/form-field.tokens.ts`: "True while the control's own popup … is open. The
  field keeps its focused styling while set — focus itself has moved into the detached overlay, so
  `:focus-visible` no longer matches the field"), and
  `form-field-text-shell-styles.component.css:215-232` builds the accent border and the label/affix
  highlight on `[data-expanded]`. Every sibling picker control defines it —
  `select/headless/select.directive.ts:238`, `cascader/headless/cascader.directive.ts:161`,
  `date-time/internals/date-picker-input.directive.ts:123`,
  `date-time/internals/date-range-picker-input.directive.ts:180` — all as
  `computed(() => this.open())`. `ColorInputDirective` has `pickerOpen` (`headless/color-input.directive.ts:66`)
  and no `expanded`. Consequences: the field loses its focused border/label treatment once the overlay
  takes focus (`autoFocus: 'first-tabbable'`,
  `headless/internals/color-picker-overlay.ts:44`), and `shouldFloatLabel` loses its `expanded()` term
  so a `null`-valued color field's floating label drops back down while the panel is open.
  **Verified at runtime (partially).** `et-color-input` inside `et-form-field`: `control.expanded` is
  `undefined` and the field carries no `data-expanded` with the picker open; an `et-select` in the same
  harness with its panel open reports `data-focused=true data-expanded=true`. The focus-drop half is
  browser-only — jsdom's overlay did not move focus off the trigger, so `data-focused` stayed set there.
- **`hasValue` treats an empty string as a picked color.**
  `headless/color-input.directive.ts:68` — `computed(() => this.mixed() || this.value() !== null)`. An
  API or `patchValue` handing the field `''` (a common "no color" encoding) makes the form field float
  its label over a trigger whose value slot renders nothing
  (`displayValue`, `:83`, resolves `''` to `''`), while the swatch paints `#000000`
  (`resolvedColor`, `:77`). The documented contract is `'#rrggbb' | null`
  (`apps/docs/components/text-inputs.md:190`), so a stricter test — non-null **and** parseable — would
  match it.

### Low

- **Two independent color parsers, and the validators' copy cannot read what the picker accepts.**
  `color-input-validators.ts:54-83` re-declares `RGB_PATTERN`, `HEX_CHANNEL_PATTERN` and its own
  `parseColor`, duplicating `headless/internals/color-convert.ts:27-138`
  (`parseColorToRgb`) almost line for line. The duplicate handles no `hsl()`, so
  `getColorContrastRatio` / `colorContrast` silently *pass* an `hsl()` value the picker itself reads
  and offers as a notation (`color-input.types.ts:14`). `getColorContrastRatio`'s JSDoc
  (`color-input-validators.ts:108-120`) does say "hex … and functional `rgb()`/`rgba()`", so it is
  documented — but the two parsers will drift, and `parseColorToRgb` already does everything the
  validator needs.
- **`resolvedColor` cannot distinguish "nothing picked" from "black picked".**
  `headless/color-input.directive.ts:77` collapses both to `#000000`, and
  `apps/docs/components/text-inputs.md:190` records this ("`null` until something is picked (the swatch
  shows black)"). It is a deliberate carry-over from `<input type="color">`, but with the platform
  picker gone the constraint is gone too, and the field now has no empty state.
- **Undocumented public API.** `COLOR_INPUT_IMPORTS` re-exports `ColorPickerAreaDirective`,
  `ColorPickerChannelDirective`, `ColorPickerSurfaceDirective`, `ColorPickerTriggerDirective` and
  `ColorPickerPanelComponent` (`color-input.imports.ts`), and `index.ts` exports the whole `headless`
  barrel, but `apps/docs/components/text-inputs.md` documents no headless tier for this domain — unlike
  slider (`slider.md:144-163`) and dropzone (`dropzone.md:214-216`), which both have a "Headless usage"
  section. `COLOR_INPUT_ERROR_CODES` documents four "outside" errors for directives a consumer has no
  documented way to compose.
- **The panel's saturation and brightness inputs share one focus indicator.**
  `color-picker-panel.component.css:83-86` outlines the whole area on
  `:has(.et-color-picker-channel:focus-visible)`, so a keyboard user tabbing from saturation to
  brightness (`color-picker-panel.component.html:13-14`) sees no change — both axes look identical
  while focused. Not a wiring bug (both have `aria-label`s), but the visual affordance is missing.

---

## Spec coverage

**Well covered.**

- `slider/headless/internals/slider-engine.ts` — `slider-engine.spec.ts` (252 lines) covers every
  exported function including RTL mirroring, vertical bottom→up, the dev-mode `MARKS_TOO_DENSE` throw,
  and mark-snap directions.
- `slider/headless/slider.directive.ts` + `slider.component.*` — `slider.directive.spec.ts` (423
  lines) mounts the real `et-slider` through `SliderDriver`, covering ARIA, the keyboard model,
  track pointer + drag + cancellation, vertical, marks, `snapToMarks` and the whole `mixed` contract
  (plus `describeMixedStateContract`).
- `slider/headless/range-slider.directive.ts` + component — `range-slider.directive.spec.ts` (263
  lines), same shape, including non-crossing, `minDistance`, and the four `mixed` first-commit cases.
- `dropzone/headless/dropzone.directive.ts` — `dropzone.directive.spec.ts` (736 lines) is the most
  thorough file in the batch: upload, single-mode replace, object-URL lifecycle, cancel-on-remove,
  retry-with-original-args, reconciliation, drag/drop, the five delete-on-remove permutations, the
  `dropzoneFiles` rejection matrix, and all three dev-mode errors.
- `dropzone/headless/dropzone-upload.ts` (v2 flavor) — `dropzone-upload-v2.spec.ts`, including the
  legacy interop creator and the dispose path.
- `dropzone/dropzone.component.ts` — `dropzone.component.spec.ts`, including the live-status region and
  the no-layout-shift preview.
- `color-input/headless/internals/color-convert.ts` — `color-convert.spec.ts` (299 lines), every
  notation in and out plus a coarse round-trip grid.
- `color-input/headless/internals/color-picker-state.ts` — `color-picker-state.spec.ts`, including the
  hue-preservation invariant the file exists for.
- `color-input/color-input-validators.ts` — `color-input-validators.spec.ts` (274 lines), including
  the WCAG reference ratio and the `warn()` severity path.
- `color-input/headless/color-input.directive.ts` + panel — `color-input.directive.spec.ts` (438
  lines) drives the real overlay, notations, swatches, alpha and the mixed contract.

**Real logic with zero direct tests.**

- `color-input/headless/internals/color-picker-engine.ts` (`fractionFromPointer`) — no spec, and it is
  the function whose RTL semantics the High finding above turns on.
- `color-input/headless/internals/eye-dropper.ts` — no spec. `isEyeDropperSupported` and the
  cancel-is-not-an-error `catchError(() => EMPTY)` are both untested.
- `color-input/headless/color-picker-area.directive.ts` — the pointer drag (pointerdown + gesture
  application) is untested; the color-input spec exercises the panel through swatches and the hex
  field only.
- `color-input/headless/color-picker-channel.directive.ts` — no spec drives a channel input's
  `(input)` handler or asserts `aria-valuetext`.
- `dropzone/dropzone.component.ts::removeEntryAnimated` — the animated + FLIP branch is never taken
  (`dropzone.component.spec.ts:137` removes via the button but the spec asserts only the outcome), and
  the `filePickerOpen` / `markTriggerTouched` state machine (`:185-209`) has no spec at all, despite
  being the thing that keeps a file dialog from marking the field touched.
- `slider/headless/slider-thumb-label.directive.ts` — no spec projects an `etSliderThumbLabel`
  template, so `registeredThumbLabelTemplate`, `thumbLabelContext()` and the `THUMB_LABEL_OUTSIDE_SLIDER`
  error are untested. The docs advertise the feature (`slider.md:112-123`).
- `slider/*.component.ts::focus()` / `activate()` and `hasMarkLabels()` — the `data-mark-labels` flag
  is asserted (`slider.directive.spec.ts:247`) but the public `focus()` methods are not.

**Specs asserting a wrong behavior.** None found. `dropzone.directive.spec.ts:220` ("should replace the
current entry in single mode") does assert the current behavior of the Medium finding above, but it
asserts entry/value/object-URL bookkeeping only — it never mounts a `delete` config, so it is
incomplete rather than wrong.

---

## Improvements

### Features

1. **Give the slider a `valueText` formatter.** `thumbValueText`
   (`slider/headless/slider.directive.ts:162-177`) returns `null` unless `snapToMarks` is on, so a
   price, duration or temperature slider announces a bare number. Material and Ark both take a
   formatter; here it would slot straight into the existing `thumbValueText` hook and could also feed
   the `etSliderThumbLabel` context so the bubble and the announcement never diverge.
2. **Support more than two thumbs.** `SliderHostBase` is already index-based
   (`slider/headless/slider.tokens.ts:52-91`) — `thumbValues`, `thumbAriaBounds(index)`,
   `commitThumbValue(index, …)`, `nearestThumbIndex`. An N-thumb host (multi-stop gradients, price
   band editors) needs a new directive, not a new contract.
3. **Add paste-to-upload and reorder to the dropzone.** `handleDrop`
   (`dropzone/headless/dropzone.directive.ts:351-364`) already funnels a `FileList` into
   `selectFiles`; a `paste` listener reading `clipboardData.files` is a few lines and is how users
   attach screenshots. Reordering the `multiple` list (a `value` permutation) is the other common gap —
   the FLIP group in `dropzone.component.ts:261` is already the animation half of it.
4. **Give the dropzone an `accept` input.** Today `accept` exists only as a `dropzoneFiles()` schema
   constraint read through the bound field's metadata
   (`dropzone/headless/dropzone.directive.ts:130-137`), so a dropzone not bound to signal forms cannot
   filter its own native picker. A directive input that the schema overrides would cover both.
5. **Add a real "no color" affordance to the color input.** The value can never return to `null`
   through the UI once picked (`createColorPickerState`'s `emit` always writes a hex,
   `color-input/headless/internals/color-picker-state.ts:49-65`), and `null` renders as black
   (`headless/color-input.directive.ts:77`). A clear action in the panel plus a distinct empty swatch
   would close the loop — and the field already ships a suffix-slot convention for exactly this kind of
   control (see the `[etControlSuffix]` pattern the other controls use).
6. **Recently-used colors and labelled swatch groups.** `swatches` is a flat `readonly string[]`
   (`headless/color-input.directive.ts:55`) rendered as unlabelled buttons whose accessible name is the
   hex string itself (`color-picker-panel.component.html:47`). `{ value, label }` entries (mirroring
   `SliderMark`) plus an optional MRU list are what peer pickers ship.
7. **Show the contrast ratio inside the picker.** The library already exports
   `getColorContrastRatio` and `WCAG_CONTRAST_RATIOS` (`color-input-validators.ts:95-132`). Surfacing
   "4.6:1 on white" in the panel footer would make the validator's verdict visible while choosing
   rather than after committing.

### DX

1. **`clear()` should honour `interactive()` like its three siblings** — see the Medium finding. The
   asymmetry is invisible from the type signature and contradicts the docs' "both stop every
   mutation".
2. **The `uploading` label should be wired, and the fix should be lint-visible.** Beyond the defect
   itself, this is the second label-set member in the batch that a component re-implements inline; a
   spec per label set asserting "every key is read by some template" would have caught it, and would be
   cheap given every domain shares the `defineLabels` shape.
3. **Fold `color-input-validators.ts`'s private parser into `color-convert.ts`.** Two regex copies of
   the same grammar, one of which silently under-accepts (`hsl()`), is the kind of duplication that
   only ever gets more expensive. `parseColorToRgb` returns exactly the `{red,green,blue,alpha}` the
   luminance math needs.
4. **`et-range-slider`'s `minValue`/`maxValue` deserve a doc-comment cross-reference on
   `et-slider`.** The reason for the rename lives in a code comment
   (`slider/headless/range-slider.directive.ts:67-68`) and in the docs
   (`slider.md:42`), but a consumer who reaches for `[min]` on `et-range-slider` gets a
   silently-ignored binding typed as the tuple. A JSDoc on `min`/`max` in `SliderDirective` pointing at
   the range-slider names would shorten that detour.
5. **The color-input domain has no test driver for the panel's surfaces.** `color-input-driver.ts`
   exposes the trigger, the swatch, the hex field and the notation cell, but nothing for the area, the
   hue/alpha channels or the eyedropper — which is exactly why those three files have no coverage.
   Adding `setChannel(channel, value)` and `dragArea(x, y)` to the existing driver unblocks all of it.

### Bundle size

1. **Split the slider stylesheets.** `slider.component.css` (410 lines) and
   `range-slider.component.css` (416) are the same file with a class-name substitution and two
   deliberate differences — a normalized diff shows only the 28/44px block-size, a `z-index` rule, and
   comment wording. The 72-line `@property` block is duplicated verbatim, as is the entire
   support-region section (~80 lines). Per AGENTS.md's "Splitting a large stylesheet", a shared
   styles-only component carrying the tokens + support chrome, mounted by both, removes roughly half of
   both files. The `marks` rules (~60 lines) and the `[data-mixed]` rules (~30) are opt-in features
   whose CSS every slider consumer currently pays for.
2. **`@defer` the color picker panel.** `color-input.component.ts:12` statically imports
   `ColorPickerPanelComponent`, which itself pulls in `FormFieldComponent`, `InputComponent`, both
   affix directives and the eyedropper icon (`color-picker-panel.component.ts:32-41`) plus its own
   350-line stylesheet. Every app importing `et-color-input` bundles the whole picker even if no user
   ever opens it. The panel is already reached only through
   `<ng-template etColorPickerSurface>` (`color-input.component.html:12-14`), which is the natural
   `@defer` boundary — and it is the same "cross-boundary defer" argument AGENTS.md makes for
   `query-devtools`.
3. **Split the dropzone stylesheet by shape.** `dropzone.component.css` is 507 lines, of which the
   readonly block (`:468-506`, ~40 lines), the multiple-mode list (`:243-291`) and the single-file
   preview band (`:171-241`) are mutually exclusive for any given consumer. The list rules in
   particular belong on a stamped child (the `et-dropzone-item`), the way the table puts its expander
   chrome on `table-expander-cell.component.css`.
4. **The dropzone's four icons are eager.** `provideIcons(UPLOAD_ICON, FILE_ICON, ROTATE_RIGHT_ICON, TIMES_ICON)`
   (`dropzone.component.ts:54`) is a static provider, so a readonly dropzone — which renders neither
   the retry nor the remove button (`dropzone.component.html:70,145`) — still ships
   `et-rotate-right` and `et-times`.

### UI/UX

1. **Raise the range slider's pointer target to 44px** — the Medium finding; it is a WCAG 2.5.8
   (Target Size, Minimum) matter as much as a consistency one, and the single slider already encodes
   the right number.
2. **Reserve inline room for vertical tick labels** — the other Medium finding. `data-mark-labels`
   needs an orientation-aware counterpart (`margin-inline-start` in vertical), or the interaction box
   needs `overflow: visible` plus explicit padding.
3. **Distinguish the focused axis in the picker area.** Two stacked invisible range inputs share one
   `:has(:focus-visible)` outline (`color-picker-panel.component.css:83-86`), so tabbing between
   saturation and brightness produces no visible change. Outlining only the active axis (or moving a
   crosshair guide) would make the keyboard path legible.
4. **Add a fine-step modifier to the picker channels.** All four channels are `step: 1` with `max`
   100/360 (`headless/color-picker-channel.directive.ts:13-18,32-36`), so keyboard saturation
   resolution is 1% and the native range input even rounds the displayed value away from the picker's
   fractional working state. `Shift`/`Alt` modifiers (or `step: 0.1`) close a gap every design tool
   has.
5. **Paint the drag-over state on the single-file preview.** `et-dropzone[data-drag-over]` styles only
   `.et-dropzone-trigger` (`dropzone.component.css:448-453`), which is fully covered by the preview
   once a file is picked (`:171-179`, `position: absolute; inset: 0`). Dragging a replacement onto a
   dropzone that already holds a file therefore gives no feedback at all, even though the drop is
   accepted.
6. **Show batch progress in multiple mode.** Each entry has its own bar
   (`dropzone.component.html:136-142`) but a ten-file upload has no aggregate signal; `anyUploading`
   plus a count is already on the directive
   (`dropzone/headless/dropzone.directive.ts:142-144`).
7. **Make the internal-errors region less shouty.** `role="alert"` on the container
   (`dropzone.component.html:180`) re-announces the entire list every time one more entry fails.
   `role="status"` on the container with the alert semantics per message, or an atomic live region,
   would announce only the delta.

### Testing

1. **First: the `snapToMarks`-off tick press** (the High finding) and the **single-mode replace/delete
   interaction** (the Medium). Both are one-assertion additions to specs that already have the harness
   set up (`slider.directive.spec.ts:266` and `dropzone.directive.spec.ts:220`), and both currently
   have a spec sitting right next to the gap that asserts the incomplete half.
2. **Then the three untested color-picker files** — `fractionFromPointer`, `eye-dropper.ts` and
   `ColorPickerAreaDirective`'s drag. `fractionFromPointer` is a pure function (mirror
   `slider-engine.spec.ts`); the eyedropper needs only a fake `window.EyeDropper` to cover support
   detection, the sampled value, and the cancel-as-completion path; the area drag can reuse the
   rect-stubbing trick `slider-driver.ts:8-33` already uses for jsdom's zero-size elements.
3. **Then `dropzone.component.ts`'s two untested behaviors**: the `filePickerOpen` state machine
   (open picker → blur → must **not** mark touched; cancel → must reset) and the animated remove path
   including the FLIP group, which the `Element.animate` mock in `src/test-helpers.ts` already makes
   reachable.
4. **Missing infrastructure**: a slider driver hook for `etSliderThumbLabel` (the template is
   currently unreachable from any spec) and the channel/area additions to `color-input-driver.ts`
   described under DX. Both are additions to drivers that already exist, not new harnesses.

---

`Clean:` Read every non-spec source file in the three domains plus all eleven spec files and the three
docs surfaces. Found sound and worth recording as checked: all three stylesheets are correctly wrapped
in `@layer components` with no Tailwind in component source, and use `:where()` for config modifiers
while leaving interaction states bare (`slider.component.css:132`, `:154`, `:174`, `:319`); the slider's
`@property`-declared token set, `data-*` host contract and reduced-motion handling are complete. State
management follows the repo's rules throughout — synchronous state is signals everywhere, the only RxJS
is genuinely asynchronous (`dragGestureFrom` in the slider track and the picker area, `eyeDropperColor`),
both pipe `takeUntilDestroyed` last, and there is no subscribe-and-assign anywhere in the batch; all
three controls are signal-forms native (`FormValueControl`, no `ControlValueAccessor`). No leaks found:
the drag gesture completes with the gesture, `registerSingleton` and `registerThumb`/`unregisterThumb`
both clean up on destroy, the dropzone disposes every entry and its `EffectRef` watcher on destroy
(`dropzone.directive.ts:160-166`, `:407-411`) and revokes object URLs (verified by an existing spec),
and `createFileDropzoneEntry`'s handles are destroyed via `dispose()`. SSR-safe: `isEyeDropperSupported`
goes through the injected `DOCUMENT` and tolerates a null `defaultView`, and every platform-specific
read (`getComputedStyle`, `getBoundingClientRect`, `Element.animate`) happens inside an event handler or
behind a `typeof … === 'function'` guard. The slider's mixed-state contract is correct in both hosts
(parked thumbs, removed `aria-valuenow`, no tick reads as active, no fill) and matches
`apps/docs/components/mixed-state.md`; the range slider's non-crossing, `minDistance` and
`constrainAndSnap` double-snap logic are right, as is `nearestThumbIndex`'s coincident-thumb
tie-break. The color engine's HSV↔RGB↔HSL math, the hue-preservation invariant `createColorPickerState`
exists for, the `linkedSignal` sequencing around `colorDraft`/`notationWarning`, and the WCAG luminance
formula all check out. The dropzone's value/entry reconciliation (including the
`lastSyncedValue`/`hasSyncedValue` guard against its own writes), the three dev-mode `RuntimeError`s,
and the five delete-on-remove permutations are all correct and specced. `support.errorColorTheme` being
read without call parentheses in the three templates is correct — `injectErrorTheme()` returns a plain
`ColorTheme`, not a signal (`libs/core/src/lib/theming/color-theme.util.ts:145`), and every sibling
control in `forms/` does the same. Comment policy is respected across all three domains: the comments
present are ordering constraints, workarounds with named causes (the Chrome `:focus-visible` note at
`slider-thumb.directive.ts:55-60`, the NG0205 note at `dropzone-upload.ts:365-368`), invariants the
types cannot express, or public-API JSDoc.

---

## Match & Standings

Scope: `libs/components/src/lib/match/**`, `libs/components/src/lib/standings/**`, and
`apps/docs/components/match.md` / `apps/docs/components/standings.md`.

### High

None found. This pair of domains is small, signals-only, and unusually well covered by its own
component specs (see Spec coverage below). No crash, leak, or a11y-breaking defect was found that
meets the High bar.

### Medium

- **The standings "overlapping zones" dev guard only ever checks the zones present at first
  render — a later update that introduces an overlap is never caught.**
  `libs/components/src/lib/standings/headless/standings.directive.ts:77-99` wraps the whole check
  in `afterNextRender(() => { const zones = this.zones(); ... })`. `afterNextRender` callbacks run
  exactly once, after the component's first render, so the closure captures the `zones()` value at
  that moment and never re-runs when the `zones` input signal changes later (e.g. an app swapping
  in a different competition's zone config on the same `<et-standings>` instance, or building the
  zone array from a query response that resolves after the first paint with the position config
  itself still pending).
  **Runtime-verified**: wrote a scratch spec creating `<et-standings>` with `zones: []`, calling
  `detectChanges()`, then updating the `zones` signal to two overlapping ranges and calling
  `detectChanges()` again — no `RuntimeError` was thrown. A sibling case with the *same* overlapping
  zones present from the very first `detectChanges()` call did throw `ET4400` as documented. Scratch
  file was deleted after the run; the working tree is unchanged.
  The docs (`apps/docs/components/standings.md:77-79`) state flatly "Zones must not overlap: … dev
  mode throws `ET4400`" with no caveat that the check is first-render-only, so a consumer relying on
  this as a standing invariant will not get the promised warning for zones assembled or changed
  after mount.

- **`StandingsZone.color` is typed `string`, one step looser than its own doc comment and the
  sibling API it mirrors.**
  `libs/components/src/lib/standings/standings.types.ts:44-45`: `/** A registered color theme name
  (or the theme object) the band is drawn in. */ color: string;` — the comment promises a
  `ColorTheme` object is accepted too, but the field type only allows `string`. Compare
  `MatchCardComponent.liveColor` (`libs/components/src/lib/match/match-card.component.ts:78`),
  which types the equivalent option `RegisteredColorThemeName | ColorTheme | null` — the correct
  shape for `[etProvideColor]`, which `renderRow.zone?.color` is bound straight into
  (`standings.component.html:48` and `:106`). In an app that has augmented
  `EthleteColorThemeNameRegistry` (the pattern the theming docs recommend), `StandingsZone.color`
  being plain `string` also means a typo'd theme name in a zone config gets no type-checking at
  all, unlike every other themed input in this pair of domains.

- **The dense-row docs table promises "small emblems" at every width under 320px; the code drops
  emblems entirely below 150px.**
  `apps/docs/components/match.md:115` reads: `< 320px | Dense row - … small emblems, no subtitles,
  no game breakdown`. But `libs/components/src/lib/match/match-card.component.css:150-159` adds a
  second, narrower container-query rule for `auto`/`compact` sizing:
  `@container et-match-card (max-inline-size: 149px) { … --_et-match-participant-emblem-display:
  none; }`, which removes the emblem frame outright. The CSS comment above it explains the intent
  well ("an emblem, a name and a score is one thing too many" for a ~150px bracket cell) — this is
  a deliberate fourth density the docs simply never mention, so a reader of the width table alone
  would reasonably expect an emblem to still be present anywhere under 320px, including a 140px
  bracket column, and be surprised when it isn't drawn. Code-verified only: jsdom's CSS parser drops
  `@layer`/`@container` rules wholesale (confirmed against this lib's own `vite.config.mts` comment
  on the same limitation), so this can't be exercised through a component spec — it was confirmed by
  reading the shipped stylesheet directly.

### Low

- **The docs' `NormalizedMatch` type snippet omits `resultKind: 'outcome'`.**
  `apps/docs/components/match.md:44`: `resultKind: 'score' | 'points'; // what those two values are`
  — the real type (`libs/components/src/lib/match/match.types.ts:55`) is
  `'score' | 'points' | 'outcome'`, and the very next doc section (`match.md:82-108`) correctly
  documents and demos the `'outcome'` form with a `<StoryEmbed>`. A reader who copies the type
  snippet as a reference will have a type that rejects the outcome example three paragraphs below
  it.

- **Neither dev-mode `RuntimeError` in this pair of domains has a test.** `ET4300`
  (`MatchCardScoreDirective`/`MatchCardMetaDirective`/`MatchCardGameScoresDirective` used outside
  `[etMatchCard]`, thrown from `libs/components/src/lib/match/headless/match-card-parts.directive.ts:10-24`)
  and `ET4400` (overlapping zones, `standings.directive.ts:77-99`) are both unexercised by any spec
  — confirmed by `grep -rn "OVERLAPPING_ZONES\|PART_OUTSIDE_MATCH_CARD"` returning only the
  definition and throw sites, no spec file. The overlapping-zones one is also the Medium timing gap
  above, which a test would have caught.

- **Heavy rationale commenting throughout both domains' CSS and TS**, beyond the four categories
  AGENTS.md allows (ordering/timing constraint, unexpressed invariant, workaround with cause, public
  JSDoc). Representative examples: the "why centred, not top-packed" aside in
  `match-card.component.css:130-132`, the "why this is a descendant selector" aside in
  `match-card.component.css:360-362`, and "why we don't build `et-match-list`" in
  `sport-recipes-storybook.component.ts:10-13`. In isolation each is reasonable design rationale and
  reads as consistent, deliberate house style across the entire domain (every file in both `match/`
  and `standings/` follows it uniformly) rather than a one-off slip, so this is flagged for
  awareness rather than as a set of individual violations to fix.

### Spec coverage

Well covered:
- `MatchCardComponent` (`match-card.component.spec.ts`) is thorough: both result forms (score,
  points, outcome), the composed accessible name and its label overrides, the live/meta row,
  game-score breakdown, CSS state attributes, interactivity detection on `<a>` vs `<div>`, seeds, and
  the score-rolling transition (`digits()` states across a live update) including "first render
  never animates" and "a finished match never animates."
- `MatchParticipantComponent` (`match-participant.component.spec.ts`): name/code fallback chain in
  both directions, TBD vs loading states, seed visibility, subtitle visibility and compact dropping,
  interactive-host naming, label overrides.
- `normalizeEthleteMatch` and friends (`integrations/ethlete.spec.ts`): media fallback chain, status
  collapsing (including the `hidden`-as-scheduled case), gamertag-over-name, game-score filtering and
  ordering by `matchGameNumber`, one-sided game scores, unnumbered matches.
- `StandingsComponent` (`standings.component.spec.ts`): table semantics (caption, `scope="row"`/
  `"col"`, `abbr`), row order preservation, signed difference, dropped detail/form columns when
  unreported, zone banding + legend from the same config, `showLegend`, highlighted row, and label
  overrides.

Gaps:
- `MatchScoreComponent` (`match-score.component.ts`) has **no dedicated spec file**. Its rolling
  logic is exercised only indirectly through `MatchCardComponent`'s "a score changing" describe
  block, which covers the common path but not: `animate=false` explicitly (only inferred from the
  finished-match case, which is a different gate — `isLive()` — not the input itself), rapid
  successive changes before the previous transition's `animationend` fires, or standalone use
  outside a card.
- `MatchCardMetaDirective` / `MatchCardScoreDirective` / `MatchCardGameScoresDirective`'s
  `ET4300` throw-when-outside-a-card path is untested (see Low).
- `StandingsDirective`'s `ET4400` overlapping-zones throw is untested, and as shown above the
  current implementation only checks once — a test would have surfaced that.
- No spec on this pair of domains asserts a wrong behavior; nothing here needed to be corrected.

### Improvements

**Features**

- **Give `et-standings` a loading state to match `et-match-participant`'s.** The participant
  primitive already distinguishes a pending fetch (`loading`) from a decided TBD slot
  (`participant: null`), but `StandingsComponent` has no equivalent — a consumer fetching a table
  has to build its own skeleton rows or flash an empty table. A `loading` input drawing skeleton
  rows (reusing `SKELETON_IMPORTS`, already a dependency of the match domain) would bring the two
  domains to parity.
- **No `'postponed'`/`'cancelled'` match status.** `NormalizedMatchStatus` is
  `'scheduled' | 'live' | 'finished'` (`match.types.ts:37`); most real fixture lists need to show a
  postponed or abandoned match distinctly from one that simply hasn't kicked off yet — right now an
  adapter has nowhere to put that information and a postponed match reads as merely "not started."

**DX**

- **Fix `StandingsZone.color`'s type** to `RegisteredColorThemeName | ColorTheme` (see Medium
  finding) — cheap, and brings it in line with `MatchCardComponent.liveColor`'s pattern plus the
  registry-augmentation guidance the theming skill already recommends apps follow.
- **No test driver for either component.** Both specs poke the DOM directly with ad hoc
  `querySelector`/`all` helpers redefined per spec file (`card`, `text`, `all`, `cells` — nearly
  identical shapes in `match-card.component.spec.ts` and `standings.component.spec.ts`). A shared
  driver (in the vein of the ones already built for the form controls per the repo's recent driver
  passes) would cut the boilerplate and make the `ET4300`/`ET4400` gaps above cheaper to close.

**Bundle size**

- Nothing worth restructuring here: `match-card.component.css` (~455 lines) is close to the
  "few hundred lines" split threshold in AGENTS.md, but the CSS is a single density/state machine
  that every consumer of the card exercises (live badge, winner emphasis, three layouts) — there
  isn't an identifiable minority slice to pull into a styles-only component the way `form-field` or
  the table's expander cell can.

**UI/UX**

- **A postponed/cancelled match currently has to be represented as `'scheduled'`**, which means its
  kick-off time is still drawn and read aloud as if the match will start then — actively misleading
  rather than merely incomplete. Same root cause as the Features item above, called out again here
  because it's the sharper UX consequence.
- **Standings rows have no interactive/hover treatment**, unlike the match card
  (`.et-match-card:where([data-interactive]):hover`). Today that's fine because the only actionable
  element inside a row is the participant primitive itself, but if a consumer ever wants the whole
  row clickable (a common standings pattern — click anywhere on the row to open the team), there's
  no supported path or documented convention for it the way the match card documents "make the host
  the link."

**Testing**

- Add a `match-score.component.spec.ts` covering `animate=false`, `prefers-reduced-motion` (the repo
  already ships a `matchMedia` jsdom shim in test-helpers for exactly this), and a second value
  change arriving before the first one's `animationend` fires.
- Add specs for the two `RuntimeError` paths (`ET4300`, `ET4400`) — trivial to write and, per the
  Medium finding, would have caught the overlapping-zones timing gap immediately.

Clean: read every non-spec source file and every spec file in both domains
(`headless/`, `integrations/`, the components, labels, errors, types, imports, and `stories/`), plus
`apps/docs/components/match.md` and `apps/docs/components/standings.md`. Verified: CSS layering
(`@layer components` wraps both stylesheets in full), no hardcoded primary colors (every color value
is a `var(--et-surface-*|--et-theme-color-*, fallback)` — fallbacks like `gray`/`currentColor` are
permitted per AGENTS.md and never the primary value), signals-only reactive state with no RxJS
anywhere in either domain, no `ControlValueAccessor` (neither domain has form controls), no SSR-unsafe
API use (`afterNextRender` guards the two dev-mode assertions; `format()` and DOM reads are
browser-only call sites), and the `MatchScoreComponent` rolling-value mechanism (`linkedSignal` +
negative-key `@for` tracking) traced by hand across rapid, back-to-back, and reduced-motion value
changes without finding a stuck or duplicated element.

---

## icon, picture, skeleton, loader, empty-state

### High

- **`et-picture` gets permanently stuck in `'loading'` state, with no image and no error, when `defaultSrc` is omitted and only `sources` is set.** `sources`/`defaultSrc` are both optional inputs (`libs/components/src/lib/picture/picture.component.ts:67,74`), but `loadState`/`loadedSize` only ever change inside `markLoaded`/`markFailed` (`picture.component.ts:185-197`), which are wired to the `<img>`'s `(load)`/`(error)` events in the template (`picture.component.html:13-24`). That `<img>` only renders when `resolvedDefaultSource()` is truthy (`picture.component.html:12`) - so a consumer who supplies only `sources` (a plausible reading of the API surface, since `defaultSrc` is `null` by default and nothing marks it as effectively required at runtime) gets a `<picture>` with `<source>`s but no `<img>`, no `load`/`error` ever fires, `state()` never leaves `'loading'`, and any `etPicturePlaceholder` template stays visible forever with no error surfaced. The docs do state "`defaultSrc` is not optional in practice" (`apps/docs/components/picture.md:38`) but the component enforces nothing - `alt` is `input.required`, `defaultSrc` is not.
  **Runtime-verified**: a scratch spec (`et-picture` with only `sources` + an `etPicturePlaceholder`, deleted after) rendered no `<img>`, kept the placeholder text in the DOM, and left `state()` at `'loading'` after `detectChanges()`.

### Medium

- **`SVG` dev-mode validation (`INVALID_SVG`/`MISSING_XMLNS`/`MISSING_DIMENSIONS`/`HARDCODED_COLOR`) and `allowHardcodedColor` have zero spec coverage**, despite being the majority of the directive's actual logic. `libs/components/src/lib/icon/headless/icon.directive.ts:105-138` is exercised nowhere in `icon.directive.spec.ts` - a regression in any of those four checks (e.g. the regex silently stops matching `stop-color`, or `allowHardcodedColor` stops suppressing the throw) would ship undetected. See Spec coverage below.

### Low

- **No dev-mode warning when `et-picture` is configured with `sources` but no `defaultSrc`.** Tying to the High finding above: since the docs explicitly call this combination unsupported ("not optional in practice"), a `ngDevMode`-gated `console.warn`/`RuntimeError` (the pattern already used for missing mime types in `picture.utils.ts:38-43`) would turn a silent, permanently-frozen UI into a caught mistake during development.
- **`BrandLoaderComponent`'s `nextId` module-level counter (`brand-loader.component.ts:10,53-55`) is a plain `let`, not reset per bootstrap.** Functionally harmless (IDs only need to be unique, and a monotonically increasing counter across multiple app instances in one JS realm still guarantees uniqueness), but it's the kind of module-level latch AGENTS.md calls out - worth a second look only if a future change makes the IDs need to be *stable* (e.g. for SSR hydration diffing) rather than merely unique.
- **`picture.utils.ts:75`/`withPictureBaseUrl`'s early-return only checks whether the *whole* `srcset` string starts with `data:`.** If a single `srcset` ever mixed a leading `data:` URI with additional comma-separated URL candidates (unusual, arguably invalid usage - data URIs are normally used alone), the remaining candidates would skip base-URL prefixing entirely. Not observed in practice and not covered by a test; flagging only because the per-candidate `data:` check inside `withBaseUrl` (line 60) suggests the author intended to handle mixed candidates, but the outer short-circuit prevents ever reaching it for this specific shape.

### Spec coverage

Well covered:
- `IconDirective`: registry resolution, variant fallback/exact-match, `label`→`role="img"` toggle, `provideIcons`/`provideIconOverrides` merge/duplicate-detection, and the `ET_BUILT_IN_ICON_NAMES` drift guard (`icon.directive.spec.ts`).
- `PictureComponent`: `fit`/`data-fit` reflection, `naturalSize`/`naturalAspectRatio`/`state` transitions on load/error, and the reset-on-`defaultSrc`-or-`sources`-change behavior (`picture.component.spec.ts`).
- `picture.utils.ts`: `extractFirstImageUrl`, `normalizePictureSource`, `normalizePictureSizes`, `withPictureBaseUrl` all have thorough, well-targeted unit tests (`picture.utils.spec.ts`).
- `SpinnerComponent`/`ProgressBarComponent`: determinate/indeterminate aria wiring, value clamping, `track`, `color`→themed class (`spinner.component.spec.ts`, `progress-bar.component.spec.ts`).
- `BrandLoaderComponent`: role/aria-label, SVG structure, per-instance unique clip-path IDs (`brand-loader.component.spec.ts`).
- `EmptyStateComponent`: unconfigured render, heading/description rendering, action projection (`empty-state.component.spec.ts`).

Gaps / zero coverage on real logic:
- `IconDirective`'s dev-mode SVG validation path (`INVALID_SVG`, `MISSING_XMLNS`, `MISSING_DIMENSIONS`, `HARDCODED_COLOR`) and `allowHardcodedColor` - see Medium above.
- `SkeletonComponent`/`SkeletonTextComponent`/`SkeletonItemComponent` have **no spec files at all** - `resolvedLoadingAllyText` fallback to `LOADER_LABELS`, the `animated` class toggle, and `SkeletonTextComponent`'s `lineList` computation (line count, last-line-width, clamping `Math.max(1, lines())`) are all untested.
- `PictureComponent`'s "`sources`-only, no `defaultSrc`" path (the High finding above) - not exercised by any existing test, which is exactly how it went unnoticed.
- No test asserts `et-picture`'s `NgTemplateOutlet`-based placeholder/error slots actually project the right content (only implied by the component compiling); a spec driving `contentChild` resolution would catch a future selector/directive mismatch.

No existing spec was found asserting a wrong behavior as correct.

Clean: `icon-provider.ts` registry/override merge logic, `icon-errors.ts` code table (matches `apps/docs/components/error-codes.md` 1800-1806 exactly), all icon SVG source files spot-checked for `xmlns`/`width="100%"`/`height="100%"`/`currentColor` compliance, `skeleton.component.css`/`empty-state.component.css`/`progress-bar.component.css`/`spinner.component.css`/`brand-loader.component.css` (all correctly `@layer components`-wrapped, no hardcoded primary colors - the brand loader's `#00ffa1` fallback and story SVG placeholder colors are permitted `var(--token, fallback)` defaults/demo assets, not primary values), no RxJS/subscription leaks anywhere in scope (grepped for `console.`/`subscribe(`/`TODO`/`FIXME` - only one legitimate `console.warn` in `picture.utils.ts:39`, itself `ngDevMode`-gated), `EMPTY_STATE_IMPORTS`/`PICTURE_IMPORTS`/`SKELETON_IMPORTS`/`ICON_IMPORTS` all correctly scoped, no Tailwind found in any non-story component source file in scope, `provideIconOverrides`/`provideIcons` duplicate-key detection verified by tests, `SpinnerComponent`'s `hasExplicitColor`/host-directive `color` input correctly aliases `ProvideColorDirective`'s `etProvideColor`.

### Improvements

- **Features**: A `PictureComponent` "blur-up" / low-quality-image-placeholder mode - accepting a tiny inline `data:` URI to paint immediately under the real image - is a common peer feature (Next.js `Image`, Nuxt Image) that the current `etPicturePlaceholder` slot doesn't cover (it can only show a static shape, not a blurred preview of the actual photo). Also, `SkeletonItemComponent`'s three shapes (`text`/`rect`/`circle`) are the common set, but peer libraries (Ark UI, shadcn) often ship a bone-count helper for repeating rows/grids beyond `SkeletonTextComponent`'s line-only case - e.g. a generic `et-skeleton-group` that repeats an arbitrary template `n` times, useful for card/list skeletons.
- **DX**: `PictureComponent.defaultSrc` should be either enforced (a dev-mode warning when `sources().length > 0` and `defaultSrc()` is `null`, mirroring the mime-type warning already in `picture.utils.ts:38-43`) or the docs' framing ("not optional in practice") should be backed by code. Right now the gap between the type system (fully optional) and the documented contract (effectively required) is exactly what produced the High finding above.
- **Bundle size**: `libs/components/src/lib/icon/headless/` ships ~55 built-in icon constants as always-importable modules from one barrel (`icon/index.ts` → `headless/index.ts`, all `export *`). Since each icon is a small tree-shakeable constant this is likely fine in practice (dead-code elimination should drop unused ones), but it's worth confirming with `tools/treeshake` goldens that importing e.g. just `CHEVRON_ICON` doesn't pull in sibling icon modules' SVG string literals - `export *` re-barrels sometimes defeat tree-shaking depending on the bundler's side-effect analysis.
- **UI/UX**: `EmptyStateComponent` renders its `heading` as a plain `<p>` (`empty-state.component.ts:20`), not a heading element - fine for the common case of an inline empty state, but for the "whole page has nothing to show" case (a documented use case: "no search results... a not-yet-configured feature") a `<p>` gives screen-reader users no landmark/heading to jump to. An optional `headingLevel` input (rendering `h2`-`h6`) would let page-level usages integrate into the document outline without forcing it on every inline usage. Separately, `PictureComponent`'s error slot swaps in visually but doesn't set `aria-live`, so a slow failure (image errors after several seconds) is never announced to a screen reader already past the image.
- **Testing**: Add a spec file for `skeleton/` (currently none) covering `resolvedLoadingAllyText`'s fallback to `LOADER_LABELS.loadingContent`, the `animated` class toggle, and `SkeletonTextComponent`'s `lineList` (including the `Math.max(1, lines())` clamp for `lines="0"` or negative input, which is currently unverified). Add a `PictureComponent` spec for the `sources`-only / no-`defaultSrc` combination once (or as part of) the DX fix above, so the behavior is pinned down either way.

---

## Batch 07 — phone-input, otp-input, tag-input, forms/testing

Scope: `libs/components/src/lib/forms/{phone-input,otp-input,tag-input,testing}` +
`apps/docs/components/text-inputs.md` (the guide that owns all three), plus
`apps/docs/components/{mixed-state.md,error-codes.md,forms.md}` where they make claims about
these controls.

Runtime verification used two scratch specs (`phone-input/headless/__scan-verify.spec.ts`,
`otp-input/__scan-verify.spec.ts`, `tag-input/__scan-verify.spec.ts`), run with
`NX_NO_CLOUD=true npx vitest run --root libs/components --config vite.config.mts <spec>`.
All three were deleted; `git status` on the scope is clean.

## phone-input / otp-input / tag-input / forms-testing

### High

- **Typing an international `+…` number into `et-phone-input` character by character produces a
  corrupted value — only a whole-string paste works, and the docs promise both.**
  `phone-input-field.directive.ts:50-53` rewrites the element text to the *national*
  interpretation the moment the value's `+` prefix has been normalized. The next keystroke is
  therefore read as national digits (`phone-input.directive.ts:195-210` takes the
  no-`+` branch) and the active dial code is prepended a second time. Nothing in
  `setNationalInput` remembers that the user is mid-way through an international entry.
  **Verified at runtime** (`defaultCountry="de"`, focused, one `input` event per character):

  ```
  typed "+" -> el="+"         value=""             country=de
  typed "4" -> el="4"         value="+4"           country=de
  typed "9" -> el="49"        value="+4949"        country=de
  typed "1" -> el="491"       value="+49491"       country=de
  typed "7" -> el="4917"      value="+494917"      country=de
  typed "0" -> el="49170"     value="+4949170"     country=de
  …
  typed "4" -> el="491701234" value="+49491701234" country=de
  ```

  The control case (same string delivered as one `input` event, i.e. a paste) gives
  `value="+491701234"`. `text-inputs.md:445` says "Typing **or** pasting a full `+…` number
  re-derives the country by longest dial-code match" — the typing half is false, and the
  resulting form value is silently wrong rather than merely unformatted. The existing spec only
  covers the paste path (`phone-input.directive.spec.ts:99` — "re-derives the country from a
  **pasted** international number", driven by `setInputValue`, one event for the whole string),
  which is why this never showed up.

- **`et-otp-input`'s `aria-describedby` points at an element that does not exist, so its
  hint/error/warning is never announced.** `otp-input.component.html:24` binds
  `aria-describedby` to `otp.describedBy()`, which `FormFieldDirective` fills with
  `hintId()`/`errorId()`/`warningId()` (`form-field/headless/form-field.directive.ts:54-73,
  183-192`). But the OTP's own support containers
  (`otp-input.component.html:52`, `:70`, `:88`) carry only `#errorContent`/`#warningContent`/
  `#hintContent` — **no `[id]` binding** — unlike `form-field.component.html:47,68,89` and
  `choice-field.component.html:27,46,65`, which both bind `[id]`. **Verified at runtime** with
  `<et-otp-input name="code"><et-label>…</et-label><et-hint>…</et-hint></et-otp-input>`:
  `aria-describedby="et-form-field-hint-code"`, `getElementById(...)` → `null`; the only id in
  the whole subtree is `et-label-0`. (The same missing-`[id]` shape exists in
  `rating/rating.component.html:52`, `slider/slider.component.html:44`,
  `dropzone/dropzone.component.html:192` and the selection-list group templates — out of my
  scope, but worth handing to whoever owns them, since `dropzone.component.html:22` also binds
  `aria-describedby`.)

- **`aria-label` / `aria-labelledby` on `et-tag-input` or `et-phone-input` never reaches the
  native input — the control ends up with no accessible name at all.** Both directives
  hand-roll the `FormFieldControl` surface and omit the `ariaLabel`/`ariaLabelledby` inputs and
  `hasCustomAccessibleName` that `form-field/headless/text-field-control.directive.ts:76-103`
  owns for every other text control. `tag-input.directive.ts:85` /
  `phone-input.directive.ts:70` derive `labelId` from the projected `<et-label>` only, so a
  host-level `aria-label` lands on a role-less custom element (ignored by AT) and dies there.
  **Verified at runtime**: `<et-form-field><et-tag-input aria-label="Tags" /></et-form-field>`
  (no `<et-label>`) → host has the attribute, inner `.et-tag-input-field` has
  `aria-label=null aria-labelledby=null`. `forms.md:337-341` documents `aria-label` /
  `aria-labelledby` as the accepted alternative to `<et-label>` for "a control" and only
  mentions `ET2201` as the failure mode; `text-inputs.md:487-490` lists the five forwarding
  controls but never states that these two reject it. A consumer following the overview gets an
  unlabelled field (plus a dev-mode `ET2201` throw for a name they did supply).

### Medium

- **`removeLast()` and any out-of-range `removeAt()` on a tag input emit a brand-new value array
  even though nothing changed.** `tag-input.directive.ts:181-183` calls
  `removeAt(effectiveValues().length - 1)`, i.e. `removeAt(-1)` when there are no tags, and
  `:178` unconditionally runs `value.set(this.value().filter(…))` — `Array.prototype.filter`
  always allocates, so the `model` (default `===` equality) always notifies. **Verified at
  runtime**: two `Backspace` presses on an empty field with an empty value → **2**
  `valueChange` emissions; `removeAt(99)` on `['a']` → **1** emission. For a `[formField]`-bound
  control that is a spurious write into the form model (dirty tracking, validator re-runs, any
  `valueChange`-driven side effect) on a keystroke that is supposed to be a no-op. The
  `mixed` path is guarded (`:174`), the non-mixed path is not.

- **A `maxTags`-full tag input holding leftover rejected text is a keyboard dead end.**
  `tag-input-field.directive.ts:19` binds `[readOnly]="tagInput?.readonly() || isFull()"`, and
  `:110` only removes a tag when `element.value` is empty. Reject-keeps-the-text is deliberate
  (`tag-input.directive.ts:132-144`, asserted at `tag-input.directive.spec.ts:64`), so the two
  behaviours combine into a state with no keyboard exit. **Verified at runtime**: value `['a']`,
  `maxTags=2` → type `a`+Enter (duplicate rejected, field keeps `"a"`) → paste `x,y` (adds `x`,
  fills up) → `field.readOnly === true` with `"a"` still in it; a `Backspace` press changes
  nothing (`value=["a","x"] field="a" readOnly=true`). The only recovery is a pointer click on a
  chip `×`, and chip remove buttons are `tabindex="-1"` by design
  (`chip/headless/chip-remove.directive.ts:13`) with no chip focus ring in the tag input.

- **A `RegExp` charset carrying the `g` flag silently drops every other character in
  `et-otp-input`.** `otp-input.directive.ts:83-87` returns the consumer's RegExp as-is and
  `sanitize` (`:117-120`) calls `pattern.test(char)` per character; `test` on a global regex
  advances `lastIndex`, so it alternates true/false. **Verified at runtime**:
  `charset = /[0-9]/g`, typing `123456` → `value === "135"`. The public type is
  `OtpInputCharset = 'numeric' | 'alphanumeric' | RegExp` (`:17`, documented at
  `text-inputs.md:368`) with nothing saying the flag matters. A `new RegExp(source, flags & ~g)`
  normalization in `charPattern` fixes it.

- **Shrinking `length` on `et-otp-input` leaves the over-long value in the form.**
  `segmentChars` (`otp-input.directive.ts:69-78`) and the native `maxlength`
  (`otp-input.component.html:28`) both follow the new length, but nothing re-sanitizes `value`
  and `maxlength` does not truncate an existing value. **Verified at runtime**: type `123456`
  (length 6), set `length` to 4 → 4 segments rendered, native field `"123456"`, form value
  `"123456"`. The user sees a 4-slot code and submits 6 characters.

- **`defaultCountry` is honoured only on the first computation of `country`.**
  `phone-input.directive.ts:84-97`: the `linkedSignal` computation prefers `previous?.value`
  over `this.defaultCountry()`, and the computation is re-run by a change to its *source* (the
  dial code matched out of `value`), not by a change to `defaultCountry`. **Verified at
  runtime**: mount with `defaultCountry="de"` and an empty value, then set it to `"fr"` →
  `country()` stays `"de"`, `dialCode()` stays `"49"`. A default derived from a locale or geo-IP
  lookup that resolves after the first render never applies, and `text-inputs.md:437` describes
  the input as "ISO alpha-2 country used **while** the value carries none" — which reads as
  continuously applicable.

- **Pasting into a tag input discards the text already in the field.**
  `tag-input-field.directive.ts:116-141` `preventDefault()`s and calls `addAll(parts)` without
  merging `element.value` or clearing it. **Verified at runtime**: field holds `"pre"`, paste
  `one,two` → `value === ['one','two']`, field still `"pre"`. The pending fragment is neither
  joined to the first pasted part nor committed first, so it later lands *after* the pasted tags
  on blur — the opposite of the order the user typed things in. (Native paste-into-a-caret
  semantics would append to / splice into the pending text.)

- **`complete` never fires for a programmatic full-length value.**
  `otp-input.directive.ts:124-149` emits only from the native `input` handler. **Verified at
  runtime**: `length=4`, `value.set('1234')` → `completions === []`. `text-inputs.md:373` says
  "The `complete` output emits the value each time it reaches the full length", with no
  user-input qualifier. A form restored from saved state, or an app that reads the code out of a
  deep link and writes it into the field, never triggers the verify callback the whole output
  exists for.

- **The phone input's country trigger never announces which country is selected.**
  `phone-input.component.html:12` puts a static `aria-label` on the button
  (`resolvedCountryLabel()`, default `'Select country'`), the flag span is `aria-hidden`
  (`:18`), and `aria-label` overrides the visible `+{{ dialCode }}` text (`:25`). So the trigger
  reads as "Select country, collapsed" whether the active country is Germany or Japan. The
  select's own trigger composes `aria-labelledby` from the field label plus its own id
  (`select/headless/select-trigger.directive.ts:61-69`) precisely to avoid this; here
  `labelledBy()` is `null` because `etFormFieldBarrier` nulls `FORM_FIELD_TOKEN` and the panel
  has an `etSelectSearch`. Fix: compose the label as `"<countryLabel>, <country name> +<dial>"`
  or drop the `aria-hidden` and let the dial code contribute.

- **Signal-forms `hidden` silently no-ops on all three controls, against a documented promise.**
  `FormFieldDirective.isHidden` reads `registeredControl()?.hidden?.()`
  (`form-field/headless/form-field.directive.ts:133`), and signal forms binds `hidden` only when
  the control declares the input. Only `text-field-control.directive.ts:43` and the rich text
  editor do (`grep -rl "hidden = input"` over `forms/` returns exactly those two).
  `forms.md:335-336` states unconditionally that "A schema-`hidden` field (signal-forms
  `hidden`) removes the whole `et-form-field` from layout and the accessibility tree" —
  `hidden(s.tags)` / `hidden(s.phone)` leaves the field on screen. The same omission costs these
  three the `warnings` input (`text-field-control.directive.ts:52`), so a control not bound to a
  signal-forms field cannot show an advisory at all; `phone-input.directive.ts` and
  `otp-input.directive.ts` additionally lack `maxLength` and `pending`, which
  `tag-input.directive.ts:46,52` does declare.

- **`et-otp-input` exposes no `data-disabled` / `data-readonly` on its host, unlike both
  siblings.** `phone-input.directive.ts:26-30` and `tag-input.directive.ts:17-21` each publish
  `data-disabled` / `data-readonly` / `data-mixed`; `OtpInputDirective` (`:24-27`) has no `host`
  block at all, and its stylesheet reaches for `:has(.et-otp-input-native:disabled)`
  (`otp-input.component.css:158`) instead. A consumer cannot style the readonly OTP at all
  (there is no `:read-only`-based rule beyond a cursor at `:145`), and the `[data-*]` hook the
  other two document is missing.

### Low

- **`ET2801` is defined but undocumented.** `phone-input-errors.ts:4` declares
  `FLAG_TEMPLATE_OUTSIDE_PHONE_INPUT: 2801` and `phone-input-flag.directive.ts:43-47` throws it;
  `error-codes.md:90-93` lists only `ET2800`.

- **`clearable` and `clearLabel` on `PhoneInputComponent` are undocumented public API, and the
  clear affordance is unmentioned.** `phone-input.component.ts:69,71`; the phone section of
  `text-inputs.md:434-441` lists only `defaultCountry`, `preferredCountries`, `countryLabel`.
  The date-time inputs document the identical pair (`date-time-inputs.md:49,112`), so this is a
  gap against a house convention, not a deliberate omission.

- **Six of the nine OTP design tokens are undocumented.** `text-inputs.md:501` lists
  `--et-otp-input-segment-size/-gap/-radius`; `otp-input.component.css:30,36,42,48,54,60` also
  `@property`-registers `--et-otp-input-label-font-size`, `-support-duration`,
  `-support-offset`, `-error-font-size`, `-warning-font-size`, `-hint-font-size` — all
  inheriting and therefore overridable by a consumer.

- **The tag-input docs section has no `<StoryEmbed>`** even though
  `components-forms-tag-input--default` exists (`tag-input.stories.ts:4,43`). The OTP and phone
  sections both embed one (`text-inputs.md:365,432`), so the guide reads inconsistently.

- **The tag-input and OTP input tables omit real inputs.** Tag input
  (`text-inputs.md:403-408`): no `placeholder`, `mixedLabel`, `maxLength`, `pending`. OTP
  (`text-inputs.md:367-371`): no `readonly` (which the story exercises,
  `otp-input.stories.ts:16`), no `required`.

- **`text-sm` in all three storybook components emits nothing.** Storybook's trimmed theme sets
  `--text-*: initial` (`apps/storybook/src/styles/storybook.css:32`) and defines
  `text-small`/`text-medium`/… instead, so Tailwind's own scale is absent. Occurrences:
  `tag-input/stories/tag-input-storybook.component.ts:36,41`,
  `otp-input/stories/otp-input-storybook.component.ts:25,27`,
  `phone-input/stories/phone-input-storybook.component.ts:28,33`. Should be `text-small`.

- **The tag-input story's `value` arg is unreachable from the controls panel.**
  `tag-input.stories.ts:8-38` has no `argTypes.value` entry and no `args.value` default, yet
  `Prefilled` and `MaxTags` set it (`:46,60`). The phone story lists `value` in both
  (`phone-input.stories.ts:12,25`).

- **The headless `OtpInputDirective` is exported but undrivable.** It ships in
  `OTP_INPUT_IMPORTS` (`otp-input.imports.ts:4`) and auto-adopts an `<input>` host
  (`otp-input.directive.ts:93-98`), but it declares no host listeners, and its only entry points
  — `handleNativeInput`, `handleNativeFocus`, `handleNativeBlur`, `handleNativeSelectionEvent`
  (`:123-180`) — are all `@internal`. There is no `etOtpInputField` sibling directive the way
  phone (`phone-input-field.directive.ts`) and tag (`tag-input-field.directive.ts`) have one, so
  the headless tier of this domain has no supported usage.

- **`describeMixedStateContract` documents two contract clauses it never asserts, and one of its
  four tests can pass vacuously.** `mixed-state-contract.ts:17-20` states clauses 5 (keyboard
  deletion never mass-clears) and 6 (`mixedLabel` never enters the form value); the suite
  (`:55-102`) asserts 1–4 only. And `:89-101` returns early into a green pass when a harness
  omits `clear`/`emptyValue` — so a control that *loses* its clear affordance silently keeps a
  passing "clears to the empty shape and resolves mixed" test. Guard with `it.skipIf` or move
  the clear case behind an explicit opt-out flag.

- **`phoneCountryName` constructs a fresh `Intl.DisplayNames` per country.**
  `phone-countries.ts:253-262`, called once per entry in
  `phone-input.component.ts:86-90` → ~220 `Intl.DisplayNames` instantiations on the first panel
  open (and again on every locale change). Hoisting one instance per locale is a one-line change.

- **A `+` number whose dial code matches nothing leaves value and country inconsistent.**
  `phone-input.directive.ts:199-203` commits `+999`, `matchCountryByDialCode` returns `null`
  (`phone-countries.ts:224-234`), the `linkedSignal` falls back to the previous country
  (`:89-91`), and `nationalNumber` (`:102-111`) returns the whole `999` because it does not
  start with the active dial code. So the trigger shows `+49` while the value is `+999`. No
  crash, but a nonsense state a `dialCode`-aware consumer would trip on.

- **Comment-policy violations (restating the code).** `AGENTS.md` allows four kinds only; these
  are none of them:
  `phone-input-field.directive.ts:51` ("a `+…` entry was normalized into value/country - show
  the national part again") and `:85` ("editing works on the raw digits", above
  `element.value = phoneInput.nationalNumber()`);
  `phone-input.component.ts:78` ("only while the field is in use - mirrors the select's clear
  affordance");
  `phone-input.component.html:1` (a section header over the select composition);
  `phone-input.component.css:36`, `:97` ("mirrors the menu's search field …" — a cross-reference,
  i.e. migration narration), `:155`;
  `otp-input.component.css:113`, `:240` ("typed characters pop in");
  `tag-input-field.directive.ts:75`, `:148` ("leaving the field keeps what was typed - as a
  tag").
  The keepers in the same files are legitimate: `otp-input.component.css:136` (iOS zoom
  workaround) and `:143-144` (explicit rule-ordering constraint),
  `phone-input.directive.ts:158-160`, `phone-input.component.ts:112,120-121`,
  `phone-input.component.html:34`, `phone-input.component.css:83-84`.

- **`[disabled]` is not forwarded to the phone input's inner `etSelect`.**
  `phone-input.component.html:2-10` forwards `[readonly]` only; interaction is blocked because
  the trigger button carries the native `disabled` (`:13`), but the inner select's own
  `disabled()` stays `false`, so `select-trigger.directive.ts:20-21`'s `aria-disabled` /
  `data-disabled` never appear. Cosmetic today, a trap for anyone styling off those hooks.

### Spec coverage

**Well covered.**
`phone-input.directive.spec.ts` (261 lines) is the strongest of the three: dial-code matching,
trunk-zero strip and its Italy exemption, the `00` prefix, country switch keeping the national
number, the shared-`+1` manual-pick rule, external value → country derivation, the
focused/unfocused display swap, the clear button, and a full seven-test `mixed` block plus the
shared contract harness. `tag-input.directive.spec.ts` (230 lines) covers Enter/separator/blur
commit, duplicate and empty rejection, `maxTags`, Backspace-removes-last, chip removal, paste
splitting, disabled, and six `mixed` cases plus the contract.

**Gaps with real logic behind them.**
- `phone-input-field.directive.ts` — the `effect` at `:36-54` is the source of the top High
  finding and has no test that feeds the field more than one `input` event. Every existing
  "typing" test is a single whole-string `setInputValue`.
- `otp-input.directive.spec.ts` (115 lines) never touches `readonly`, `disabled`, `length`
  changing after mount, `handleNativeSelectionEvent` (the caret pin), the `describedBy`/label
  wiring, or a global-flag RegExp charset. Its `charset` case (`:97`) uses `/[a-f]/` — no flags —
  which is exactly why the `g` bug survived.
- `phone-input-flag.directive.ts` — zero tests. The `etPhoneInputFlag` projection is documented
  public API (`text-inputs.md:455-465`) with two render sites
  (`phone-input.component.html:19-23, 38-42`) and neither is asserted.
- `phone-input.component.ts` — `countries()` ordering (`preferredCountries` on top, the rest
  locale-sorted), the "+49 finds Germany" search label (`:36` of the template) and the
  no-results row are all untested; so is `handleCountryChange`'s focus hand-off (`:117-124`).
- `tag-input-field.directive.ts` — `handlePaste`'s early returns (`:126,135`), the regex-escaping
  of separator characters (`:131`), and the `readOnly` interaction with `isFull()` (`:19`) have
  no tests.
- `forms/testing/*` — the drivers themselves have no tests (fine, they are test infrastructure),
  but note there is **no barrel** for `forms/testing/` (no `index.ts`), so every consumer
  deep-imports by path; and `mixed-state-contract.ts` relies on ambient `describe`/`it`/`expect`
  (works because `vite.config.mts` sets `globals: true`, but it would break in a
  `globals: false` consumer).

**No existing spec asserts a wrong behavior.** The closest call is
`otp-input.directive.spec.ts:64-79` ("emits completed exactly once per completion"), which
correctly encodes the "different full-length code re-emits" rule and is *narrower* than the docs
sentence at `text-inputs.md:373` — the docs are wrong, not the spec. Likewise
`phone-input.directive.spec.ts:99` is honestly named "**pasted** international number", so it
does not claim the typing path works; it just leaves it uncovered.

### Improvements

#### Features (ranked)

- **Give the phone input a real per-country format, behind an opt-in input.** The grouping is
  hard-coded threes (`phone-input.directive.ts:117-121`) and explicitly disclaims
  metadata-driven formatting. Material/PrimeNG both punt to `libphonenumber`, but a middle path
  fits the "zero dependencies" stance: add an optional `format` input taking a
  `(national: string, iso2: string) => string` so an app that already ships
  `libphonenumber-js` can plug it in without the SDK bundling anything.
- **Add a `separator`/`allowedChars` display mode and a `groupSize` to the OTP input.** Peers
  ship a `3-3` or `3-4` grouping (shadcn `InputOTPSeparator`, PrimeNG `integerOnly` + slots).
  `segmentIndexes` (`otp-input.component.ts:58`) and the flat `.et-otp-input-segments` row make
  a `[groupSize]="3"` that inserts a gap/dash purely presentational — no value change.
- **Give the tag input keyboard-reachable chips.** A roving-tabindex over the chips (arrow keys
  to move, Delete/Backspace to remove, the pattern `ChipDirective` already implements at
  `chip/headless/chip.directive.ts:10-11`) would fix the dead end in the Medium section and
  bring it level with Material's `mat-chip-grid`.
- **`autoTag`/`clear-all` for the tag input.** A clear-all suffix would also let it satisfy the
  mixed-state contract's clause 4 (`mixed-state-contract.ts:16`) instead of opting out
  (`tag-input.directive.spec.ts:227`), and would make its `mixed` story symmetrical with the
  phone input's.
- **`et-phone-input`: expose the validity signal the docs already advertise.** `isPlausible`
  (`phone-input.directive.ts:124-128`) is public and mentioned in prose (`text-inputs.md:453`)
  but there is no schema-side helper. A `phoneLengthWindow()` validator factory in the domain
  would stop every consumer re-deriving it.

#### DX (ranked)

- **Make these three extend `TextFieldControlDirective` (or a sibling base) instead of
  hand-rolling `FormValueControl`.** That single change removes the missing `hidden`, `warnings`,
  `aria-label`/`aria-labelledby`, `hasCustomAccessibleName`, `maxLength` and `pending` in one
  go — every one of those Medium/High findings is a symptom of the copy divergence the base
  directive's own JSDoc says it exists to prevent
  (`form-field/headless/text-field-control.directive.ts:8-18`). The OTP needs a variant that is
  not text-shell-hosted, but the input surface is the same.
- **`separators: string[]` conflates two kinds of thing.** `tag-input.directive.ts:62` splits the
  array by length at runtime into `characterSeparators` / `keySeparators` (`:100-102`), so
  `['Enter', ',']` mixes a `KeyboardEvent.key` with a character and `separators: ['Tab']` looks
  identical to `separators: [',']` in a template. A discriminated shape
  (`{ keys?: string[]; chars?: string[] }`) or two inputs would make the intent readable and let
  the type system reject `'Ent'`.
- **`maxTags` (refuses) vs `maxLength` (reports) is a genuinely confusing pair.**
  `tag-input.directive.ts:40-46` documents it well and `text-inputs.md:413` explains it, but the
  names give no clue. Consider `maxTags` → `tagLimit` with a `limitBehavior: 'refuse' | 'report'`,
  or at minimum a dev-mode warning when both are set to different numbers.
- **The `FIELD_OUTSIDE_*` guards are dev-only `afterNextRender` throws with no positive
  counterpart.** `tag-input-field.directive.ts:36-46` and
  `phone-input-field.directive.ts:56-66` catch the misplacement, but there is no guard for the
  much more likely mistake of *two* field directives inside one control —
  `registerSingleton` (`form-field/headless/register-singleton.ts`) presumably handles it;
  worth confirming the error names the domain.
- **Add a `forms/testing/index.ts` barrel.** Seventeen drivers with no barrel means every spec
  deep-imports `../../testing/<name>-driver`, and there is no single place to see what test
  infrastructure exists. Also missing from the drivers: `tag-input-driver.ts` has no
  `chipRemoveButtons()`/`isFull()` accessor and `otp-input-driver.ts` no way to read
  `complete` emissions, so specs re-derive both.

#### Bundle size

- **`otp-input.component.css` (262 lines) is the split candidate here, not `form-field`'s
  sibling.** Roughly 100 of those lines (`:166-260`) are the support-stack + animation block,
  which only a field that actually shows an error/warning/hint needs, and `@keyframes` +
  six `@property` registrations sit unconditionally at the top. Following the
  `TableVirtualScrollStylesComponent` pattern from `AGENTS.md`, an
  `OtpInputSupportStylesComponent` mounted from `formSupportFactory`'s
  `shouldRenderSupport()` effect would keep the animation CSS out of documents that never show
  one. Note the same block is duplicated near-verbatim across `rating`, `slider`, `dropzone`,
  `radio-group`, `checkbox-group`, `segmented-button-group` and `choice-field` — a single shared
  `FormSupportStylesComponent` with `--et-form-support-*` tokens would delete ~7 copies of it.
- **`PHONE_COUNTRIES` is 220 object literals (`phone-countries.ts:13-221`) that survive
  tree-shaking** because `phone-input.component.ts:86` maps over the whole array. A packed
  string (`'us:1,ca:1,ru:7,…'` parsed lazily inside `countries()`) is a few hundred bytes gzipped
  instead of a few kB, and would also let the parse happen only on first panel open — where
  today the array literal is evaluated at module load.
- **The country panel's `Intl.DisplayNames` churn** (see Low) is the CPU twin of the above:
  ~220 constructor calls per panel open, hoistable to one.
- **`phone-input.component.ts:26` spreads all 20 entries of `SELECT_IMPORTS`** (`select/select.imports.ts:24-45`)
  to use six of them: `etSelect`, `etSelectTrigger`, `etSelectSurface`, `et-select-panel`,
  `et-select-option`, `etSelectSearch`. That drags `SelectComponent`,
  `SelectVirtualOptionComponent`, the viewport/virtual-option directives and the
  loading/error/empty slots into every app that imports the phone input but never uses
  `et-select` itself. Naming the six would be a one-line change — worth measuring against
  `tools/treeshake` goldens.

#### UI/UX

- **The OTP caret cannot be moved, by design, and that surprises people.**
  `handleNativeSelectionEvent` (`otp-input.directive.ts:167-180`) pins selection to the end on
  every keyup/mouseup, so clicking segment 2 of a filled code jumps to the end and the only edit
  is delete-from-the-end. shadcn's `InputOTP` and PrimeNG's per-slot inputs both let you land on
  a slot. If per-slot editing is off the table, at least suppress the jump for a pure
  arrow-key/Home/End press so the caret does not fight the user silently.
- **The phone input's clear button only exists while the tel field itself has focus**
  (`phone-input.component.ts:79-81`), so a pointer user who moves the mouse toward the `×` after
  tabbing to the country trigger watches it vanish. The date-time inputs use the same rule, so
  this is consistent — but consider keeping it while focus is anywhere inside the control.
- **Nothing announces a tag being added or removed.** `tag-input.component.html:1-16` renders
  chips into a bare `div` with no `role="list"`, no `aria-live`, and no count in the input's
  `aria-describedby`. A screen-reader user types `alpha`+Enter and hears nothing at all.
- **`et-otp-input` has no `data-readonly` styling** beyond `cursor: default`
  (`otp-input.component.css:145`), so a readonly code looks identical to an editable one — while
  `:disabled` gets `opacity: 0.4` (`:158`). Pick a middle treatment.
- **The OTP caret blink is `steps(2, jump-none)` at 1.1s** (`:119`) — a hard 50% duty-cycle
  flash. It is correctly disabled under `prefers-reduced-motion` (`:257-259`), but an
  `ease-in-out` opacity ramp reads calmer and matches the segment-char pop
  (`:241-249`) already in the same sheet.

#### Testing (ranked, first-pass order)

1. **A character-by-character typing driver.** `driver-core.ts:69-72`'s `typeInField` sets the
   whole value in one event, which is why the phone-input High is invisible to the suite. Add a
   `typeChars(field, text)` that dispatches one `input` per character and re-run the existing
   phone tests through it — that is the single highest-value addition in this batch.
2. **`aria-describedby` resolution as a shared assertion.** A
   `expectDescribedByResolves(driver)` helper in `field-control-driver.ts` asserting
   `getElementById(field.getAttribute('aria-describedby'))` is non-null would have caught the
   OTP bug and the same latent bug in rating/slider/dropzone/radio-group in one pass.
3. **`valueChange` emission counting in the field-control driver.** The tag-input spurious-emit
   bug needs it; so would any future no-op-write regression in every other control. Cheap:
   record emissions in `mountControl`'s host wiring.
4. **OTP: `length` changing after mount, `readonly`/`disabled` interaction, a flagged RegExp
   charset, and a programmatic full value vs `complete`.** Four small tests, four of this
   batch's Mediums.
5. **`etPhoneInputFlag` projection** — assert the template renders in both the trigger and the
   option list, with the `{ iso2, dialCode, flag }` context the docs promise.
6. **Tighten `describeMixedStateContract`** so the clear case cannot pass vacuously, and add
   assertions for the two clauses its own doc comment claims (`mixed-state-contract.ts:17-20`).

Clean: `phone-countries.ts`'s longest-prefix matcher and trunk-zero table (both spec-covered and
correct, including the equal-length tie going to the primary country); the `mixed` semantics of
all three domains, which are consistent, well documented, and pinned by both per-control specs
and the shared contract; the `@layer components` wrap and the surface/colour-token discipline in
all three stylesheets (no hardcoded primary colours, no Tailwind in component source — the
`color-mix(in srgb, currentColor …)` placeholders are derived, not hardcoded); the `@property`
registrations, which match the repo-wide `inherits: true` convention; the OTP's `[data-error]`
segment border, which correctly picks up the forced error theme because
`formSupportFactory` calls `provideColor.forceColor(errorColorTheme)` on the host
(`form-field/headless/form-support.ts:157-171`) and `OtpInputComponent` declares
`ProvideColorDirective` in `hostDirectives`; `FormFieldBarrierDirective` doing its job — the
nested country `etSelect` does not hijack the outer field's control registration; the
`registerSingleton` + `afterNextRender` dev guards; `tag-input`'s and `phone-input`'s presence in
the `usesTextFieldShell` allowlist (`form-field/headless/form-field.directive.ts:146-147`), so
neither hits the label-squeeze trap; signals-only state throughout (no `Subject`, no
subscribe-and-assign, no leaked listeners — every host binding is declarative and the only
`DestroyRef` use is the form-field unregister); and no XSS sink, no SSR-hostile global access,
and no module-level mutable latch anywhere in the four directories.

---

## query-error, filter-overlay, floating-action, testing, internals, version.ts

### High

- **`filterOverlayPreviewFromQuery`'s submit button gets permanently stuck on "Loading results…" (disabled) when a consumer uses the documented "skip counting" escape hatch.** `libs/components/src/lib/filter-overlay/filter-overlay-preview.ts:36` documents `args` as: "Return `null` to skip the request - for a draft that is not yet worth counting." When `args` returns `null`, `@ethlete/query`'s `withArgs` feature parks the query and never executes it (confirmed against `libs/query/src/lib/http/query-features.spec.ts:426` - "parks the query while withArgs returns null" - no HTTP request ever fires). That leaves `query.loading()` at its non-loading rest value and `query.response()` at `null` forever, so `totalHits` stays `null` and `loading` stays `false` forever (`filter-overlay-preview.ts:66-69`). `resolveFilterOverlaySubmitButton` (`libs/components/src/lib/filter-overlay/filter-overlay-labels.ts:93-94`) treats `totalHits === null` as "No count yet, and nothing in flight - the first request has not started" and always returns `{ label: labels.loading, disabled: true }` - there is no other branch that distinguishes "a request just hasn't started yet" from "this draft was deliberately never going to be counted." A consumer who follows the documented pattern (e.g. skip counting until a search box has ≥3 characters) ends up with a submit button frozen on "Loading results…" and permanently unpressable, even though nothing is loading and the draft is otherwise perfectly submittable. **Runtime-verified**: wrote a scratch spec creating a real query via `createQueryCreator` + `filterOverlayPreviewFromQuery({ args: () => null })`, ticked the injector, and asserted the resulting state. Observed: `{ totalHits: null, loading: false, hasError: false, hasPreview: true, maxCountedHits: 250 }` resolving to `{ label: 'Loading results…', disabled: true }` - confirming the stuck state exactly as analyzed. Scratch file was deleted after the run; working tree is clean.

### Medium

- **A JSDoc comment references a component that does not exist, and could mislead a consumer trying to use it.** `libs/components/src/lib/filter-overlay/headless/filter-overlay-controls.directive.ts:48` says of `FilterOverlaySubmitDirective.label`: "Rendered by `<et-filter-overlay-submit-label>`, or read it yourself." No such component exists anywhere in `libs/components` (`grep -rn "et-filter-overlay-submit-label"` finds only this one comment). The real, documented pattern (both in `apps/docs/components/filter-overlay.md:38` and the story file) is `#submit="etFilterOverlaySubmit"` + `{{ submit.label() }}` - there never was a default-rendering label component. A consumer who trusts the comment and searches for `et-filter-overlay-submit-label` will not find it. This is also a comment-policy violation on its own (states something false, not merely undocumented) independent of the missing feature.

### Low

- **Comment-policy: the same file's "or read it yourself" phrasing is otherwise fine, but the dangling reference above should just be deleted** - `filter-overlay-controls.directive.ts:48`. Once the nonexistent component name is removed there is nothing else wrong with the comment.
- **`legacyQueryErrorSource`'s internal `retry` always calls the underlying query's `execute` with `{ skipCache: true }`** (`libs/components/src/lib/query-error/query-error-legacy.ts:66-69`), which is correct for a legacy client query but would silently do nothing if `config.query` ever pointed at a current-client (`AnyV2Query`) query instead, since the current client spells cache-bypass `{ options: { allowCache: false } }` (as `QueryErrorDirective.retry()` does at `libs/components/src/lib/query-error/headless/query-error.directive.ts:123`). The adapter's own types (`AnyV2Query | AnyLegacyQuery | AnyQueryCollection`) allow a V2 query to be passed in, so this is a latent trap if `legacyQueryErrorSource` is ever pointed at a non-legacy query - not a bug today since the adapter is documented and used exclusively for legacy sources, but worth a one-line guard or narrower type if it recurs.

### Spec coverage

- **`query-error`**: well covered. `query-error.component.spec.ts` exercises rendering (no error, title/message, violation list, message-echoes-title suppression, empty-body fallback), the banner/`role="alert"` wiring, color override, retry gating by policy, `alwaysAllowRetry`, locale defaulting and `provideQueryErrorLabels(queryErrorLabelsForLocale)`, and `queryErrorResponseFromLegacyError`'s classification. Not covered: the dev-mode `assertInsideQueryError` guard in `query-error-slots.directive.ts` (throwing when a slot is used outside `[etQueryError]`), and `legacyQueryErrorSource`'s `retry()`/`retryTarget.execute` wiring itself (only the pure conversion function is tested, not the returned object's behavior).
- **`filter-overlay`**: the core service (`provideFilterOverlay`/`createFilterOverlay`) is well covered in `filter-overlay.spec.ts` - draft isolation, `hasChanges`, submit writing through `setValue` (reset graph fires), `reset()`, `activeFilterCount` vs `isPristine`, and the submit-button resolver's every branch. **Zero coverage** for: `discard()` (never called in any spec), the interaction with a real `OverlayRef` (`close()` is never exercised - tests call `factory()` directly, bypassing `OVERLAY_REF` entirely, so `submit`/`discard`'s `overlayRef?.close(result)` call is unverified end-to-end), `FilterOverlaySubmitDirective` and `FilterOverlayResetDirective` themselves (no directive-level spec - `[disabled]` binding, `(click)` handler, and the `assertInsideFilterOverlay` dev-mode guard are all untested), and `filterOverlayPreviewFromQuery` (the query-backed preview factory has no spec at all; the High finding above was only caught by ad hoc runtime verification, not by an existing test).
- **`floating-action`**: **no spec file exists for this domain at all** (`find libs/components/src/lib/floating-action -name "*.spec.ts"` returns nothing). This is real, non-trivial logic - a three-state machine (`inline`/`floating`/`hidden`) combining two intersection observers, a `disabled` override, the anchor/scope/top registration handshake between four cooperating directives, and the dev-mode `MISSING_ANCHOR` / `PART_OUTSIDE_FLOATING_ACTION` guards - with zero automated coverage. Everything here is presently verified only by the Storybook stories.
- **`testing`**: this directory is test infrastructure, not something that itself needs specs; it is exercised indirectly by ~173 files across the components lib that import from it (`control-driver`, `field-control-driver`, `overlay-control-driver`, `driver-core`, `color-themes`). No gap here.
- **`internals`**: `dom-order.ts` (`sortByDomOrder`) has **no dedicated spec** despite being relied on by `select`, `masonry`, and `menu` for correctness-critical DOM-order sorting of projected items - only exercised incidentally through those consumers' own specs. `typeahead.ts` (`createTypeahead`) also has **no dedicated spec** despite being shared by five consumers (`tree`, `cascader`, `select`, `time-picker`, `menu`) - the reset-delay timer behavior, buffer accumulation, and `destroy()`/`reset()` semantics are only ever exercised indirectly through each consumer's own tests. `pointer-gesture-target.ts` and `virtual-window.ts` are both well covered by their own spec files.

Clean: read every non-spec source file in `query-error/`, `filter-overlay/`, `floating-action/`, `testing/`, `internals/`, and `libs/components/src/lib/version.ts`, plus their spec files and the three matching docs pages (`query-error.md`, `filter-overlay.md`, `floating-action.md`). Verified: all component CSS in scope (`query-error.component.css`, `floating-action-styles.component.css`) is wrapped in `@layer components { … }`; no hardcoded colors as primary values (floating-action's CSS only sets geometry/timing custom properties, no colors at all); no Tailwind in any in-scope component source (only present, correctly, in story files); signals used for all in-scope synchronous state, with the one RxJS subscription in scope (`virtual-window.ts`'s scroll listener) correctly piped through `takeUntilDestroyed()` last; `createTypeahead()` is correctly wired to `DestroyRef.onDestroy` in every one of its five consumers, so its internal `timer()` subscription cannot outlive its host. `FLOATING_ACTION_IMPORTS` / `FILTER_OVERLAY_IMPORTS` / `QUERY_ERROR_IMPORTS` barrels match their directories' actual exported directives/components. Docs pages (`query-error.md`, `filter-overlay.md`, `floating-action.md`) accurately describe current behavior, options, and defaults, and their `<StoryEmbed>` ids all resolve to real, matching story titles/exports. `version.ts` is a trivial generated re-export, correctly wired into the public `index.ts`, with no logic to break.

### Improvements

- **Features**: `floating-action` has no way to float on one edge and dock on another as viewport size changes (e.g. bottom-center on mobile, bottom-right on desktop) - peer libraries (e.g. Material's FAB patterns) typically let the anchor position vary per breakpoint via CSS alone, but here the *side* (`inset-inline-end`) is fixed by a single custom property, not responsive without a consumer overriding it via media queries themselves. A documented "how to change side per breakpoint" recipe (or a `side` input) would remove guesswork.
- **Features**: `filter-overlay` has no built-in "N filters active, tap to clear one" affordance beyond the raw `activeFilterCount` - peer filter-panel patterns (Ark UI, shadcn combobox-filter examples) commonly ship a small chip list of active filter values with per-chip removal. Given `activeFilterCount` and `draft.resetFieldToDefault` already exist, a thin `FilterOverlayActiveFilters` headless helper enumerating `{ key, label, clear() }` per non-default field would be a natural, low-risk addition building only on existing primitives.
- **DX**: `filterOverlayPreviewFromQuery`'s `args: () => null` skip semantics interact badly with the submit-button resolver (see the High finding) - fixing the resolver to distinguish "genuinely first-request-pending" from "this preview was configured to skip" (e.g. by having the preview itself expose an explicit `skipped` signal, or having `resolveFilterOverlaySubmitButton` treat `!loading && !hasError && totalHits === null` as "apply enabled" rather than "still loading") would remove a real footgun for exactly the use case (deferred/conditional counting) the API's own JSDoc recommends.
- **DX**: `FloatingActionDirective`'s dev-mode guard only checks for a missing anchor (`MISSING_ANCHOR`), not a missing trigger - if a consumer wires up `[etFloatingAction]` and `[etFloatingActionAnchor]` but forgets `[etFloatingActionTrigger]` inside it, nothing throws and `scrollToTop()` silently falls back to the floating-action element itself with no signal that the trigger registration never happened. A `MISSING_TRIGGER` guard mirroring `MISSING_ANCHOR` (`floating-action.directive.ts:109-120`) would close that gap cheaply.
- **Testing**: `floating-action` should get a first spec pass before anything else in this batch - it currently has zero automated coverage of a genuinely nontrivial derived-state machine. Priority order: (1) `state()`'s three-way branching against mocked `anchor`/`scope` intersection signals (inline/floating/hidden transitions, including the "below the fold" vs "scrolled above" distinction the docs call out), (2) `disabled` forcing `inline` regardless of intersection state, (3) `scrollToTop()` targeting `[etFloatingActionTop]` vs falling back to the host element, (4) the `MISSING_ANCHOR` / `PART_OUTSIDE_FLOATING_ACTION` dev-mode guards actually throwing `RuntimeError` with the right code.
- **Testing**: `filter-overlay` should add: a directive-level spec for `FilterOverlaySubmitDirective`/`FilterOverlayResetDirective` mounted against a real `FILTER_OVERLAY_TOKEN` provider (not just the bare service factory) to cover the `[disabled]` binding and `(click)` wiring end-to-end; a spec exercising `discard()` and `submit()` against a real `OverlayRef` fake to confirm `close({ didUpdate, value })` is actually called with the right payload (today `close` is entirely unverified); and a spec for `filterOverlayPreviewFromQuery` itself (loading/error/totalHits derivation, the `toTotalHits` override, the `console.error` dev-mode warning when a response has no `totalHits`), which currently has no test at all.
- **Testing**: `internals/dom-order.ts` and `internals/typeahead.ts` both deserve dedicated unit specs given how widely shared they are (dom-order: `select`, `masonry`, `menu`; typeahead: `tree`, `cascader`, `select`, `time-picker`, `menu`) - a bug in either would silently misbehave across five-plus components at once, and today a regression could only be caught by whichever consumer's own spec happens to exercise the affected edge case.

---

## button, chip, badge, avatar, banner, card, divider

Scope reviewed: every non-spec source file (`.ts`/`.html`/`.css`) and spec file under
`libs/components/src/lib/{button,chip,badge,avatar,banner,card,divider}/`, plus
`apps/docs/components/{button,chip,badge,avatar,banner,card,divider}.md`.

### High

- **The chip domain's own documented "quick start" snippet has no keyboard path to removal.**
  `apps/docs/components/chip.md:10` shows `<et-chip (remove)="removeTag('Design')" removable>Design</et-chip>`
  as the introductory example, with no ancestor widget and no `tabindex`. `ChipDirective`
  (`libs/components/src/lib/chip/headless/chip.directive.ts:1-35`) never sets a `tabindex` on the
  chip host, and `ChipRemoveDirective` hardcodes `tabindex: '-1'` on its own host
  (`libs/components/src/lib/chip/headless/chip-remove.directive.ts:14`) with the comment "chips are
  never tab stops." The doc's own Accessibility section acknowledges this ("standalone chips are
  removed via pointer or via Backspace/Delete while the chip element has (programmatic) focus") but
  the quick-start snippet provides no such programmatic focus source. For a keyboard-only user, this
  exact documented markup is unremovable: nothing in it is ever `Tab`-reachable, so `Backspace`/`Delete`
  (which only fire while the chip itself is `document.activeElement`) can never trigger, and the visible
  "×" button is reachable only by pointer.
  **Runtime-verified**: wrote a scratch spec (`libs/components/src/lib/chip/__scan-verify.spec.ts`,
  deleted after the run) rendering the exact docs snippet and ran it with
  `NX_NO_CLOUD=true npx vitest run --root libs/components --config libs/components/vite.config.mts <path>`.
  All 5 assertions passed: the chip host carries no `tabindex` attribute, `chip.focus()` does not move
  `document.activeElement` to it, the remove button's `tabindex` is `-1`, and after `document.body.focus()`
  neither the chip nor the remove button is the active element - i.e. there is no element in this markup
  a `Tab` key press can ever land on. Either the quick-start example needs a caveat/an explicit
  `tabindex="0"` plus its own keydown wiring, or the chip should default to `tabindex="0"` when
  `removable` and not composed into a selection list/tag input that already manages focus.

### Medium

- **`SplitButtonDirective` silently accepts a second `etSplitButtonAction` (or trigger), with no
  dev-mode error, and the second one clobbers the first with no way to recover it.**
  `SplitButtonActionDirective`'s constructor unconditionally does
  `this.splitButton?.registeredAction.set(this)` (`libs/components/src/lib/button/headless/split-button-action.directive.ts:19`),
  overwriting whatever was registered before with no check for an existing registration, and the
  `afterNextRender` dev-mode check in `SplitButtonDirective` (`split-button.directive.ts:21-41`) only
  throws when the count is **zero**, never when it is more than one. **Runtime-verified**: a scratch
  spec (`libs/components/src/lib/button/__scan-verify.spec.ts`, deleted after the run) rendered an
  `et-split-button` with two `etSplitButtonAction` buttons; `registeredAction()` silently resolved to
  the second one with no thrown error, and removing that second (now-registered) action set
  `registeredAction()` to `null` even though the first action button was still present in the DOM -
  the split button then behaves as if it has no action at all. A duplicate registration should either
  throw in dev mode (matching the "missing" check's rigor) or fall back to the remaining directive on
  unregister instead of going to `null`.

- **`FabComponent` omits `ColorInteractiveDirective`, unlike every other themed button flavor, so its
  outline/tonal/transparent ink color never reacts to hover/focus/active/disabled.**
  `fab.component.ts`'s `hostDirectives` (lines 56-67) list `ButtonDirective`, `ButtonStylesDirective`,
  `FocusRingDirective` and `ProvideColorDirective`, but not `ColorInteractiveDirective` - unlike
  `ButtonComponent` (`button.component.ts:89-101`), `IconButtonComponent`
  (`icon-button.component.ts:41-53`), `TextButtonComponent` (`text-button.component.ts:55-67`) and
  `WindowControlButtonComponent` (`window-control-button.component.ts:53-65`), which all include it.
  `--et-theme-color-ink-rgb`/`-ink-solid` (read by `fab.component.css` for the outline/tonal/transparent
  variants' `color`/border) is only re-resolved per interaction state by the CSS
  `ColorInteractiveDirective` mounts (`libs/core/src/lib/theming/color-interactive-styles.component.css:15-23,27-46,48-77,105-146`,
  keyed off `--et-color-primary-ink-hover/-focus/-active/-disabled`); without that directive on the
  host, the base `[class*="et-color--"]` alias block (`libs/core/generators/tailwind-4-color-theme/generator.ts:659-671`)
  only ever supplies the resting ink color, so FAB's ink never shifts the way button/icon-button/text-button/
  window-control-button's does. Chip deliberately opts out of the analogous mechanic with an explicit
  comment explaining why (`chip.component.css:91-93`: "a plain chip does not carry [etColorInteractive]");
  FAB has no such comment, which suggests an oversight rather than a documented decision.
  **Code-verified only** - the effect depends on an app registering distinct `-ink-hover`/`-ink-focus`/etc.
  theme tokens (the bundled Storybook theme happens to set them equal to the resting ink color for its
  brand/danger themes, so the gap would not show up there); reproducing it needs a real CSS engine with a
  theme that varies those tokens, which jsdom's cascade does not reliably model.

- **`window-control-button.component.css`'s "close" kind hardcodes red/white as primary values,
  against the repo's "never a hardcoded colour as the primary value" rule.**
  Lines 106-121 set `background: rgba(232, 17, 35, 0.92)` / `color: #ffffff` (and a darker red for
  `:active`) directly on `background`/`color` for `:focus-visible`/`:hover`/`:active` - not inside a
  `var(--token, <fallback>)` fallback slot (unlike every other hardcoded value in this same file, e.g.
  `--_et-window-control-button-fallback-color: rgba(255, 255, 255, 0.92)` at line 17, which is only ever
  used as a `var()` fallback and is therefore permitted). This may be a deliberate "OS titlebar close
  button is always red" convention, but as written it is unthemeable and uncommented, so a future
  reviewer has no way to tell a deliberate exception from a plain violation. Either theme it through
  `injectErrorTheme()`-style tokens or add the workaround comment the repo's comment policy requires
  for a deliberate deviation.

### Low

- **`apps/docs/components/chip.md` contradicts itself on where a chip's color comes from.** The
  "Filter chips" section says the selected state is "a color-theme tonal fill" (line 42, matching
  `chip.component.css:94-103`'s use of `--et-theme-color-primary-solid`/`--et-theme-color-ink-solid`),
  but the later "Theming" section flatly states "Colors come from the app-registered surface theme...
  there is nothing color-related to override per chip" (`chip.md:82`), which is only true for the
  unselected/non-filter chip. A reader who only reads "Theming" would not learn that a selected filter
  chip's fill is themeable via `[etProvideColor]`.

- **`FabComponent` and `IconButtonComponent` each redeclare an identical local type alias
  (`FabVariant`, `IconButtonVariant`) that is structurally the same as the already-exported
  `ButtonVariant`** (`fab.component.ts:17`, `icon-button.component.ts:9`, vs.
  `button.component.ts:33`). Harmless, but three names for one type invites drift if a variant is
  ever added to one and not the others.

- **`avatar.component.css`'s `.et-avatar-image` rule sits outside the `.et-avatar { … }` block**
  (`avatar.component.css:65-70`), unlike every sibling component in this batch (button, badge, chip,
  card all nest every descendant selector inside their root class block). Low risk given the specific
  class name, but it is an unscoped global selector where the rest of the codebase's convention is to
  nest, and it's easy to accidentally widen later.

### Spec coverage

Well covered: `ButtonDirective` (headless) - type/disabled/loading/pressed/anchor-vs-button behavior,
including the loading-blocks-click and stays-focusable cases. `ButtonComponent`, `FabComponent`,
`IconButtonComponent`, `TextButtonComponent`, `WindowControlButtonComponent` - all input reflection to
`data-*` attributes and the loading spinner. `SplitButtonComponent` - rendering, segment registration/
unregistration, and both dev-mode "missing" error codes. `BadgeComponent`, `AvatarComponent`,
`CardComponent`, `DividerComponent` - inputs, defaults, and color/surface forwarding.
`BannerComponent` - exceptionally thorough: heading/description rendering, projected-slot ordering,
role-per-type, `liveRegion` override, color forcing per type (including the "no throw for info without
themes registered" case), and dismiss.

Gaps:

- **`ChipComponent` itself has zero tests.** There is no `chip.component.spec.ts` at all; only the
  headless `ChipDirective`/`ChipRemoveDirective` pair is tested, via a hand-rolled `<span etChip>`
  host template (`headless/chip.directive.spec.ts`) rather than the real `<et-chip>`. The actual
  component - its template's `@if (chip.removable())` gating of the remove button, the projected
  `et-times` icon, the `et-chip`/`et-chip-label` classes - is never rendered in a test.
- **`ButtonColorDirective` has no test coverage anywhere.** No spec (button, fab, icon-button, text-
  button, window-control-button) asserts on `color`, `pressedColor`, or the `pressed && pressedColor
  !== undefined` branch that picks which color forces onto `ProvideColorDirective`; contrast this with
  badge/avatar/card, which each have an explicit "forwards color to the color provider" test.
- **`AvatarGroupComponent`'s entire reason to exist is untested.** Its spec has exactly one test
  ("renders the projected avatars"). `maxVisible`, the `+N` overflow avatar's existence and count,
  hiding avatars past the limit, and the overflow avatar copying the first projected avatar's
  `size`/`shape` are all completely unexercised.
- **`SplitButtonActionDirective`/`SplitButtonTriggerDirective` have no dedicated spec** and are only
  exercised indirectly (one of each) through `SplitButtonComponent`'s spec - which is how the Medium
  double-registration finding above went unnoticed.
- **`ChipRemoveDirective`'s "outside `[etChip]`" dev-mode error (`ET1100`) is never tested**, unlike
  the structurally identical split-button checks, which cover both directives' "outside" cases.

Clean: `ButtonDirective`/`ButtonColorDirective`'s core state machine, all six button-flavor components'
`data-*` reflection and disabled/loading semantics, `DividerComponent`, `CardComponent`, `BadgeComponent`
and `AvatarComponent`'s public APIs, and `BannerComponent`'s theming/role logic are all sound and match
their docs. No Tailwind classes, hardcoded primary colors (other than the one Medium finding above), or
unlayered CSS were found outside story files. All `index.ts`/`*.imports.ts` barrels are complete with no
dead exports. The canonical `&:where([data-size='…'])`/`&:where([disabled])` pattern from
`button/*.component.css` is followed consistently across chip, badge, avatar, banner, card and divider.

### Improvements

**Features**

- **A corner-anchored "dot"/overlay badge mode.** `et-badge` today is only an inline pill; Material's
  `MatBadge`, PrimeNG's `Badge`/`OverlayBadge` and Ant Design's `Badge` all also support anchoring a
  small indicator (with or without a count) to the corner of an arbitrary host element (an icon button
  with an unread count, an avatar with an online dot). That's a natural, high-value extension of the
  existing `BadgeComponent` variant/size system rather than a new component.
- **A labeled divider.** `et-divider` has no way to render text in the middle of the rule (the "OR" in
  an auth form, a labeled section break) - a common pattern in Ant Design's `Divider`. Given
  `DividerComponent`'s template is currently just `` (`divider.component.ts:24`), this would need
  content projection support, which the current attribute-selector-free component doesn't have room
  for yet.
- **Card sub-slots.** `et-card` is deliberately just padding/gap/chrome around `<ng-content>`
  (`card.component.ts:24`) - fine for the common case, but there's no `CardHeaderComponent`/
  `CardMediaComponent` for the "edge-to-edge image, breaks out of the padding" layout every dashboard
  card library (Material, PrimeNG) ships as a first-class piece.

**DX**

- **`SplitButtonActionDirective`/`SplitButtonTriggerDirective` should reject a second registration in
  dev mode**, matching the rigor of the existing "missing" check (see Medium finding above) - right now
  a duplicate silently wins or silently zeroes out the group depending on which one gets removed.
- **Collapse `ButtonVariant`/`FabVariant`/`IconButtonVariant` into one exported type.** Three files
  independently declare the same `(typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS]` alias
  (see Low finding); importing `ButtonVariant` from `button.component` everywhere would remove the
  drift risk for free.

**Bundle size**

- **The per-variant hover/focus/active opacity ramps are hand-duplicated across `button.component.css`,
  `fab.component.css` and `icon-button.component.css`** (each repeats the same filled/outline/tonal/
  transparent `--et-theme-color-primary-opacity` escalation at 0/0.08/0.12/0.16, 0.16/0.24/0.28/0.32,
  etc., just with different selector shells). Every consumer that imports any one button flavor ships
  its own copy of this ramp. Given `AGENTS.md`'s guidance on splitting a large stylesheet, this looks
  like a candidate for a shared token recipe (e.g. a `--et-button-variant-opacity-*` set computed once)
  rather than three parallel hand-written copies - lower risk of the three drifting apart, too.

**UI/UX**

- **Fix the chip keyboard-reachability gap** (High finding above) - today the only two documented paths
  to make a removable chip keyboard-operable are outside the chip domain entirely (a selection list or a
  future tag input). A standalone chip should have a supported, documented way to be keyboard-removable
  on its own.
- **`AvatarComponent`'s alt-text fallback is silently empty when `name` is unset and `src` is set**
  (`avatar.component.ts:46`, `[alt]="name() ?? ''"`) - documented as deliberate, but it would be easy for
  a consumer to trip over an avatar that looks like a real photo to a sighted user and announces nothing
  at all to a screen reader. Consider a dev-mode warning when `src` is set without `name` and no
  `aria-label` on the host, the way other components in this batch throw/warn on missing structural
  pieces.

**Testing**

- **Add a `chip.component.spec.ts`** rendering the real `<et-chip>` (remove-button gating on
  `removable`, the `et-times` icon, disabled/removable data attributes on the actual component, not a
  synthetic host) - see Spec coverage gaps above; this is the most consumer-visible piece of the domain
  with the least direct coverage.
- **Add `maxVisible`/overflow coverage to `avatar-group.component.spec.ts`**: the `+N` count, which
  avatars get `hidden`, and the overflow avatar's inherited `size`/`shape` are all currently unverified
  by any test.
- **Add a `button-color.directive.spec.ts`** (or extend one button flavor's spec) covering `color`,
  `pressedColor` left unset (falls back to `color`), `pressedColor="inherit"`, and the pressed/unpressed
  toggle - this directive's branching logic is exercised by zero tests today.

---
