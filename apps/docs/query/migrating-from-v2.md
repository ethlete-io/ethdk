# Migrating from the legacy client

A practical walkthrough of moving a workspace from the [legacy `V2QueryClient`](/query/legacy) to the current system. The [legacy page](/query/legacy#migrating-to-the-current-system) has the API-to-API map; this one covers the parts that actually take the time - the things that compile fine and then behave differently, or don't compile at all for reasons the type error doesn't explain.

The realistic order is: **prepare → run the codemod → make it boot → migrate screens**. Only the last step is open-ended, and the interop layer is what lets you stop in the middle of it.

## 1. Prepare and run the generators

```bash
yarn nx g @ethlete/query:prep-for-query-v3   # rename colliding legacy symbols, then upgrade the package
yarn nx g @ethlete/query:migrate-to-query-v3
```

`migrate-to-query-v3` converts clients, generates current-system creators, wraps them in `legacy*` interop creators, rewrites `.prepare()` call sites, and writes **`query-v3-migration-tasks.md`** - a task list with stable ids for everything it could not finish. Read that file before reading the diff.

In a monorepo, scope the run instead of rewriting every app at once:

```bash
yarn nx g @ethlete/query:migrate-to-query-v3 --projects=queries-hub,domain-hub
yarn nx g @ethlete/query:migrate-to-query-v3 --include=libs/queries
```

One coupling cannot be split: a query client and the creators built on it must be migrated in the same run, because the creators are rewritten in terms of the client's generated `xGet` / `xPostSecure` helpers.

### The remaining work is visible in the editor

Every legacy export is `@deprecated`, and each `legacy*` wrapper the codemod writes carries a tag naming the current-system creator to move to. Nothing fails to compile - the tag exists so that "what is still on v2" is strikethrough in the editor rather than a grep, and so the count shrinks visibly as you work through step 4.

Workspaces that ran the codemod before the tags existed can add them to wrappers already in source:

```bash
yarn nx g @ethlete/query:deprecate-legacy-queries
```

It takes the same `--projects` / `--include` scoping, skips anything already tagged, and is safe to re-run.

## 2. Make it boot

Three things are the difference between "it compiles" and "it works".

### `provideHttpClient()` is now your job

The legacy client shipped its own transport. The current one does `inject(HttpClient)`, and `@ethlete/query` never provides it - an app that never needed `provideHttpClient()` will build cleanly and then throw on its first request.

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
```

If anything in the app relies on **upload progress** (`reportProgress` on a creator), use `provideHttpClient(withXhr())`: from Angular 22 on the default backend is `fetch`, which emits download progress but no upload progress events.

### Configure the auth provider

The generator scaffolds a [`createBearerAuthProvider`](/query/auth) from your `V2BearerAuthProvider` config where it can find one, but the adapters change shape between versions, so it emits them behind `TODO(query-v3)` comments. The mapping is:

| v2 `refreshConfig`           | v3                                                                |
| ---------------------------- | ----------------------------------------------------------------- |
| `queryCreator`               | `withRefreshQuery('tokenRefresh', { queryCreator })`              |
| `responseAdapter`            | `extractTokens` - must return `{ accessToken, refreshToken }`     |
| `requestArgsAdapter`         | `buildArgs` - receives the refresh token alone                    |
| `cookieName` / `cookie*`     | `withPersistentAuth({ cookie: { name, domain, expiresInDays } })` |
| `expiresInPropertyName`      | `expiresInPropertyName` on the refresh query                      |
| `strategy` / `refreshBuffer` | `refreshStrategy` (percentage of lifetime, clamped)               |

Two layout rules follow from this:

- **Auth queries belong in the client file.** The provider needs the login and refresh creators, and the secure creators need the provider. If the creators stay in a separate `auth.queries.ts` that imports the client, the two files form an import cycle. Define them above the provider, and let `auth.queries.ts` import them back for its `legacy*` wrappers.
- **Nothing goes into `app.config.ts`.** Both the client and the auth provider are root-provided the moment something injects them; the `provide` half of the tuple exists for tests and overrides.

### Default headers move onto the client

`setDefaultHeaders({ headers, refreshQueriesInUse })` has no method equivalent. Client-wide headers are configuration now, and a function form re-reads on every request - so a signal can drive them:

```ts
const previewToken = signal<string | null>(null);

const API = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com',
  headers: () => {
    const token = previewToken();

    return token ? new HttpHeaders({ 'X-Preview-Token': token }) : new HttpHeaders();
  },
});

