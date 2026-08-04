# Legacy query interop: consumer-side follow-ups

Everything the 2026-08-04 source-verified pass over
`libs/query/src/lib/legacy/interop/` found has shipped in this repo: the seven
interop fixes (`legacy-query-creator.ts`, `legacy-query.ts`, `data.utils.ts`), the
generator now classifying the innermost context boundary and adding
`destroyOnResponse` to discarded queries
(`migrate-to-query-v3/legacy-prepare-migration.ts`), the
`ethlete/no-legacy-prepare-without-injector` rule with an autofix, and the opt-in
browser-only root fallback (`legacy-prepare-fallback.ts`) - each covered by tests.

The full issue-by-issue analysis was deleted with the plan; read it with
`git show 41354e7c6:plans/legacy-query-interop-issues.md`.

## What is left, and it is all consumer-side

Nothing in this repo. In fut-frontend, in this order:

1. **Re-run `nx g @ethlete/query:migrate-to-query-v3`** once the release lands, so
   the 10 previously-skipped call sites get their injector and the 11 discarded
   queries get `destroyOnResponse`. Review the diff rather than trusting it: the
   classifier is deliberately conservative about what counts as context-providing.
2. **Turn the lint rule on** (it is in `recommendedTs`, so this is just picking up
   the release) and fix what the generator could not - standalone functions get no
   autofix by design.
3. **Decide on `provideLegacyPrepareFallback()`.** It is CSR-only there, so it is
   available, but it trades a loud throw for app-scoped query lifetimes. Worth it
   only if the remaining hand-fixes outnumber the call sites you would rather scope
   properly.
4. **Pass `name`** on the creators that predate the generator emitting it -
   `describeCreator` covers most of the loss now, but a route-function wrapper still
   has no fallback label.

## Verified correct - do not "fix" these

Checked while chasing the fixed issues, all sound:

- **`isQuery()` accepts a `LegacyQuery`.** It matches on `'state$' in query`
  (`query.utils.ts:255-265`), and `LegacyQuery` assigns `state$` in its
  constructor. So the `isQuery(prev) && isQuery(curr)` branch in
  `addQueryContainerHandling` (`data.utils.ts:116-120`) does fire, and containers
  really do destroy superseded legacy queries. This is what makes
  `destroyOnResponse` genuinely optional for container-stored queries, and it is
  worth a regression test precisely because it rests on a structural check.
- **204 / empty-payload success.** `executionState` treats an arrived response
  event as success independently of a truthy body (`query-state.ts:149-156`), so
  `onSuccess` and `filterSuccess` fire for a 204. The `entity.set` fix depends on
  this and must not regress it.
- **`onSuccess` / `onFailure` subscriptions self-terminate.**
  `legacy-query.ts:377-385` never unsubscribes, but `takeUntilResponse()`
  completes on the first terminal state, and if the query dies first `state$`
  completes: `toObservable` registers
  `injector.get(DestroyRef).onDestroy(() => { watcher.destroy(); subject.complete(); })`
  (Angular `rxjs-interop`), and `state$` is built on the query's own injector
  (`legacy-query.ts:209`).
- **The inert-query path.** `isInjectorUsable` (`legacy-query-creator.ts:38-44`)
  covers both shapes correctly: a destroyed `R3Injector` throws from `get()` and
  is caught; a node injector returns a `DestroyRef` reporting `destroyed: true`.
  A missing `DestroyRef` optional-resolves to `null` and reads as usable, which is
  the right default.
