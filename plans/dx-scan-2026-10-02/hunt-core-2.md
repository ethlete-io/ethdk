# hunt-core-2 — bug hunt 2026-10-10

Scope: `libs/core/src/lib` folders the first core hunt (`hunt-core.md`) did not cover: `overlay/` (runtime, positioning, layers, viewport insets, focus), `theming/`, `providers/` (breakpoint observer, focus-visible tracker, style manager), `signals/` (media queries, breakpoint input, countdown, deferred loading, control value, router), `signals/recipes/` (css-vars, scroll restoration), `app-update/`, `notifications/`, `utils/session-memory`. Checked against `core.md` (CORE-01..18, deleted in `79056e353`) and `hunt-overlay.md` (HO-01..05).

Also read and found clean: `overlay-layer`, `overlay-viewport-inset`, anchored positioning (`preferredSide`, uncapped first measurement, stale-update guard), backdrop and position-strategy updaters, `style-manager`, `focus-visible-tracker`, `breakpoint-observer`, `media-queries` / `memoizeSignal`, `provide-surface` / `provide-color` (the "ancestor `etProvideColor` wins" rule is documented on purpose), `auto-surface`, `app-updates` / `build-fingerprint`, `notifications`, `signalCountdown`, `signalDeferredLoading`, `controlValueSignal`, `session-memory`, `css-vars`, `root-font-size-check`.

| ID     | Sev    | Kind     | Decision | Title                                                                                                                             |
| ------ | ------ | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| HC2-01 | Medium | bug      | no       | The modal focus trap's tab-stop list disagrees with the browser, so Tab escapes the modal                                         |
| HC2-02 | Low    | bug      | no       | Scroll restoration reads the first route with the base href, so the initial navigation scrolls to the top                         |
| HC2-03 | Low    | dx       | no       | The breakpoint-transform warning stays silent when an ancestor calls `provideBreakpointInstance`                                  |
| HC2-04 | Low    | bug      | no       | Overlay focus restore picks a disabled or hidden opener and drops focus on `<body>`                                               |
| HC2-05 | Low    | bug      | yes      | `isTopMost` ranks overlays by open order, not by layer, so Escape and Tab go to an overlay painted below another one              |
| HC2-06 | Low    | bug      | no       | `afterOpened()` never emits or completes for an overlay closed before it opened                                                   |
| HC2-07 | Low    | test-gap | no       | No spec for the focus trap with disabled fieldsets or `<summary>`, scroll restoration under a base href, or close during mounting |

## HC2-01 The modal focus trap's tab-stop list disagrees with the browser, so Tab escapes the modal

- Status: fixed

- Where: `libs/core/src/lib/overlay/overlay-focus.ts:4-14` (`FOCUSABLE_SELECTOR`), `:48-54` (`isFocusable`), `:160-170` (wrap check in `setupFocusTrap`).
- Problem: the trap only steps in when focus is on what it thinks is the first or last tab stop. In every other case it leaves Tab to the browser. When the two lists disagree at either end, the browser moves focus out of the pane:
  - Missing from the selector although natively tabbable: `summary` (the `<details>` toggle), `audio[controls]`, `video[controls]`, `[contenteditable=""]` and `[contenteditable="plaintext-only"]`. Repro: a dialog whose last control is `<details><summary>More</summary>…</details>`. `lastElement` is the button before it. With focus on `<summary>`, Tab does not match `lastElement`, so the browser moves focus to the page behind the modal.
  - Kept although not focusable: a control inside `<fieldset disabled>` or inside an `inert` subtree. `isFocusable` only checks the element's own `disabled` attribute and `tabIndex` (`0` for these). Repro: a dialog whose footer buttons sit in `<fieldset [disabled]="saving()">`. `lastElement` is the disabled Save button. Tab from the real last enabled control does not match it, the browser skips the disabled buttons, and focus leaves the modal. Shift+Tab from the first control the other way round also calls `focus()` on the disabled button, which does nothing.
  - `getFocusableElements` is also used by `libs/components/src/lib/forms/form-field/headless/anchored-panel-controller.ts:111,125` (next tab stop after a panel trigger) and `focus-first-invalid-field.ts:78`, so they skip and pick the same wrong elements.
- Fix: add `summary`, `audio[controls]`, `video[controls]` and `[contenteditable]:not([contenteditable="false"])` to the selector (a `summary` only when it is the first `summary` child of a `details`), and in `isFocusable` reject `element.matches(':disabled')` and `element.closest('[inert]')`. Add specs for both repros.
- Breaking: no. Decision: no.

## HC2-02 Scroll restoration reads the first route with the base href, so the initial navigation scrolls to the top

- Status: fixed

- Where: `libs/core/src/lib/signals/router.ts:154-161` (`createRoute`), used by `libs/core/src/lib/signals/recipes/scroll-restoration.ts:254-258` and `:403-417,474-488`.
- Problem: before the first navigation `createRoute` uses `window.location.pathname`, which includes the base href. `08a1f7884` fixed this for `injectUrl` (now `Location.path(true)`), but `createRoute` still has it. With `<base href="/app/">` and a deep link to `/app/news#comments`, `prev.route` is `/app/news` and the first `NavigationEnd` gives `curr.route` `/news`. `sameUrlNavigation` is false, so the `else` branch sets `scrollTop = 0` instead of taking the fragment branch (`config.fragment.enabled`) or doing nothing. The anchor jump of a deep link is lost, and a `queryParamTriggerList` comparison on the first navigation goes the wrong way. Without a base href both strings match and nothing happens, so this only shows on sub-path deployments.
- Fix: in `createRoute`, use `inject(Location).path(true)` like `createInitialRoute` (pass `Location` in, or have the caller resolve it), or seed `prev.route` from `createInitialRoute()`. Add a scenario next to `router-initial-url.scenario.spec.ts` with a base href and a fragment.
- Breaking: no. Decision: no.

