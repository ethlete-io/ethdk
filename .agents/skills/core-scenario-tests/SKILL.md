---
name: core-scenario-tests
description: Write or run the scenario tests in libs/core/src/scenarios - behavior tests that boot a real Angular app through the @ethlete/core public API on a deterministic clock and frame loop, with leak invariants (timers, frames, observers, listeners, overlay roots, body/head nodes). Use after a change in libs/core, when fixing a core bug (every fix gets a scenario), or when a unit spec would need to mock internals.
---

# Core scenario tests

The jsdom unit specs in `libs/core` check values. A scenario boots the real app through `TestBed`,
imports only from `../index` (the `@ethlete/core` public API), runs on fake time, and `destroy()`
then fails on anything left behind. Every scenario is also a leak test. Behavior that needs a real
browser (focus, pointer, layout, a pop-out window) goes to the `core-*` suites in
`apps/storybook-e2e` instead - see the `component-behavior-tests` skill.

## Run

```bash
export NX_NO_CLOUD=true
npx vitest run --config libs/core/vite.config.mts libs/core/src/scenarios                          # all
npx vitest run --config libs/core/vite.config.mts libs/core/src/scenarios/seo.scenario.spec.ts     # one
```

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


## Rules

1. Every bug fix in `libs/core` adds a scenario that failed before the fix. Prove it against a local
   revert.
2. `s.allow(...)` is a smell: name the finding in the reason and report it.
3. The harness in `harness/` has its own spec (`harness.spec.ts`); change both together.
