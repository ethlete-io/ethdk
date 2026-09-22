# Core scenario tests

Status: slices 1-4 done. Slices 5-6 open.

A behavior layer for `libs/core` next to its jsdom unit specs, shaped like `libs/query/src/scenarios`.

## Slices

- [x] 1. Harness at `libs/core/src/scenarios/harness/` + overlay runtime scenarios
- [x] 2. Timing/lifetime scenarios: `signalAnimatedNumber`, `injectAngularRootElement`, `setupScrollRestoration`,
      scroll-observer sentinels, css-vars writers, `KeyPressManager`, `controlValueSignal` `debounceFirst`
- [x] 3. Unsaved-changes and app-update through the real router
- [x] 4. SEO bindings
- [ ] 5. Core stories + Playwright suites: overlay runtime, `AnimatedLifecycle`, `ResizeHandles` in a pop-out
- [ ] 6. Core stories + Playwright suites: focus-visible tracker, element observers

## Harness contract

- `useScenario(config?)` registers `beforeEach`/`afterEach`; `createScenario` does not (install fake timers and
  call `destroy()` yourself). Boots the app through `TestBed`, like the query harness.
- Scenarios import from `../index` only - the `@ethlete/core` public API.
- Time: fake `setTimeout`/`setInterval`/`Date`/`performance`; a fake `requestAnimationFrame` that runs only on
  `s.frame(n)` and stamps each frame with `performance.now()`, so `s.frame()` alone does not move time.
  `s.tick(ms)` runs CD, timers, CD. `s.flush()` runs frames and timers until neither is pending (throws if it
  never settles). `s.settle()` also awaits promises.
- `s.run(fn)` injection context; `s.consumer(providers?)` a fake component injector; `s.app()` a second
  `createApplication` on the same document; `s.keydown(key, target?)` dispatches a cancelable keydown.
- `s.settle()` drains microtasks through a real `setImmediate` each round, so a router navigation reaches its
  guards inside one `settle()`. Routed scenarios pass `provideRouter(routes)` and `provideLocationMocks()`.
- Listeners jsdom's selector engine adds on a document's first query (including a `DOMParser` document) are
  not counted.
- A fake `IntersectionObserver` reports only what `s.intersect(element, isIntersecting)` says;
  `s.observedElements()` lists what is observed.
- `destroy()` tears down apps, consumers and `TestBed`, then checks: `timers`, `frames` (pending rAF),
  `observers` (elements an `IntersectionObserver` still observes),
  `listeners` (document/window add/remove counted), `overlay-roots`, `body` and `head` (children added and left),
  `viewport-insets`, `errors` (ErrorHandler + `console.error`), `warnings` (`console.warn`). A failure names
  the invariant and dumps what is left. `s.expectError`/`s.expectWarning` consume one entry;
  `s.allow(name, reason)` opts out and must be reported.
- `src/scenarios` is excluded from `tsconfig.lib.json` and from `@nx/dependency-checks`.

## Slice 1 results

`overlay-runtime.scenario.spec.ts`, each proven against a local revert of the fix it guards:

- Leave animation before teardown - the per-instance rAF loop in `AnimatedLifecycleDirective` (flush never settles).
- Two stacked overlays, two fast Escapes; Escape during the leave animation - `isTopMost` skipping a closing entry.
- Two runtimes in one app; two apps on one document - the root wipe on first mount.
- Second app torn down with an open overlay emits `beforeClosed` - `forceTeardown` calling `beginClose`.

Defect found and fixed: app teardown with an open overlay logged NG0406 (detaching from a destroyed
`ApplicationRef`).

## Slice 2 results

`timing-lifetime.scenario.spec.ts` and `scroll-restoration.scenario.spec.ts`, each proven against a local
revert of the fix it guards:

- `signalAnimatedNumber` destroyed mid-animation - the `DestroyRef` cancel (a frame stays pending).
- `injectAngularRootElement` in an app torn down before a root mounts - the poll `clearTimeout` on destroy.
- `setupScrollRestoration` destroyed with a marked return still pending - `cancelPendingRestore` on destroy.
- `etScrollObserverStart` leaving an `@if` - the unregister on destroy (the detached sentinel stays observed).
- css-vars writers in a second app after the first was torn down - the module-level `hasWritten*` latch.
- `KeyPressManager` repeat on the second press - the count read before the increment.
- `controlValueSignal` `debounceFirst` holding the first value back - the `startWith` after `debounceTime`.

No defects found.

## Slice 3 results

`unsaved-changes.scenario.spec.ts` (guard, coordinator and tab lock on real routes) and
`app-updates.scenario.spec.ts`:

- A late `Signal<FieldTree | null>` source, navigated away from before the baseline effect runs - proven
  against a revert of the `null`-baseline guard in `hasChanges` (the navigation is blocked by a spurious
  confirm).
- Decline/accept through `canDeactivate`, a second check adopting the pending confirm, `abandonAll` releasing a
  pending navigation, and the app badge summed across trackers - behavior coverage, no past fix.

Defect found and fixed: the head-only build fingerprint (the earlier fix for app-appended scripts) read
nothing in an Angular CLI build, whose entry scripts sit at the end of `<body>`, so `isAvailable` never turned
`true`. The fingerprint reads the whole document again and an update needs a deployed script the running
document lacks. Both app-update scenarios fail against the respective old code.

## Slice 4 results

`seo.scenario.spec.ts`, each proven against a local revert of the fix it guards:

- Description, canonical, keywords, robots and alternate bindings follow their signal and remove the tag on
  `null` - the `untracked` reads in `head-binding.ts`, `applyKeywordsBinding`/`applyRobotsBinding` and
  `applyAlternateBinding`, each reverted on its own.
- `og:image` and `preconnect` arrays grow and shrink in order - the `untracked` read in
  `createArrayPropertyBinding`.
- `</SCRIPT >` stays inside the JSON of `<et-structured-data>` - the case-sensitive `</script>` replace. The
  structured-data binding (text content) is covered too; it never had the hole.

Defects found and fixed:

- A link or meta binding whose key changed (a `preconnect` URL, an alternate's `hreflang`, a meta tag's
  selector) left its old tag in `<head>`: shrinking a resource-hint array kept the dropped URL.
- `injectIsRouterInitialized` created after the first navigation stayed `false` until the next one, so a
  title binding (or the title store) created late showed the default title.
