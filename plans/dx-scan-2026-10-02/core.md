# core — DX scan 2026-10-02

Scope: `libs/core/src/lib/**` (overlay runtime, animations, signals, theming, scrolling, drag/resize,
directives, providers, unsaved-changes, utils) and `apps/docs/core/*.md`.

| ID      | Sev    | Kind     | Decision | Title                                                                                            |
| ------- | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| CORE-01 | Medium | bug      | no       | `OverlayRuntimeRef.beforeOpened()` fires before `mount()` returns, so nobody can observe it      |
| CORE-02 | Medium | dx       | yes      | `OverlayRuntimeRef` exposes its internal state mutators as public API                            |
| CORE-03 | Medium | bug      | no       | Unsaved-changes tracker never turns dirty for a `WritableSignal<T \| null>` that starts `null`   |
| CORE-04 | Medium | bug      | no       | `getElementScrollCoordinates` `origin: 'nearest'` re-aligns both axes from one axis' check       |
| CORE-05 | Medium | bug      | no       | `signalClasses`/`Attributes`/`Styles` forget pushed/removed tokens when the element changes      |
| CORE-06 | Medium | bug      | no       | `[etClickOutside]` fires for presses that started inside and for clicks on removed nodes         |
| CORE-07 | Medium | dx       | no       | Breakpoint transforms silently stop following the breakpoint without `provideBreakpointInstance` |
| CORE-08 | Medium | bug      | no       | `setCookie` default domain is a public suffix on `*.co.uk`-style hosts; the cookie is dropped    |
| CORE-09 | Medium | dx       | yes      | `AnimatedLifecycleDirective.state$` is a public writable `BehaviorSubject`, no signal            |
| CORE-10 | Low    | bug      | no       | `signalElementLastScrollDirection` measures the first scroll against `0`, not the real start     |
| CORE-11 | Low    | dx       | no       | `*etAnimatedIf` without an ancestor `etAnimatedLifecycle` fails with a bare NG0201               |
| CORE-12 | Low    | dx       | no       | `etProvideColor` with a theme name is silent when no color themes are registered                 |
| CORE-13 | Low    | dx       | no       | Overlay-runtime guide misses `passive`, `updatePositionStrategy`, and misstates `aria-modal`     |
| CORE-14 | Low    | dx       | no       | `injectQueryParam` is typed `string \| null` but returns `string[]` for repeated params          |
| CORE-15 | Low    | dx       | no       | Deprecated platform APIs: `router.getCurrentNavigation()`, `KeyboardEvent.keyCode`               |
| CORE-16 | Low    | dx       | yes      | Resize handles and drag handle disagree on event shape and pointer capture                       |
| CORE-17 | Low    | dx       | no       | `injectIsDocumentVisible` undocumented; two viewport-size signals with no guidance between them  |
| CORE-18 | Low    | test-gap | no       | No coverage for element swaps in element bindings / scroll direction, or 2D `nearest` scroll     |

## CORE-01 `OverlayRuntimeRef.beforeOpened()` fires before `mount()` returns, so nobody can observe it

- Where: `libs/core/src/lib/overlay/overlay-runtime.ts:247-248`, `libs/core/src/lib/overlay/overlay-runtime-ref.ts:26-29,75-86`
- Problem: `mount()` calls `beforeOpenedSubject.next()` and `.complete()` synchronously, before it
  returns the ref. A plain `Subject` does not replay, so
  `runtime.mount(cfg).beforeOpened().subscribe(fn)` never calls `fn`. It only sees `complete`. The
  same holds for the other three lifecycle observables: a subscriber that arrives after the event
  (`afterOpened()` after the enter frame, `afterClosed()` after a synchronous close of an overlay
  without a lifecycle, e.g. `ref.close(); ref.afterClosed().subscribe(...)`) gets nothing. The docs
  table (`apps/docs/core/overlay-runtime.md:147-148`) lists all four as normal "lifecycle observables".
  No code in the repo subscribes to `beforeOpened()`.
