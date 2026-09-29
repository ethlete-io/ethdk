# Core lib scan — open findings

Scan of `libs/core` from 2026-08-19. Fixed findings were removed on 2026-09-26 (git history has
them). All Medium, Low and spec-coverage lines were closed on 2026-09-29.

## Kept on purpose / do not re-open

- `object.ts` path reads accept an unterminated bracket (`'a.b.e[0'` returns the value). Kept lenient: it is a public util.
- `settleWatcher` in `auto-surface.directive.ts` stays alive until the element is connected: windowed lists mount it in an off-pane container first.
- unsaved-changes `runCheck` still returns a Promise; `canDeactivate` consumes it.
- The animation directives' `BehaviorSubject`s. `state$` is a stream of transition events whose ~20 consumers need every state synchronously inside `.next()`; the signal version (`toObservable(state)` plus effects) dropped the middle state of a synchronous `entering→entered` / `leaving→left` jump and was reverted in `6296a5b41`.
- The `props/` module findings — `props/` was removed on 2026-09-23.
