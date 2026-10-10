# hunt-components-rest — bug hunt 2026-10-10

Scope: `libs/components/src/lib` carousel, tabs, notification, button, pagination, accordion, toggletip,
filter-overlay (read for runtime logic; chart and stream skimmed only - both had their own scan). Read-only hunt;
checked against `git log --oneline -60` of each path and the `components-rest`/`overlay`/`table-grid` scans.

Read and found clean: pagination (`paginate` matches the MUI window algorithm; NaN/fraction guards in place),
accordion group (single-open diff, DOM order, modified keys), toggletip (the outside-press reopen is swallowed by
the overlay runtime), button loading sources and the capture-phase click block, split button registration,
filter overlay submit/discard.

| ID     | Sev    | Kind | Decision | Title                                                                                                     |
| ------ | ------ | ---- | -------- | --------------------------------------------------------------------------------------------------------- |
| HCR-01 | Medium | bug  | no       | A carousel's current slide freezes after a wheel/trackpad/keyboard scroll that follows a dot or button    |
| HCR-02 | Medium | bug  | no       | Headless tabs: a tab inserted before others shows the wrong panel (panels stay in registration order)     |
| HCR-03 | Medium | bug  | yes      | `notificationManager.promise(query)` never settles (or reports a stale success) when the query is aborted |
| HCR-04 | Low    | bug  | no       | A NaN or fractional tab `selectedIndex` selects no tab and hides every panel                              |

## HCR-01 A carousel's current slide freezes after a wheel/trackpad/keyboard scroll that follows a dot or button

- Where: `libs/components/src/lib/carousel/headless/carousel.directive.ts:347-366` (settle handler), `:492-519`
  (`goToDomIndex` sets `requestedDomIndex`), `:295` (`activeDomIndex = requestedDomIndex ?? observedDomIndex`).
- Problem: `requestedDomIndex` is cleared only by a settle that `restsOn(requested)`, or by a `pointerdown` on the
  scroll container. Two ordinary sequences never produce either:
  1. Interrupted navigation: press next (or a dot) and, during the smooth scroll, scroll on with a trackpad, wheel
     or the arrow keys. The scroll comes to rest on another slide, `restsOn(requested)` is false, the handler
     returns early (`:357`) and keeps the request. Every later wheel/keyboard settle returns early too.
  2. No-op navigation: click the dot of the slide already in view (`carousel.component.html:35` calls
     `goTo(dot.index)` unguarded). The target offset equals `scrollLeft`, so no `scroll`/`scrollend` fires and the
     request stays set. The next trackpad swipe to another slide hits case 1.
     From then on `currentIndex`, the active dot, `activeIndex` (two-way), the `N of M` state and the autoplay
     clock all name the stale slide while another is on screen, and `next()`/`previous()` step from the stale
     slide (a jump backwards). Only a pointer press on the track (touch or mouse drag) recovers it. The scenario
     suite (`libs/components/src/scenarios/carousel.scenario.spec.ts`) has no wheel/keyboard or same-dot case.
- Fix: in `onSettled`, when a settle does not rest on the request, still clear it if the track is no longer
  moving towards it - e.g. track a `wheel`/`keydown` on the container (like `pointerdown`) that clears
  `requestedDomIndex`, and in `goToDomIndex` skip setting the request (and the scroll) when
  `domIndex === observedDomIndex()` and the slide already rests there (`loop.readSettled()?.restsOn(domIndex)`).
  Scenario tests: (a) next, then a `wheel` + `scrollend` resting on slide 3 → active dot 3; (b) click the active
  dot, then `scrollend` resting on the next slide → active dot follows.
- Breaking: no. Decision: no.
- Status: fixed (wheel/scroll-key input on the track clears the pending request; a press on the slide already at rest no longer records one; two scenarios)

## HCR-02 Headless tabs: a tab inserted before others shows the wrong panel

- Where: `libs/components/src/lib/tabs/tabs/headless/tab-panel.directive.ts:26-36` (`panels().indexOf(this)`),
  `tabs/headless/tab-group.directive.ts:146-148` (`registerPanel` appends); compare
  `headless/tab-bar.directive.ts:55`, where triggers are `sortByDomOrder`-ed.