- Fix: back the four observables with replaying state. Either `ReplaySubject(1)`, or derive them from
  the `state` signal plus a stored close event (emit at once if the state is already past the
  event). Add a runtime spec: subscribe to each observable after its event and expect one emission.
  If `beforeOpened` has no real use, drop it instead.
- Breaking: no (unless dropped). Decision: no.
- Status: fixed (ReplaySubject(1) behind all four observables - the smaller change)
- Review: ok

## CORE-02 `OverlayRuntimeRef` exposes its internal state mutators as public API

- Where: `libs/core/src/lib/overlay/overlay-runtime-ref.ts:39,88-151,155-157`
- Problem: `OverlayRuntimeRef` is `ReturnType<typeof createOverlayRuntimeRef>`, so everything the
  runtime uses internally is public, typed and autocompleted: `beforeOpenedSubject`,
  `attachComponentRef`, `attachPositionUpdater`, `attachBackdropUpdater`, `markOpened`,
  `beginClose`, `finishClose`. A consumer who reaches for `ref.beginClose({ result, source: 'api' })`
  (it reads like the close API) puts the ref into `closing` without starting a teardown. After that,
  `close()`/`forceClose()` return early (`:42`, `:61`) and the overlay stays in the DOM until app
  teardown. `createOverlayRuntimeRef` and the low-level positioning helpers (`setBaseElementStyles`,
  `setBackdropStyles`, `resetPositioningStyles`, `registerAnchoredPositionSetup`,
  `registerAnchoredPositionMiddlewareExtras`) are also exported from the barrel. The `OverlayRuntime`
  type itself (`overlay-runtime.ts:28`) is not exported.
- Fix: declare a public `OverlayRuntimeRef<TComponent, TResult>` type with only `id`, `config`,
  `elements`, `state`, `componentInstance`, the four lifecycle observables, `close`, `forceClose`,
  `registerCloseGuard`, `updatePositionStrategy` and `updateBackdrop`. Keep the full object as an
  internal type that the runtime uses. Export `OverlayRuntime`. Mark the internal helpers `ɵ`, or
  move them out of the barrel (check `libs/components` imports first).
- Breaking: yes (type surface). Decision: yes: which helpers stay public for "custom floating UI"
  (the docs list `setupPositioning` and friends at `overlay-runtime.md:163`).
- Status: fixed (public `OverlayRuntimeRef` type; internal mutators, `createOverlayRuntimeRef` and the style/register helpers out of the barrel; `OverlayRuntime` exported; `setupPositioning`, `applyCenteredPosition`, `applyGlobalPosition`, `createAnchoredPositionCleanup` stay public)
- Review: ok

## CORE-03 Unsaved-changes tracker never turns dirty for a `WritableSignal<T | null>` that starts `null`

- Where: `libs/core/src/lib/unsaved-changes/unsaved-changes-source.ts:51-72`
- Problem: the tracker detects a "late FieldTree" signal by peeking at the signal once. If the value
  is `null`/`undefined`, it decides the signal will hold a FieldTree. A plain state signal like
  `draft = signal<Draft | null>(null)`, filled later by a fetch, is therefore routed into the
  FieldTree branch. Its `computed` returns `null` for every non-FieldTree value (`:62`), so
  `hasChanges` is `false` forever and the guard never asks. Nothing warns. The only hint is a source
  comment (`:74-75`). The docs (`apps/docs/core/utilities.md:69`) list "a plain `WritableSignal`"
  with no caveat.
- Fix: decide per read, not once. In the late branch's `computed`, use `field().value()` when the
  current value is a FieldTree. For any other non-null value, treat the signal as a plain value
  signal: the value is the value, and `setValue` calls `.set` when the source has one. Add a spec
  with `signal<{ name: string } | null>(null)` that is set, then edited, and expect `hasChanges()`
  to be `true`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-04 `getElementScrollCoordinates` `origin: 'nearest'` re-aligns both axes from one axis' check

