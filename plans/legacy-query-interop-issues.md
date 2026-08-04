# Legacy query interop: source-verified issue list

Source-verified pass (2026-08-04) over the v2 interop layer
(`libs/query/src/lib/legacy/interop/`) and the pieces it leans on
(`libs/query/src/lib/legacy/utils/data.utils.ts`,
`libs/query/src/lib/legacy/query/query.types.ts`,
`libs/query/src/lib/legacy/query/query.utils.ts`,
`libs/query/src/lib/http/query-state.ts`,
`libs/query/src/lib/http/query-dependencies.ts`,
`libs/query/src/lib/http/query-execute-utils.ts`).

Surfaced while sweeping a consumer workspace (fut-frontend) for ET950 and for
one-shot queries missing `destroyOnResponse`. Everything below was read out of the
source, not inferred from a stack trace.

**Status: everything in this document has shipped.** The seven issues were found
against `eeb8db366` and are implemented in the working tree, each now covered by
tests (see [Test coverage](#test-coverage)), together with all four items that used
to be the follow-up list:

| Landed                                                                                | Where                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| The seven fixes                                                                       | `legacy-query-creator.ts`, `legacy-query.ts`, `data.utils.ts` |
| Generator classifies the innermost boundary; `destroyOnResponse` on a discarded query | `migrate-to-query-v3/legacy-prepare-migration.ts`             |
| `ethlete/no-legacy-prepare-without-injector`, with an autofix                         | `libs/eslint-plugin/src/rules/`                               |
| Opt-in browser-only root fallback                                                     | `legacy-prepare-fallback.ts`                                  |

Line references below point at the working-tree state, and each issue records what
shipped. The analysis is kept because it is the review context for those diffs.

## Bugs

### 1. `entity.set` fired with a `null` response on every `prepare()` - fixed

`legacy-query.ts:215-233`

The store-sync effect read `this.newQuery.response()` directly. `response` is
`computed(() => raw === null ? null : ...)` (`query-state.ts:97-103`), so it is
`null` on a fresh query, and the effect runs once on creation before any request
goes out. `EntityIdParams.response` (`query.types.ts:86`) and
`EntitySetParams.response` (`query.types.ts:36`) are both typed **non-nullable**,
so the interop fed `null` through a contract that promised otherwise: an ordinary
`id: ({ response }) => response.uuid` threw `TypeError` the moment the query was
prepared, and a defensive `id` still let `set({ response: null })` write null over
a good store entry.

The tell that this was an oversight rather than intent: the sibling read path
guards correctly. `_transformState` (`legacy-query.ts:430-433`) bails with
`if (!isQueryStateSuccess(s) || !this.entity?.get)`. The write path had no
equivalent.

**Fixed** by gating on the execution state rather than on the response being
non-null:

```ts
const execState = this.newQuery.executionState();
if (execState?.type !== 'success' || !this.entity?.set) return;
```

That was the necessary shape. The obvious `if (res === null) return;` would have
been wrong in the other direction: a 204 is a genuine success whose body is
legitimately `null`, which `executionState` deliberately accommodates
(`query-state.ts:149-156`). A null-check would have silently stopped syncing the
store for every empty-payload success. Gating on `success` also stops a `failure`
from triggering a store write, which the old code did whenever `response()` still
held a previous value.

Never reachable from fut-frontend - zero `entity:` configs across `libs/queries` -
so this was latent there but live for any consumer still using entity stores,
which is exactly the v2 population this layer exists for.

### 2. `destroyOnResponse` leaked when the query never reached success/failure - fixed

`legacy-query-creator.ts:241-256`

The effect was created on the **caller's** injector and self-destroyed only via
`destroyEffect.destroy()` on a terminal state. Two ways to strand it:

- **`prepare()` without `execute()`.** `executionState` stays `null`, so the
  effect never fired.
- **`abort()`.** `LegacyQuery.abort()` calls `newQuery.reset()`, and
  `resetExecuteState` (`query-execute-utils.ts:17-23`) nulls `error`,
  `latestHttpEvent`, `loading` and `rawResponse`. Both arms of the success test at
  `query-state.ts:149` then fail, so `executionState` returned `null` again and no
  terminal state ever arrived.

What made it bite: `legacyPrepareWithoutInjectionContext` explicitly tells people
to "prefer an injector that outlives the call site", so callers hand over a root
or environment injector - and the stranded effect, the `LegacyQuery`, and its
`storeSyncEffect` then lived for the lifetime of the app. The one flag whose
entire job is cleanup was the one that leaked.

**Fixed** by owning the effect with the query's own injector
(`{ injector: newQuery.subtle.injector }`) instead of the caller's, so it dies
with the thing it exists to destroy. That also removed the
`const destroyEffect = effect(() => ... destroyEffect.destroy())` self-reference,
which resolves issue 7 below.

## Diagnostics and API gaps

### 3. The ET950 catch-all mislabelled every DI failure - fixed

`legacy-query-creator.ts:51-56`, `:300-310`

The old `catch { throw legacyPrepareWithoutInjectionContext(...) }` discarded the
real error. Calling `prepare()` inside a _valid_ injection context whose injector
was mid-teardown made `inject()` throw NG0205 ("Injector has already been
destroyed"), and the developer was told "called outside of an injection context" -
so they went and added an injector when the actual problem was lifetime. That was
the same diagnostic dead-end the function exists to remove.

**Fixed** with `isMissingInjectionContextError`, which matches on
`Math.abs(Number(error.code)) === 203` and rethrows everything else untouched.
Matching the code rather than the message is the right call: production builds
strip the message.

Two things came with it, both worth keeping in mind when reviewing:

- The error is now raised from a shared `resolveAmbientInjector(method)` helper
  and names which entry point failed (`prepare` / `createSubject` /
  `createSignal`), which matters now that the containers can throw it too
  (issue 5).
- `describeCreator` (`:59-66`) derives a `GET /person` label from
  `creator.subtle.creatorInternals` when no `name` was passed, so an unnamed
  wrapper points at an endpoint instead of "a legacy query creator". This is what
  makes the [consumer-side note](#consumer-side-note-nobody-passes-name) mostly
  moot. It returns `undefined` for a route function, which is fine: those
  wrappers come from the generator, which always emits a `name`.

### 4. Falsy `body` was silently dropped - fixed

`legacy-query-creator.ts:180-196`

`...(args?.body ? { body: args.body } : {})` omitted `body: 0`, `body: ''`,
`body: false` and `body: null` from the request entirely rather than sending them.
A silent wrong request, not an error. The header loop had the same shape, dropping
an empty-string header value.

**Fixed**: `args?.body !== undefined` for the body, and the header loop now skips
only `undefined` / `null`. `pathParams` / `queryParams` are always objects when
present, so they never needed it.

### 5. The container factories never got the injector escape hatch - fixed

`legacy-query-creator.ts:262-278`, `data.utils.ts:55-59`, `:81-83`

`prepare()` took `WithInjector`; `createSubject`, `createSignal` and
`behaviorSubject` did not, and both hard-required an injection context via
`assertInInjectionContext` plus an un-injected `toObservable(_signal)`. So a call
site that _had_ an injector still could not build a container outside a context,
and when it failed it got a raw NG0203 with no query name - precisely the
experience ET950 was added to replace.

**Fixed** in both halves, which is what makes it actually work:

- `QueryContainerConfig` gained `injector?: Injector` (`data.utils.ts:55-59`), and
  `addQueryContainerHandling` now only asserts when none was passed
  (`data.utils.ts:81-83`).
- The factories resolve `config?.injector ?? this.resolveAmbientInjector(...)`,
  forward it as `{ ...config, injector }`, and `createSignal` passes it to
  `toObservable(_signal, { injector })`.

Worth checking on review that both halves stay in sync: passing `config.injector`
would have been a no-op if `addQueryContainerHandling` had kept its unconditional
assert.

### 6. `canBeCached` hardcoded `false` made container config options dead - fixed

`legacy-query-creator.ts:72-85`, `:286-288`; `legacy-query.ts:200`, `:286-288`

`LegacyQuery.canBeCached` returned `false` unconditionally, and both cleanup
branches in `cleanQuery` read
`((abortPrevious === undefined && q?.canBeCached) || abortPrevious)`
(`data.utils.ts:101` and `:107`). With default config both branches were therefore
unreachable for _every_ legacy query, so container cleanup fell through to
`destroy()` alone. It still worked, because `teardown()` unsubscribes polling, but
"leave it undefined and cacheable queries get aborted" meant nothing for this
query type.

**Fixed** with `canCreatorBeCached`, which mirrors the repository's per-request
decision (explicit `useQueryRepositoryCache` opt-in/out first, then `QUERY` /
`MUTATE`, then `shouldCacheQuery(method)`) and is threaded into `LegacyQuery` as
`_canBeCached`. Resolving it off the creator rather than the request is what lets
a wrapper answer before its first execution.

`isInUse` (always `true`), `_subscriberCount` (always `0`) and `store` (always
`null`) are still the same kind of always-wrong stub, and were left alone. They
look deliberate; `canBeCached` was the one with behavioural reach.

### 7. `destroyEffect` self-reference through the TDZ - fixed

`const destroyEffect = effect(() => ... destroyEffect.destroy())` read the binding
from inside its own initializer, safe only because Angular schedules effects
rather than running them at creation. Removed as a side effect of the issue 2 fix:
the effect no longer needs to destroy itself, because its injector owns it.

## Verified correct - do not "fix" these

Checked while chasing the above, all sound:

- **`isQuery()` accepts a `LegacyQuery`.** It matches on `'state$' in query`
  (`query.utils.ts:255-265`), and `LegacyQuery` assigns `state$` in its
  constructor. So the `isQuery(prev) && isQuery(curr)` branch in
  `addQueryContainerHandling` (`data.utils.ts:116-120`) does fire, and containers
  really do destroy superseded legacy queries. This is what makes
  `destroyOnResponse` genuinely optional for container-stored queries, and it is
  worth a regression test precisely because it rests on a structural check.
- **204 / empty-payload success.** `executionState` treats an arrived response
  event as success independently of a truthy body (`query-state.ts:149-156`), so
  `onSuccess` and `filterSuccess` fire for a 204. Issue 1's fix depends on this
  and must not regress it.
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

## Test coverage

`legacy-query-creator.spec.ts` is 28 cases (from 7), plus
`legacy-prepare-fallback.spec.ts` (4) and 10 new generator cases in
`legacy-prepare-migration.spec.ts`. Per issue:

- **Issue 1**: the entity config is not called at all before the first response
  (asserted on `id` being invoked, not just on the store staying empty - the old
  code threw inside `id` before reaching `set`, so a store-only assertion passes
  against the bug), fires for a 204 success, and does not fire when a re-execution
  fails over a stored entity. `entity.get` is covered through `_transformState`.
- **Issue 2**: destroyed on success and on failure, left alive when only prepared,
  and still destroyed by a later execution after an `abort()` - which is also what
  pins the new arrangement, since the effect now tears down the injector that owns
  it while it is running.
- **Issue 3**: NG0203 produces ET950, `describeCreator` names `GET /person` without
  a `name`, and each container entry point names itself in the message. The
  NG0205 / missing-provider half is **not** covered and cannot be from the public
  API: a destroyed injector throws out of `runInInjectionContext` before `prepare()`
  runs, and `inject(Injector)` resolves in any live context. Only code 203 is ever
  translated, which is the guarantee by construction.
- **Issue 4**: `body: 0` / `''` / `false` / `null` all reach the request, and an
  empty-string header is sent.
- **Issue 5**: all three factories build a container outside an injection context
  with `config.injector`, and all three throw the named ET950 without one. That
  first case is also the both-halves-in-sync assertion - it only passes because
  `addQueryContainerHandling` stopped asserting unconditionally.
- **Issue 6**: `canBeCached` per method and per explicit `useQueryRepositoryCache`,
  plus a container test showing a superseded cacheable query now stops polling and
  is reset - the `cleanQuery` defaults that used to be unreachable.
- **Generator**: the four shapes from the table below are migrated; `queryComputed`,
  a synchronous array callback in a constructor, and a plain class field are left
  alone; `destroyOnResponse` is added to a discarded query but not to a chained
  `.poll()` or a query handed to a container. All four "migrates" cases were
  confirmed to fail against the old structural classifier.

## Consumer-side note: nobody passes `name`

Largely addressed by `describeCreator` (issue 3), but still worth recording.

`CreateLegacyQueryCreatorOptions.name` (`legacy-query-creator.ts:112-118`) is
documented as "Emitted by the `migrate-to-query-v3` generator; worth passing by
hand too", and `legacy-query-creator-migration.ts:642` does emit it. In
fut-frontend, not one of the 100+ creators across `libs/queries` has it - they are
all bare `{ creator: getX }`, which suggests those wrappers predate that line or
were written by hand. The result was an ET950 reading:

```
ET950: A legacy query creator.prepare() was called outside of an injection context.
```

with no query named, which is the bisection exercise the error was written to
prevent. `describeCreator` now degrades to `POST /item-manager/session` instead,
so this is no longer a dead end - but a `name` is still strictly better, and a
route-function wrapper has no fallback at all.

## Reducing the injector requirement

The question behind all of this: can the interop stop requiring an injection
context, or at least stop breaking consumers who do not have one? Two separate
answers, and the second is worth more.

### Removing it: shipped as `provideLegacyPrepareFallback()`

`setupQueryDependencies` (`query-dependencies.ts:50-64`) pulls six things off the
injector. Four are root-resolvable - `HttpClient` (`:63`), `ErrorHandler`, the
client token (`:60`), and an `EnvironmentInjector` to parent the query's child
injector (`:52-53`). Only two are genuinely scope-specific:

- `scopeDestroyRef` (`:59`), which decides when the query's environment injector
  is destroyed.
- `hostElement` (`:64`), devtools "inspect" only, and already `null` for
  root/environment contexts by design.

So a root-injector fallback degrades in exactly two known ways: query lifetime
becomes app-scoped, and devtools loses the host element. Both match v2, which had
no injector to scope to at all (see the comment at
`legacy-query-creator.ts:189-193`).

**The blocker was SSR, not Angular.** The fallback needs a module-global root
injector captured at bootstrap, and this package explicitly supports server
rendering - `query-client.ts:237-238` reasons about "a per-request injector" when
justifying browser-only retention. A global would hand request A's injector to
request B: cross-request data bleed, not merely a leak. So `legacy-prepare-fallback.ts`
is:

- an explicit `provideLegacyPrepareFallback()`, built on
  `provideEnvironmentInitializer(() => stash(inject(EnvironmentInjector)))`,
- refusing to stash when `!isPlatformBrowser(inject(PLATFORM_ID))`, with a dev-mode
  warning saying so,
- resolving `args.injector ?? tryAmbient() ?? stashed ?? throw`, where a stashed
  injector that has since been destroyed counts as absent - handing it over would
  build a query that silently never runs,
- clearing the stash from its own `DestroyRef`, so a torn-down app leaves nothing
  behind.

Issue 2 was a hard prerequisite. A root-scoped query is never torn down by a
component dying, so cleanup rests entirely on container handling or
`destroyOnResponse`; shipping the fallback while that effect was owned by the
caller's injector would have converted a loud throw into a silent permanent leak.

fut-frontend is CSR-only (no `@angular/ssr`, no `main.server.ts`), so it can adopt
this as-is.

### Making it less breaking: the generator's detection - fixed

This was the bigger win. `migrate-to-query-v3/legacy-prepare-migration.ts` already
found `prepare()` sites, inserted `private injector = inject(Injector);` and threaded
`injector:`. The gap was detection.

`determineUsageContext` walked outward and returned on the **first** structural node
it met, so an intervening callback was invisible; the caller then skipped
`queryComputed | constructor | class-field` outright. Transcribing that function and
running it against the shapes actually found in fut-frontend:

| Shape                                          | Verdict                  | Sites found |
| ---------------------------------------------- | ------------------------ | ----------- |
| `computed(() => prepare())` at a class field   | `class-field`, skipped   | 1           |
| `effect(() => prepare())` in a constructor     | `constructor`, skipped   | 6           |
| `.pipe(map(() => prepare()))` in a constructor | `constructor`, skipped   | 3           |
| `switchMap` nested inside `queryComputed`      | `queryComputed`, skipped | latent      |
| plain event-handler method                     | `method`, migrated       | 5           |

**10 of the 15 real call sites were skipped**, including the `computed`-at-a-field
one that produced the ET950 that started this investigation. Only the plain-method
shape is handled.

**Fixed** by classifying the **innermost** function boundary rather than the first
structural ancestor, treating only `runInInjectionContext` and the `queryComputed`
family as context-providing callbacks, and array-method callbacks (`map`, `filter`,
`forEach`, ...) as transparent because they run synchronously in the caller's
context. Array methods are matched on a property access only - the bare-identifier
`map(…)` is an RxJS operator, whose callback is exactly the deferred kind. That rule
set was validated across all 171 `prepare()` call sites in fut-frontend, where it
correctly cleared 156 and flagged 15.

A class-field arrow (`search = (term) => prepare(…)`) falls out of the same rule: it
read as `class-field` before and is a method in disguise.

The same root cause explained the `destroyOnResponse` gaps.
`findQueryVariableNameForPrepareCall` returns `undefined` for a bare expression
statement, and `shouldAddDestroyOnResponse` then returned `false`. So the generator
added the flag when the query **was** stored in a variable or property - where a
container usually handles cleanup anyway - and omitted it when the result was
**discarded**, which is the one case where nothing does. That was backwards for
fire-and-forget, and it accounted for 11 of the 12 missing `destroyOnResponse` sites
found in fut-frontend.

**Fixed** with `isDiscardedPrepareCall`, which walks the chained calls off `prepare()`
and asks whether the whole expression is a statement. A chained `.poll()` disqualifies
it - that query is meant to keep running - and so does being an argument to something
else, which is a container taking ownership.

Finally, the lint rule, since a generator runs once per migration but a lint rule
catches the next person who writes a callback.
`ethlete/no-legacy-prepare-without-injector` carries the same classifier over ESTree
and fixes what it can: it threads `injector: this.injector`, adding the member and
its `@angular/core` import when the class has neither. A call in a standalone function
is reported without a fix - there is no injector to reach for. It also treats a
function that calls `inject()` itself as context-providing, because such a function
can only be called from a context; that is the one rule the generator does not share,
which is deliberate - the generator threads an injector there anyway, belt and braces,
while the lint rule must not cry wolf.

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