## HC2-03 The breakpoint-transform warning stays silent when an ancestor calls `provideBreakpointInstance`

- Status: fixed

- Where: `libs/core/src/lib/signals/breakpoint-input.ts` (`breakpointTransformBase`, the `effect`: `injector.get(BREAKPOINT_INSTANCE_TOKEN, null)`).
- Problem: the token lookup is not limited to the component itself. `provideBreakpointInstance` goes into `providers`, which view and content children can see. A child component that uses `boolBreakpointTransform()` but forgot `provideBreakpointInstance(Child)`, rendered inside a parent that has it, gets the parent instance. The key scan finds no input with this `transformFn`, `cachedSig` stays `null`, and the input stops following the breakpoint after the first render. The CORE-07 warning only runs when `instance` is `null`, so it never fires in this case.
- Fix: look the token up with `{ self: true }` (the transform runs in the component's own node injector), or warn whenever `cachedSig` is still `null` after the scan and `raw()` holds a map. Add a spec with a parent that provides the instance and a child that does not.
- Breaking: no. Decision: no.

## HC2-04 Overlay focus restore picks a disabled or hidden opener and drops focus on `<body>`

- Status: fixed

- Where: `libs/core/src/lib/overlay/overlay-runtime.ts:343-345`.
- Problem: `focusRestoreChain.find((element) => element.isConnected)?.focus(...)` takes the first element that is still in the document, even if it cannot take focus. Repro: a "Delete" button opens a confirm dialog. Confirm sets `[disabled]="deleting()"` on the button, then the dialog closes. The button is connected, `focus()` does nothing, focus stays on `<body>`, and the rest of the chain (the overlay or element that opened this one) is never tried. The same happens for an opener in a collapsed `display: none` section.
- Fix: walk the chain and stop at the first element where `focus()` actually took (`targetDocument.activeElement === element` after the call), or pre-filter with `isFocusable` plus `!element.matches(':disabled')`. Add a spec: opener disabled during close, then focus goes to the next element in the chain.
- Breaking: no. Decision: no.

## HC2-05 `isTopMost` ranks overlays by open order, not by layer, so Escape and Tab go to an overlay painted below another one

- Status: fixed (decision 2026-10-10: Escape and Tab go to the highest stacking layer, then the last opened)

- Where: `libs/core/src/lib/overlay/overlay-runtime.ts:124-136`; used for Escape (`:401`), outside pointer (`:424`) and the focus trap (`overlay-focus.ts:137`).
- Problem: `openEntries` is one list across all runtime roots, in open order. An overlay on a higher layer (`data-et-overlay-layer`, e.g. a menu inside the query devtools panel) opened first, then an app overlay at the default layer opened by a timer or a keyboard shortcut, makes the app overlay "top-most" although it paints below the devtools menu. Escape closes the hidden app overlay first, and the devtools menu, which the user is looking at, ignores Escape until the app overlay is gone.
- Fix: in `isTopMost`, rank by `(layer, openIndex)`, the layer being the root's `OVERLAY_LAYER_ATTRIBUTE`. Decide whether a modal at a lower layer should still own Tab while a higher-layer overlay is open.
- Breaking: no. Decision: yes (who owns Escape/Tab across layers).

## HC2-06 `afterOpened()` never emits or completes for an overlay closed before it opened

- Status: fixed

- Where: `libs/core/src/lib/overlay/overlay-runtime-ref.ts:123-131,133-154`; `overlay-runtime.ts:484-534`.
- Problem: `markOpened` returns early unless the state is `mounting`, and `finishClose` completes `beforeClosed`/`afterClosed` but not `afterOpenedSubject`. A ref closed during the enter frame or the enter transition therefore leaves `afterOpened()` open forever: `await firstValueFrom(ref.afterOpened())` hangs. The `afterOpened()` subscriptions in `libs/components/src/lib/overlay/overlay-opener.ts:225`, `overlay-ref-internal.ts:74` and `strategies/overlay-strategy-controller.ts:412` keep their closures alive. The `lifecycle.state$` `'entered'` subscription in `overlay-runtime.ts:524-533` is not in `cleanupFns` either and stays open after a close during `entering`.
- Fix: complete `afterOpenedSubject` (no emission) in `finishClose`, and push the `'entered'` subscription into `cleanupFns`. Spec: close in the same tick as `mount()`, expect `afterOpened()` to complete without a value.
- Breaking: no (a hanging await now resolves with `EmptyError` from `firstValueFrom`). Decision: no.

## HC2-07 No spec for the focus trap with disabled fieldsets or `<summary>`, scroll restoration under a base href, or close during mounting

- Status: fixed

- Where: `libs/core/src/lib/overlay/overlay-focus.spec.ts`, `libs/core/src/lib/signals/recipes/scroll-restoration.spec.ts`, `libs/core/src/lib/overlay/overlay-runtime.spec.ts`.
- Problem: HC2-01, HC2-02, HC2-04 and HC2-06 are exactly the cases these specs do not have. `overlay-focus.spec.ts` covers radio groups (HO-04) but no `fieldset[disabled]`, `inert` or `summary`. Nothing in scroll restoration runs with a `<base href>`. No runtime spec closes a ref before its enter frame and checks `afterOpened()`.
- Fix: add the specs listed under each finding. Overlay ones go in a core scenario (`libs/core/src/scenarios`), per the core-scenario-tests rule.
- Breaking: no. Decision: no.