- Where: `libs/core/src/lib/scrolling/scrollable.ts:209-233`
- Problem: `calculateScrollToNearest` computes a single condition for both axes. When the element is
  above/left it calls `calculateScrollToStart()`, otherwise `calculateScrollToEnd()`, and each of
  those writes **both** `scrollLeftTo` and `scrollTopTo`. With the default `direction: 'both'`, a
  target in a 2D scroller (grid, calendar, table) that is fully visible horizontally but below the
  fold also gets its inline axis aligned to the right edge. The view jumps sideways. A target that is
  above and to the right gets start-aligned on both axes, so it lands to the left of where it should.
  `scrollToElement({ container, element })` with no options shows this.
- Fix: decide per axis. Compute the inline result from the left/right flags only and the block
  result from the above/below flags only. Leave an axis unchanged when the element is already
  within it. Add a spec with a 2D container.
- Breaking: no (behavior fix). Decision: no.
- Status: fixed
- Review: ok

## CORE-05 `signalClasses`/`Attributes`/`Styles` forget pushed/removed tokens when the element changes

- Where: `libs/core/src/lib/signals/element-data-binding.ts:33-60,66-101`
- Problem: the element-change effect cleans up and re-applies `config.tokenMap`, which is the map
  passed at creation. Tokens added later with `push()`/`pushMany()` are not applied to a new element
  and not removed from the old one. Tokens taken out with `remove()` are still in `tokenMap`, so they
  are re-applied to the next element from their stale signal. Repro: `const c = signalClasses(sig, {});
c.push('is-active', active);` and then change `sig` to another element. The new element never
  gets `is-active`, and the old one keeps it. The per-token effects also read the elements
  `untracked` (`:71`), so they do not re-run on a swap either.
- Fix: keep one live `Map<tokens, Signal>`, seeded from `tokenMap`, that `push`/`remove` change.
  Use it for both the swap cleanup and the swap application. Add a scenario that swaps the bound
  element after a `push` and after a `remove`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-06 `[etClickOutside]` fires for presses that started inside and for clicks on removed nodes

- Where: `libs/core/src/lib/directives/click-outside.directive.ts:16-27`
- Problem: the directive listens to `click` on `documentElement` and tests
  `hostElement.contains(event.target)`. This misfires in two common cases:
  1. A text selection or slider drag that starts inside the host and is released outside. The
     browser fires `click` on the common ancestor, which is outside the host, so a popover closes
     when the user only selected text in it.
  2. A click inside the host whose own handler removes the clicked node (a chip's remove button, an
     `@if` that swaps the button). By the time the event bubbles to the document, the target is
     detached and `contains` is `false`, so the directive reports "outside".
     The overlay runtime avoids both because it decides on `pointerdown` (`overlay-runtime.ts:413-448`).
- Fix: record whether the last `pointerdown` (capture) began inside the host, and emit on `click`
  only if both the press and the release were outside. Use `event.composedPath().includes(host)`
  instead of `contains`, so a node that is detached by then still counts as inside. Add specs for
  both cases.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-07 Breakpoint transforms silently stop following the breakpoint without `provideBreakpointInstance`

- Where: `libs/core/src/lib/signals/breakpoint-input.ts:72-93`
- Problem: `numberBreakpointTransform` and the other transforms resolve a map once, at bind time.
  Re-resolving on a breakpoint change needs `provideBreakpointInstance(MyComponent)` in the
  component's `providers`. Without it, the effect returns at `:78` and nothing happens:
  `[columns]="{ xs: 1, md: 3 }"` stays at the value of the first render after a resize. The docs say
  so (`apps/docs/core/signal-utils.md:47`), but the code gives no warning. Also, `isBreakpointMap`
  runs up to three times per write (`:67`, `:69`, `:89`), so the dev warning about unknown keys is
  logged several times per change.
