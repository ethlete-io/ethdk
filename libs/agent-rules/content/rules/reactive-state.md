---
name: reactive-state
description: Signals for synchronous state, RxJS for asynchronous work — bridge between them, never copy.
kind: rule
scope: both
---

## Reactive state

- **Synchronous state → signals.** Never model it with a `BehaviorSubject`/`Subject`.
- **Asynchronous work → RxJS.** HTTP, websockets, debounced streams, event sequences.
- **Bridge, don't copy.** Cross the boundary with `toSignal()` / `toObservable()`, never by
  `.subscribe()`-ing and assigning the value somewhere.

For subscriptions and effects, load the repository's focused reactive-state guidance.
