---
name: query-scenario-tests
description: Write or run the scenario tests in libs/query/src/scenarios - consumer-level tests that boot the real query client against a stateful fake API with a deterministic clock and leak invariants. Use after any change in libs/query, when fixing a query bug (every fix gets a scenario), when a unit spec would need to mock internals, or when the user says "scenario test", "regression test for the query system", "leak", "race".
---

# Query scenario tests

The unit specs in `libs/query` mock internals and pass while the real system races or leaks.
A scenario test boots the real client through the **public API only** (`import ... from
'../index'`, never `../lib/...`), talks to a fake backend that behaves like a small server,
and runs on fake timers. `scenario.destroy()` then asserts four invariants: no request in
flight, no timer left, no cache entry left, no unexpected error. Every scenario is also a
leak test.

## Run

```bash
export NX_NO_CLOUD=true
npx vitest run --config vitest.projects.ts --project query libs/query/src/scenarios                       # all
npx vitest run --config vitest.projects.ts --project query libs/query/src/scenarios/auth.scenario.spec.ts # one
```

Scope to one file while you iterate. Several agents must never each run the whole `query`
project at once.

## Layout

```
libs/query/src/scenarios/
  harness/   fake-api.ts (createFakeApi, sequence), tokens.ts (mintToken), scenario.ts (useScenario, createScenario), invariants.ts
  <domain>.scenario.spec.ts   one file per docs page under apps/docs/query/
```

## Write a scenario

```ts
const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, clientFeatures: [withDefaultRetry()] });

it('dedupes identical requests', () => {
  const s = scenario();
  s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params.id } }));
  const getUser = s.get<{ response: User; pathParams: { id: string } }>((p) => `/users/${p.id}`);

  const a = s.consumer();
  const q1 = a.run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));
  const q2 = s.consumer().run(() => getUser(withArgs(() => ({ pathParams: { id: '1' } }))));

  s.tick();
  expect(s.api.requestCount('GET', '/users/1')).toBe(1);
  expect(q1.response()).toEqual(q2.response());
});
```

- `useScenario` registers `beforeEach`/`afterEach` and returns a getter. `createScenario`
  does not register hooks; use it for two clients (multi-tab) and call `destroy()` yourself.
- `s.api.on(method, route, handler)` answers every match; `once` answers the next match only;
  `sequence([...])` answers in order; `protect(route)` demands a valid unexpired bearer token
  minted with `mintToken`. Handlers return `{ status?, body?, headers?, delay? }`.
- Nothing lands until you `s.tick(ms)`. `tick` flushes effects, advances timers, drains
  microtasks, flushes effects again. `s.flush()` ticks until nothing is pending. `await
  s.settle(ms)` also awaits promises (persistence, a `router.navigate` from a query form).
- `s.consumer()` is a fake component: its own injector and `DestroyRef`. Create queries inside
  `consumer.run(...)`; `consumer.destroy()` ends its lifetime.
- `s.auth({...})` builds a bearer auth provider with login and refresh routes on the fake API.
- Expected errors: `s.expectError(/unauthorized/)` consumes one entry so the `errors`
  invariant passes. Never silence `console.error` yourself.
- `s.allow('timers', 'reason')` opts out of one invariant. Every opt-out is a smell: name the
  finding or issue in the reason and mention it in your report.

## Rules

1. Assert the documented behavior from `apps/docs/query/<domain>.md`, not the current behavior.
2. A scenario that fails against the current code stays in the file as `it.fails(...)` with a
   one-line reason. Do not weaken it. Report it.
3. Every bug fix in `libs/query` adds a scenario that failed before the fix.
4. Time: use the bare `setTimeout` in anything you add to the harness. Do not fake
   `queueMicrotask`; the multi-tab fakes need it. A timer created exactly on an
   `advanceTimersByTime` boundary needs one more `s.tick(1)`. `settle()` advances fake time once and
   then awaits microtasks; `flush()` advances repeatedly and never awaits. A cascade in which each
   round arms its next timer one microtask later (401, refresh, retry, 401, ...) needs a loop of
   `await Promise.resolve(); s.tick(50);` - see the streak-cap test in `auth-features.scenario.spec.ts`.
5. The harness lives in `harness/` and changes only with a coordinator's say; suites work
   around a gap inside their own file and report it.
6. Devtools: `provideQueryDevtools()` enables the bridge process-wide on its first call and it
   stays on for the rest of the file. Put every describe without devtools first, pass the
   providers as a factory (`providers: () => [provideQueryDevtools()]`), and assert
   `isQueryDevtoolsEnabled()` in both halves. Mocks, faults, envs and the tab-local flag are
   module state: clear them in `beforeEach` and give each test its own route and provider name.

The plan and open items are in `plans/query-scenario-tests.md` while the layer is being
built out.