- Problem: triggers are matched to the selection by DOM order, panels by registration order. With the documented
  headless composition (`tab-group.component.spec.ts:360-372`):
  `@for (label of labels(); track label) { <button etTabBarTrigger>…</button> <div etTabPanel>…</div> }`,
  setting `labels` from `['First','Second','Third']` to `['Zeroth','First','Second','Third']` gives triggers
  `[Zeroth, First, Second, Third]` but panels `[First, Second, Third, Zeroth]`. Selecting "Zeroth" shows First's
  panel, and every tab after it shows its predecessor's content. The existing spec at
  `tab-group.component.spec.ts:376` checks only the trigger order. A keyed re-order has the same effect.
  `et-tab-group` is not affected (it renders panels by `$index`).
- Fix: `public panels = computed(() => sortByDomOrder(this.registeredPanels(), (panel) => panel.element))`,
  as the tab bar does for triggers (the accordion group also re-sorts on `signalElementMutations` for keyed
  re-orders; do the same here). Extend the spec at `:376` to select index 0 and assert the visible panel's text.
- Breaking: no. Decision: no.
- Status: fixed (panels sorted by DOM order, re-sorted on child mutations; specs for insert and keyed re-order)

## HCR-03 `notificationManager.promise(query)` never settles (or reports a stale success) when the query is aborted

- Where: `libs/components/src/lib/notification/notification-promise.ts:190-221` (`followQuery`); the query side
  is `libs/query/src/lib/http/query-state.ts:267-311` and `http-request.ts:590-605` (`abort`).
- Problem: `followQuery` waits for `executionState()` to leave `loading` and treats anything that is not
  `success` as an error, but an aborted request (query `reset()`, args parked to `null`, the owning component or
  dialog destroyed - "save and close" is the common case) sets `loading` to `null` and emits `cancel`:
  - first execution: `executionState()` becomes `null`, the effect returns at `if (!state …)`, and the `loading`
    toast - sticky by default (`defaultDuration.loading: 0`, `notification-config.ts:144`) - spins forever;
  - a re-execution: `currentEvent` keeps the previous round's `Response` (by design, `http-request.ts:601-603`),
    so `executionState()` reads `success` with the old response and the toast says "Saved" for a request that was
    cancelled.
    The effect also lives in the root injector, so it outlives the query. `notification-promise.spec.ts` has no
    cancel/abort case.
- Fix: follow the query's latest HTTP event as well - settle on `{ type: 'cancel' }` (or on `executionState()`
  turning `null` after a `loading` was seen). What the toast should do then needs a call: dismiss it silently, or
  show the `error` content with a cancel marker. Add specs for both abort shapes with the existing
  `createFakeQuery` helper (`notification-promise.spec.ts:127`).
- Breaking: no. Decision: yes (what a cancelled follow shows).
- Status: fixed (user decision: a cancel dismisses the loading toast silently; a success whose latest HTTP event is not a new Response is treated as a cancel; docs updated)

## HCR-04 A NaN or fractional tab `selectedIndex` selects no tab and hides every panel

- Where: `libs/components/src/lib/tabs/tabs/headless/tab-group.directive.ts:155-180` (`resolveSelectedIndex`).
- Problem: `Math.min(Math.max(NaN, 0), n - 1)` is `NaN`, and `1.5` stays `1.5`. `triggers[NaN]`/`triggers[1.5]` and
  every `± distance` candidate are `undefined`, so it returns `null` and the effect at `:65-82` leaves the bad value
  in place: no trigger is `aria-selected`, and with `preserveContent` every panel is `hidden`. It is easy to reach
  with `[selectedIndex]="+route.snapshot.queryParams['tab']"` and a missing or garbled param. Carousel and pagination
  already ignore or round such values (`c7820ebc2`, `142c64102`); the specs at `tab-group.component.spec.ts:157-176`
  cover only out-of-range integers.
- Fix: in `resolveSelectedIndex`, map a non-finite index to `0` and `Math.trunc` a fractional one before clamping.
  Add specs for `NaN` and `1.5`.
- Breaking: no. Decision: no.
- Status: fixed (non-finite index maps to 0, fractions truncate; specs for NaN and 1.5)