- Fix: in dev mode, `console.warn` once per transform when a real breakpoint map is bound and
  `BREAKPOINT_INSTANCE_TOKEN` resolves to `null`. Name `provideBreakpointInstance` in the message.
  Compute `isBreakpointMap` once per write and keep the result.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-08 `setCookie` default domain is a public suffix on `*.co.uk`-style hosts; the cookie is dropped

- Where: `libs/core/src/lib/utils/cookie.ts:25,70-94`
- Problem: `getDomain()` returns the last two labels of the hostname. On `app.example.co.uk`,
  `shop.example.com.au` or `foo.github.io` that is `co.uk` / `com.au` / `github.io`, which are
  public suffixes, and browsers refuse `domain=` on them. `setCookie(name, value)` with the default
  domain then silently sets nothing, and `getCookie` returns `null`. `deleteCookie` has the same
  default. Values are also neither encoded nor decoded, so a value containing `;` or `,` is cut
  short.
- Fix: after the write, check with `hasCookie(name)`. If the cookie is missing and a derived domain
  was used, write it again without `domain` (host-only). Better still, make host-only the default and
  have callers who want a cookie shared across subdomains opt in. That second option is a breaking
  default change. Apply `encodeURIComponent`/`decodeURIComponent` to values. Add a spec with
  `location.hostname = 'app.example.co.uk'`.
- Breaking: no for the fallback, yes for a host-only default. Decision: no (fallback); yes if the
  default changes.
- Status: fixed (host-only fallback + encoding; default unchanged)
- Review: fixed - the value encoding now escapes only what a cookie value cannot hold (js-cookie set), so base64/JWT values stay byte-identical; full `encodeURIComponent` broke the query cookie-scope specs and any reader that does not decode

## CORE-09 `AnimatedLifecycleDirective.state$` is a public writable `BehaviorSubject`, no signal

- Where: `libs/core/src/lib/animations/animated-lifecycle.directive.ts:59-61`
- Problem: the lifecycle state is synchronous state, but it is only available as a public
  `BehaviorSubject`. A consumer can `lifecycle.state$.next('left')`, which skips the class cleanup and
  makes the overlay runtime tear down mid-animation (`overlay-runtime.ts:376-382`). Template and
  `computed` code has to wrap it in `toSignal` each time. This goes against the repo's own rule that
  synchronous state is a signal, and it is the main lifecycle seam for anyone building on the
  runtime (`OverlayRuntimeComponentBase`, docs `animations.md:39`).
- Fix: add `state = signal<AnimatedLifecycleState>('init')` (read-only to consumers) and make
  `state$` a read-only `Observable` from `toObservable`, or a private subject with `asObservable()`.
  Internal `.value` reads become `state()`. Keep `stateChange`.
- Breaking: yes (`state$.value` / `.next` callers). Decision: yes: keep `state$` at all, or migrate
  callers to the signal.
- Status: fixed (`state` signal, `state$` read-only observable, subject private)
- Review: fixed - dropped a restating JSDoc on `state`

## CORE-10 `signalElementLastScrollDirection` measures the first scroll against `0`, not the real start

- Where: `libs/core/src/lib/signals/element-scroll-direction.ts:19-50`
- Problem: the baseline `lastScrollTop`/`lastScrollLeft` starts at `0` and is reset only when the
  element becomes `null`. An element that is already scrolled when it is bound (restored scroll, a
  remounted list), or a switch from one scrolled element to another, reports the wrong direction on
  the first event. For example, scrolling up from 500 to 490 reports `'down'`, and a hide-on-scroll
  header reacts the wrong way.
- Fix: when `switchMap` attaches to `currentElement`, seed the baseline from that element's
  `scrollTop`/`scrollLeft`.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-11 `*etAnimatedIf` without an ancestor `etAnimatedLifecycle` fails with a bare NG0201