export const injectApi = toInjectFn(API);
```

Per-query `args.headers` are merged on top and win per header name. Client headers are deliberately **not** part of the cache key, so changing them does not invalidate anything by itself - that is what `refreshQueriesInUse: true` used to do, and it is now an explicit call:

```ts
previewToken.set(token);
injectApi().refreshQueriesInUse(); // re-runs every bound GET/HEAD/OPTIONS, in flight ones included
```

An `HttpInterceptor` also works, but it only affects _subsequent_ requests - anything already resolved keeps data fetched under the old header.

## 3. Migrate screens

### Templates read signals, not directives

`*etQuery`, `<et-query-error>` and the query button directives are legacy-only **by design**. A current-system query already exposes everything they computed, so a template reads it directly:

```html
@if (postQuery.loading()) {
<et-spinner />
} @else if (postQuery.error(); as error) {
<p class="error">{{ queryErrorMessage(error) }}</p>
} @else if (postQuery.response(); as post) {
<h1>{{ post.title }}</h1>
}
```

`executionState()` is the `@switch`-friendly form of the same thing, and it distinguishes "loading with a cached response" from "loading with nothing to show":

```html
@switch (postQuery.executionState()?.type) { @case ('loading') {
<et-spinner />
} @case ('failure') {
<p>{{ queryErrorMessage(postQuery.error()) }}</p>
} @case ('success') {
<h1>{{ postQuery.response()!.title }}</h1>
} }
```

[`queryErrorMessages(error)`](/query/errors#rendering-error-messages) flattens the single/list split of a `QueryErrorResponse` into a plain string array; `queryErrorMessage(error)` takes the first one. Use them instead of hand-rolling the branch.

`[etInfinityQuery]` has no replacement either - infinite lists are [paged query stacks](/query/stacks#paged-queries) now.

### Devtools keep their markup

Both versions render `<et-query-devtools>`, so templates need no change. Only two things move, and the generator does both:

- the per-client `provideQueryClientForDevtools({ client, displayName })` calls collapse into a single `provideQueryDevtools()` - v3 registers every client and auth provider at once;
- `QueryDevtoolsComponent` is imported from `@ethlete/query-devtools` instead of `@ethlete/query`, so that package has to be a dependency of the app.

### Query collections become `executionState`

A v2 query collection tracked "which of these queries is currently doing something". For auth that role belongs to [`provider.executionState()`](/query/auth#execution-state); for everything else, read the queries' own `executionState()` signals and combine them in a `computed`.

### `prepare()` needs an injector

The interop layer builds a real query underneath, so `prepare()` needs an injection context - v2 did not. Every call site that prepared a query lazily (a DOM handler, an RxJS callback, a plain factory) has to pass one:

```ts
private injector = inject(Injector);

search = (term: string) => legacyFindPeople.prepare({ queryParams: { term }, injector: this.injector });
```

Two failure modes, both now reported clearly instead of as a bare `NG0203` / `NG0205`:

- **No injector at all** throws an `ET950` error naming the creator - by its `name`, or by the endpoint it was built from (`GET /person`) when it has none. Only Angular's NG0203 is translated this way; any other DI failure (an injector mid-teardown, a missing provider) surfaces unchanged, because "called outside of an injection context" would send you after the wrong thing.
- **A destroyed injector** - a captured component injector used by a callback that outlived the component, e.g. a debounced search resolving after navigation - logs a dev-mode warning and returns an **inert query**: it never executes, its signals stay empty, and tearing it down is a no-op. That is deliberate; a search firing during teardown is not a programming error worth crashing over. If you see the warning regularly, guard the call site with `DestroyRef.onDestroy` or capture an injector that outlives it.

`nx g @ethlete/query:migrate-to-query-v3` threads the injector for you, and
[`ethlete/no-legacy-prepare-without-injector`](/eslint/rules#no-legacy-prepare-without-injector) keeps the
next callback you write from regressing - both classify by the **innermost** function boundary, so a
`prepare()` inside a `computed()` at a class field counts as needing one even though the field initializer
itself has a context.

The container factories take the same escape hatch, in their config rather than their args - `createSubject`,
`createSignal` and `behaviorSubject` all accept `{ injector }`, and throw the same named `ET950` without one:

```ts
private injector = inject(Injector);

