---
name: rxjs-signals
description: How to choose between signals and RxJS, and use each correctly - synchronous state vs asynchronous work, unsubscribing, and avoiding RxJS inside effects/computeds. Read when adding reactive state, wiring up an observable, or deciding whether something should be a signal or a stream. Part of the Ethlete styleguide (judgment beyond what lint enforces).
kind: skill
scope: both
requires: ['@ethlete/core']
---

# Signals vs RxJS

Lint already blocks the mechanical mistakes (`$` suffix on observables, no body in
`subscribe()`, no `subscribe` in `pipe()`, no RxJS in `effect()`/`computed()`).
The judgment calls:

## Which one

- **Synchronous state → signals.** Never model sync state with a
  `BehaviorSubject`/`Subject`. Use `signal()` / `computed()` / `linkedSignal()`.
- **Asynchronous work → RxJS.** HTTP, websockets, debounced streams, event
  sequences.
- **Bridge, don't copy.** Cross the boundary with `toSignal()` / `toObservable()`,
  not by `.subscribe()`-ing and assigning into a variable or signal.

```ts
// ❌ sync state as a subject           // ✅ signal
const count$ = new BehaviorSubject(0);
const count = signal(0);

// ❌ copy an observable into state       // ✅ bridge
let data;
obs$.subscribe((d) => (data = d));
const data = toSignal(obs$);
```

## Using RxJS correctly

- **Always unsubscribe.** Prefer `takeUntilDestroyed()` (needs an injection
  context); otherwise `take` / `takeUntil` / `takeWhile`, or store and call
  `.unsubscribe()`. Place the limiting operator **last** in the pipe.
- **Side effects go in `tap()`**, never in the `subscribe()` callback - keep
  `subscribe()` empty.
- **Don't reach for RxJS inside `effect()`/`computed()`.** Subscribing per run
  leaks. Model the stream off the signal instead:

```ts
// ❌ new subscription every time the signal changes
effect(() => fetchPage(page()).pipe(tap(handle)).subscribe());

// ✅ one stream, driven by the signal, cleaned up on destroy
toObservable(page)
  .pipe(
    switchMap((p) => fetchPage(p)),
    tap(handle),
    takeUntilDestroyed(),
  )
  .subscribe();
```

## Prefer `@ethlete/core` helpers

Lint nudges these, but reach for them by default: `injectViewportSize()`,
`injectMediaQueryIsMatched()` / `injectBreakpointIsMatched()`,
`signalElementDimensions()` / `signalElementScrollState()`, and the RxJS
`timer`/`interval`/`fromEvent` wrappers over `setTimeout`/`setInterval`/
`addEventListener`.