- Where: `libs/core/src/lib/animations/animated-if.directive.ts:20`
- Problem: `inject(ANIMATED_LIFECYCLE_TOKEN)` with no `optional` throws
  `NG0201: No provider for InjectionToken ANIMATED_LIFECYCLE_DIRECTIVE_TOKEN`. That message does not
  say that an `etAnimatedLifecycle` ancestor is needed. The directive also has no
  `ngTemplateContextGuard`, so `*etAnimatedIf="item(); as item"` does not type-narrow the way
  `@if (x; as y)` does.
- Fix: inject with `{ optional: true }` and throw a `RuntimeError` with a code that names the missing
  `[etAnimatedLifecycle]` ancestor. Optionally add a `$implicit`/`etAnimatedIf` context with a
  template guard.
- Breaking: no. Decision: no.
- Status: fixed (ET9000 + template context guard)
- Review: ok

## CORE-12 `etProvideColor` with a theme name is silent when no color themes are registered

- Where: `libs/core/src/lib/theming/provide-color.directive.ts:102`
- Problem: `colorName` returns early on `!this.themes`, before the dev-mode "theme does not exist"
  check. An app that forgot `provideColorThemesWithTailwind4()` gets
  `<div etProvideColor="brand">` with only the `-color--inherited` class and no message.
- Fix: in dev mode, log once when a non-`surface` name is bound and `themes` is `null`, and name
  `provideColorThemesWithTailwind4()` in the message.
- Breaking: no. Decision: no.
- Status: fixed
- Review: fixed - warns once per application, not per directive; the bar-chart and stream-pip specs that bound theme names without registering themes now register them

## CORE-13 Overlay-runtime guide misses `passive`, `updatePositionStrategy`, and misstates `aria-modal`

- Where: `apps/docs/core/overlay-runtime.md:26-43,31,138-150`; code
  `libs/core/src/lib/overlay/overlay-runtime.types.ts:142`, `overlay-runtime.ts:176`
- Problem: the mount-config table has no row for `passive`, which a tooltip-like primitive needs so
  that it does not take Escape and the focus trap from the overlay below it. The `modal` row says
  modal overlays "get ... `aria-modal`", but the runtime sets `aria-modal` only when `role` is set,
  and `role` defaults to `null`. The ref table leaves out `updatePositionStrategy` (only mentioned in
  prose at `:134`), `id` and `config`.
- Fix: add a `passive` row, correct the `modal` row ("`aria-modal` when a `role` is set"), and add the
  missing ref members to the table.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-14 `injectQueryParam` is typed `string | null` but returns `string[]` for repeated params

- Where: `libs/core/src/lib/signals/router.ts:245-251` (also `injectPathParam` `:263-273`)
- Problem: Angular's `Params` holds `string[]` for `?tag=a&tag=b`. The cast to
  `Signal<string | null>` hides that. `injectQueryParam('tag')()` then returns an array at runtime,
  and `.toLowerCase()` on it throws. `requireSync` reads only the first value with
  `URLSearchParams.get`, so the same param can be a string on the first read and an array after
  navigation. Separately, only `injectFragment` accepts `injector` (`InjectUtilConfig`); the other
  `inject*` helpers in this file do not.
- Fix: type the result as `string | string[] | null`, or add an `injectQueryParamAll`/`multiple: true`
  variant and normalize the single form to the first value. Accept `InjectUtilConfig` on every
  helper in the file.
- Breaking: yes (type) for the first option. Decision: no.
- Status: fixed (non-breaking: first value + `injectQueryParamAll`, `injector` on every helper)
- Review: ok

## CORE-15 Deprecated platform APIs: `router.getCurrentNavigation()`, `KeyboardEvent.keyCode`

- Where: `libs/core/src/lib/signals/router.ts:359`, `libs/core/src/lib/signals/recipes/scroll-restoration.ts:398`,
  `libs/core/src/lib/utils/key-press-manager.ts:8,11`