peopleQuery = legacyFindPeople.createSubject(null, { injector: this.injector });
```

#### Opting out of the requirement entirely

`provideLegacyPrepareFallback()` lets `prepare()` fall back to the application's root injector instead of
throwing, for a migration with too many call sites to thread by hand:

```ts
bootstrapApplication(AppComponent, {
  providers: [provideLegacyPrepareFallback()],
});
```

Two things degrade when the fallback is used, both matching v2: the query's lifetime becomes the
application's - nothing tears it down when a component dies, so cleanup rests on a query container or
`config: { destroyOnResponse: true }` - and the devtools lose the host element for "inspect".

It is **browser only** by design. A module-global injector shared across concurrent server-side renders
would leak one request's data into another, so it refuses to stash anything on the server and `ET950` still
throws there. Passing `injector` at the call site stays the better answer where you can.

With several applications on one page, the first one that provided the fallback answers every `prepare()`
made outside an injection context - whichever application made the call - until it is destroyed, and dev
mode warns when a second application registers.

## Behavior worth knowing before you debug it

- **Secure queries wait for a token.** A secure query executed before login does not fail - it parks until `accessToken()` is set, then runs. Don't gate them on `isAuthenticated()` by hand.
- **`withPersistentAuth` calls `tryLogin()` during setup.** The cookie-backed session restore happens on its own; you do not need a `tryLoginViaCookie()` call in an app initializer. A failed restore surfaces as `executionState()` with `type: 'autoLogin'`, `state: 'error'`.
- **`logout()` clears the queries bound to it.** It drops the tokens, tears down every secure cache entry, and resets the secure queries still holding a response - a component mounted across the logout stops showing the previous user's data without a manual `reset()`.
- **Responses survive a re-execution and a failed refresh.** `response()` is kept while a query re-runs and remains available if that run fails.
- **Interop containers follow the request method again.** `createSignal` / `createSubject` default their cleanup (`abortPrevious`, `stopPreviousPolling`, `abortOnDestroy`) to "on for cacheable requests", and an interop query now answers that question from its creator. A superseded `GET` is aborted and stops polling, and a container's teardown destroys the query it holds - so a one-shot query stored in a container does not also need `destroyOnResponse`.
- **An `entity` config only sees real responses.** `set` runs on success - including a 204, whose body is legitimately `null` - and never on `prepare()` or on a failure that left a previous response in place.

## The `Any*` types

After `prep-for-query-v3` a workspace has several escape-hatch types in scope. They are not interchangeable:

| Type                    | What it accepts                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `AnyQuery`              | Any **current-system** query (`Query<TArgs>`).                                                                              |
| `AnyV2Query`            | Any **legacy** query built by `V2QueryClient` (`.prepare()` / `.state$`).                                                   |
| `AnyLegacyQuery`        | Any **interop** query - a current-system query behind the legacy surface, produced by a `createLegacyQueryCreator` wrapper. |
| `AnyQueryCollection`    | `{ type, query }` where `query` is an `AnyV2Query` or an `AnyLegacyQuery`.                                                  |
| `AnyBearerAuthProvider` | Any auth provider, with its query keys erased.                                                                              |

The one to avoid where you can is `AnyBearerAuthProvider`: with the keys erased, `provider.queries` degrades to an index signature and every access needs bracket syntax under `noPropertyAccessFromIndexSignature`. Derive the real type instead:

```ts
export const authProviderRef = createBearerAuthProvider({/* … */});
export type ApiAuthProvider = BearerAuthProviderOf<typeof authProviderRef>;

const doLogin = (provider: ApiAuthProvider) => provider.queries.login.execute({ body });
```

## Generic helper code

In code generic over `TArgs`, TypeScript cannot see that an argless query's `RequestArgs<TArgs>` is `{}`. Omit the argument where you can - `query.execute()` and `provider.queries.login.execute()` both take none - and use `emptyQueryArgs<TArgs>()` where a value is required:

```ts
const runAnything = <TArgs extends QueryArgs>(query: Query<TArgs>) => query.execute({ args: emptyQueryArgs<TArgs>() });
```
