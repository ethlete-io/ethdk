# Core scenario tests

Status: slice 1 done (harness + overlay runtime scenarios). Slices 2-6 open.

A behavior layer for `libs/core` next to its jsdom unit specs, shaped like `libs/query/src/scenarios`.

## Slices

- [x] 1. Harness at `libs/core/src/scenarios/harness/` + overlay runtime scenarios
- [ ] 2. Timing/lifetime scenarios: `signalAnimatedNumber`, `injectAngularRootElement`, `setupScrollRestoration`,
      scroll-observer sentinels, css-vars writers, `KeyPressManager`, `controlValueSignal` `debounceFirst`
- [ ] 3. Unsaved-changes and app-update through the real router
- [ ] 4. SEO bindings
- [ ] 5. Core stories + Playwright suites: overlay runtime, `AnimatedLifecycle`, `ResizeHandles` in a pop-out
- [ ] 6. Core stories + Playwright suites: focus-visible tracker, element observers

## Harness contract

- `useScenario(config?)` registers `beforeEach`/`afterEach`; `createScenario` does not (install fake timers and
  call `destroy()` yourself). Boots the app through `TestBed`, like the query harness.
- Scenarios import from `../index` only - the `@ethlete/core` public API.
- Time: fake `setTimeout`/`setInterval`/`Date`; a fake `requestAnimationFrame` that runs only on `s.frame(n)`.
  `s.tick(ms)` runs CD, timers, CD. `s.flush()` runs frames and timers until neither is pending (throws if it
  never settles). `s.settle()` also awaits promises.
- `s.run(fn)` injection context; `s.consumer(providers?)` a fake component injector; `s.app()` a second
  `createApplication` on the same document; `s.keydown(key, target?)` dispatches a cancelable keydown.
- `destroy()` tears down apps, consumers and `TestBed`, then checks: `timers`, `frames` (pending rAF),
  `listeners` (document/window add/remove counted), `overlay-roots`, `body` (children added and left),
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