- Problem: `Router.getCurrentNavigation()` has been `@deprecated 20.2` ("use the `currentNavigation`
  signal"), and the peer dependency is Angular 22.1. `KeyPressManager` is a public class keyed on the
  deprecated numeric `keyCode`, so a consumer has to look up magic numbers.
- Fix: switch to `router.currentNavigation()`. Change `KeyPressManager` to take a `KeyboardEvent['key']`
  string, or deprecate it if nothing uses it (no usages in `libs/`).
- Breaking: yes for the `KeyPressManager` signature. Decision: no.
- Status: fixed (`currentNavigation()`; `KeyPressManager` deprecated, signature kept)
- Review: ok

## CORE-16 Resize handles and drag handle disagree on event shape and pointer capture

- Where: `libs/core/src/lib/resize-handles/resize-handles.component.ts:25-32,52-80`;
  `libs/core/src/lib/drag-handle/drag-gesture.ts:24-41,49-56`
- Problem: the two gesture primitives on the same docs page (`drag-resize.md`) use different
  vocabularies. The move event is `dx/dy` for resize but `totalDx/totalDy` + `stepX/stepY` for drag.
  `resizeEnded` emits `void`, while `dragEnded` carries the final position. Drag calls
  `setPointerCapture`; resize does not, so a resize handle next to an iframe (a preview pane, an
  embed) loses its `pointermove`s while the pointer is over the frame and only ends on the next
  `pointerup` the document sees.
- Fix: add pointer capture to the resize gesture (same try/catch helper). Rename `ResizeMoveEvent`
  to `totalDx`/`totalDy` and have `resizeEnded` emit the final `ResizeMoveEvent`.
- Breaking: yes (renames). Decision: yes (renames); the pointer capture can go in without one.
- Status: fixed (pointer capture; 2026-10-08 renames to totalDx/totalDy, resizeEnded emits the final event)
- Review: ok (pointer capture); renames left for the user decision

## CORE-17 `injectIsDocumentVisible` undocumented; two viewport-size signals with no guidance between them

- Where: `libs/core/src/lib/signals/document-visibility.ts:15`; `libs/core/src/lib/signals/media-queries.ts:119`
  vs `libs/core/src/lib/signals/element-dimensions.ts:147`
- Problem: `injectIsDocumentVisible` is a public helper with a useful JSDoc but no mention in
  `apps/docs`. `injectViewportDimensions()` (ResizeObserver on `<html>`, `signal-utils.md:20`) and
  `injectViewportSize()` (`visualViewport`, `element-signals.md:40`) answer nearly the same question.
  They are documented on different pages, neither links to the other, and an eslint rule
  (`prefer-viewport-size`) pushes one of them without the docs saying when to use the other.
- Fix: document `injectIsDocumentVisible` next to the media-query helpers. In both docs rows, add one
  line saying which signal to use when (layout viewport vs visual viewport / soft keyboard), and link
  the two.
- Breaking: no. Decision: no.
- Status: fixed
- Review: ok

## CORE-18 No coverage for element swaps in element bindings / scroll direction, or 2D `nearest` scroll

- Where: `libs/core/src/scenarios/element-bindings.scenario.spec.ts` (host element only);
  `signalElementLastScrollDirection` and `signalHostElementLastScrollDirection` are not referenced by any
  spec or scenario; `libs/core/src/lib/scrolling/scrollable.spec.ts` has no 2D container case.
- Problem: CORE-05, CORE-10 and CORE-04 all live in code paths no test exercises: a signal-bound
  element that changes, a scroll-direction signal at all, and `nearest` with overflow on both axes.
- Fix: one scenario per path, written with the fixes above (each red before its fix).
- Breaking: no. Decision: no.
- Status: fixed (scenarios/specs with CORE-04/05/10)
- Review: ok
