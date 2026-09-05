# Errors & retries

## The error object

Failed requests resolve to a **`QueryErrorResponse`** on [`query.error()`](/query/queries#the-query-object): `{ raw: HttpErrorResponse, code: number, retryState }` plus a normalized message - either a single message (`isList: false`, `error.message`) or a violation list (`isList: true`, `errors[].message`).

Out of the box the normalizer reads the shapes every API has: `{ message }`, `{ detail }`, plain strings and string arrays - so templates can render error messages without caring about the backend flavor.

### Opt in to the shapes your API answers with

Everything beyond that ladder is a **query client feature**, because an app that never sees a shape should not ship the code that reads it:

| Feature                  | Teaches the pipeline                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `withHtmlErrorParsing()` | [HTML error pages](#html-error-pages) - a proxy's `502`, a maintenance page (~0.9 kB gz).                                     |
| `withSymfonyErrors()`    | Symfony/API-Platform violation lists (`{ violations: [...] }`), bare violation arrays, and class-validator `{ message: [] }`. |
| `withDefaultRetry()`     | The [default retry policy](#retries). Without it nothing is retried and `retryState` always reads `{ retry: false }`.         |
| `withEthleteApiErrors()` | All three at once - the pre-6.0 behavior, and the right default for a Symfony backend behind a proxy.                         |

```ts
export const MY_CLIENT = createQueryClient({
  name: 'my-api',
  baseUrl: API_URL,
  features: [withSymfonyErrors(), withDefaultRetry()],
});
```

The parsers are installed process-wide rather than per client: which body shapes an app understands is a property of the app, not of one of its APIs. The retry policy is not. It stays on the client whose `features` name it, so a second client keeps its own policy, or none at all. For a shape the SDK does not know, register your own parser - it runs ahead of the built-in ladder, and returning `null` passes the body on to the next one:

```ts
registerQueryErrorParser((detail) =>
  isObject(detail) && 'errorCode' in detail ? [translate(detail.errorCode as string)] : null,
);
```

### HTML error pages

With `withHtmlErrorParsing()` (or `withEthleteApiErrors()`) installed: not every failure answers with JSON - a proxy's `502`, a load balancer's maintenance page or a platform's "service temporarily unavailable" arrive as a full HTML document. Rendering that as the message would dump markup into the UI, so the normalizer picks the readable text out of it instead:

- the first **heading** (or the `<title>` when the page has none), plus the first **paragraph** that says something new - `Service Temporarily Unavailable: The server is currently restarting.`
- unusually structured pages fall back to the page's flattened text; `<script>`/`<style>` contents never make it in,
- the result is always **plain text** (entities decoded, tags dropped, capped at 300 characters), so bind it as text - never as `innerHTML`,
- a page with no readable text at all leaves the `HttpErrorResponse`'s own message in place.

Parsing is string-based, not `DOMParser`-based, so it works during SSR and the markup never touches a DOM. Both shapes that carry a page are covered: the raw string body of a failed response, and the `{ error, text }` wrapper Angular's XHR backend produces when a `200` response fails to parse as JSON (a proxy page served with a success status).

Reach for the underlying helpers if you handle a body yourself: **`isHtmlErrorPayload(value)`** (strict - a message containing a stray `<` is not markup), **`htmlErrorPayload(body)`** (unwraps either shape, `null` otherwise) and **`extractHtmlErrorMessage(html)`**.

### Rendering error messages

The single/list split exists because that is how APIs answer; UI almost never wants to branch on it. `queryErrorMessages(error)` flattens both into a plain `string[]` (empty for `null`), and `queryErrorMessage(error)` takes the first one:

```html
@for (message of queryErrorMessages(createUserQuery.error()); track message) {
<p class="error">{{ message }}</p>
}
```

Keep the `QueryErrorResponse` itself for anything that needs the status code (`code`), the retry state, or the raw `HttpErrorResponse`.

## Submitting a form through a mutation

`createQuerySubmission` is the whole submit path in one call: it creates the mutation, builds a signal form's `submission.action` around it, and maps a failed request's violations back onto the fields that caused them.

```ts
import { form } from '@angular/forms/signals';
import { createQuerySubmission } from '@ethlete/query';

private model = signal({ name: '', email: '' });

protected createUser = createQuerySubmission({
  queryCreator: createUser, // a createPostQuery creator, see the HTTP guide
  args: (value) => ({ body: value }),
  onSuccess: (user) => this.router.navigate(['/users', user.id]),
});

protected form = form(this.model, createUserSchema(), {
  submission: { action: this.createUser.action },
});
```

```html
<form [etForm]="form">…</form>
<et-query-error [error]="createUser.query.error()" [query]="createUser.query" />
```

Submitting executes the query, waits for it to settle, and only then resolves - so `form().submitting()` covers the whole round trip, and `[etForm]` keeps a second submit out while it does. A submit whose request is cancelled - a logout, an evicted cache entry, a destroyed component - settles as well, as a form-level error saying the request was cancelled, so the form never stays stuck submitting. The request's args come from the submitted value rather than a `withArgs()` feature, which means no derivation runs per keystroke and the query no longer reads the form it belongs to (declare it above the form, not below).

| Option          | What it does                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `queryCreator`  | The mutation. Created once, here - a function route needs no `silenceMissingWithArgsFeatureError` of your own.                |
| `args`          | Builds the request args from the submitted value. Return `null` to abort without a request; omit for a route that takes none. |
| `onSuccess`     | Runs after the request succeeded, before the action resolves - notify, close the overlay, navigate. A `204` hands it `null`.  |
| `rewritePath`   | Rewrites a violation's property path before it is resolved against the field tree.                                            |
| `mapViolations` | Replaces the default violation → error mapping entirely.                                                                      |

It returns `{ query, action }`: hand `action` to the form and keep `query` for an error banner - never execute it yourself, or the form's submitting state stops matching what the query is doing.

## Mapping violations onto signal forms

`createQuerySubmission` does this for you; reach for the pieces below when you submit through your own handler. When a mutation fails with a violation list (Symfony-style `{ violations: [{ propertyPath, message }] }`), `mapViolationsToFormErrors` turns it into signal-forms validation errors, resolved against your form's field tree - return its result from a [`submit()`](https://angular.dev/guide/forms) action and each violation lands on the field its `propertyPath` names:

```ts
import { form, submit } from '@angular/forms/signals';
import { executeUntilSettled, mapViolationsToFormErrors } from '@ethlete/query';

createUserQuery = createUser(); // a createPostQuery creator, see the HTTP guide

protected form = form(signal({ name: '', email: '' }));

protected async save() {
  await submit(this.form, async (field) => {
    const snapshot = await executeUntilSettled(this.createUserQuery, { args: { body: field().value() } });
    const error = snapshot.error();

    if (!error) return;

    return mapViolationsToFormErrors({ fieldTree: field, error });
  });
}
```

- **`executeUntilSettled(query, executeArgs?)`** executes the query and resolves with a settled [snapshot](/query/queries#the-query-object) once the execution completes - the snapshot is frozen to that execution, so a later one can't swap the `response()` / `error()` you read. A cancelled execution settles too, reporting an `error()` that says the request was cancelled.
- **`mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })`** accepts the error in any shape it may reach you: a `QueryErrorResponse`, a raw `HttpErrorResponse`, an error body, or a plain violation array (there's also a standalone `extractFormViolations(error)` if you only need the list). Each violation's `propertyPath` - dot and bracket notation, e.g. `items[2].name` - is resolved against `fieldTree`:
  - **Resolved** → an error with `kind: 'etServerViolation'`, the violation's `message`, and the matched field. Signal forms shows it on that field and clears it when the field is edited.
  - **Unresolved** (no matching field, or a `null` path) → a form-level error on the submitted field by default; pass `onUnmappedViolation` to replace it (return `null` to drop the violation).
  - **Path mismatch between API payload and form model?** `rewritePath: (path, violation) => string | null` rewrites paths before resolution.
- A failure **without** violations (e.g. a plain 500) degrades to form-level errors with `kind: 'etServerError'` built from the normalized message - so a failed submit is never silently treated as success.

The [forms guide](/components/forms#server-side-violations) shows the rendering side, including the `provideFormErrorMessageResolver` hook for centralizing/localizing error texts by `kind`.

### Validating against the server as the user types

The `submit()` flow above maps violations at write time. To validate a field
against the server **before** submit - uniqueness, cross-entity or server-clock
checks - use `validateWithQuery`, the query-backed counterpart of Angular's
[`validateAsync`](https://angular.dev/guide/forms). It runs your query through
the query client (so auth, base route, caching and error normalization all
apply, unlike a raw `httpResource`) and reuses `mapViolationsToFormErrors` to
place each violation on its field:

```ts
import { schema, form } from '@angular/forms/signals';
import { validateWithQuery } from '@ethlete/query';

emailValidate = postEmailValidate(); // a createPostQuery creator, see the HTTP guide

emailSchema = schema<{ email: string }>((p) => {
  validateWithQuery(p, {
    queryCreator: this.emailValidate,
    args: (ctx) => ({ body: { ...ctx.value() } }),
  });
});

protected form = form(signal({ email: '' }), this.emailSchema);
```

- **`queryCreator`** runs once and re-executes (debounced) as the field value
  changes - only after the field's synchronous validators pass. Point `args` at
  the field context: `(ctx) => ({ pathParams, body: { ...ctx.value() } })`.
- A **`204` / success** reports no errors; a **`422` violation list** maps onto
  the child fields by `propertyPath`; a **network / other error** degrades to a
  non-swallowed form-level error - the same mapping as `mapViolationsToFormErrors`.
- **`debounce`** (default `300` ms), **`when`** (gate the request) and
  **`mapViolations`** (override the violation → error step) tune the behavior.
- **On the legacy `V2QueryClient`?** Use **`validateWithV2Query`** - same
  signature and behavior, for `V2Query` creators (`hubApiClient.post(...)`).

## A `transformResponse` that throws

The wire response arrived, but the creator's `transformResponse` could not map it. The query does not stay in `loading()` and `response()` does not throw on read: it reports a `failure` whose `error()` carries the thrown value as `raw.error` with code `0`, and `response()` stays at whatever the last good response was. It is never retried - the server did answer - and the next execution that transforms cleanly clears it. `withSuccessHandling` does not run for such a response - it would otherwise repeat the last good one. `withErrorHandling` and `events$` see the HTTP events the request received, so they report the response, not the transform failure.

## Retries

Retrying is opt-in: add `withDefaultRetry()` (or `withEthleteApiErrors()`) to the client's `features`, or bring your own `retryFn`. Without either, a failed request is not retried. The policy applies to that client only, and a `retryFn` on the client or on a creator wins over it.

The default policy (`shouldRetryRequest`) retries up to **3 times**, doubling the delay each time (2s, 4s, 8s) and spreading each one randomly over ±25% so the tabs that failed together do not retry together:

- status `0` - a connection failure: offline, DNS, CORS, a dropped request,
- `5xx` from `501` upwards (except a Symfony Pagerfanta out-of-range error),
- `408` (timeout), `425` (too early), `429` (honoring `retry-after` / `x-retry-after` headers, capped at the max delay).

`500` is deliberately not retried: an internal server error is a bug in the backend far more often than a blip, and repeating the request that triggered it does not make it go away.

### Configuring it

`withDefaultRetry()` takes the policy's numbers, and `createDefaultRetryFn()` builds the same policy as a `retryFn` for a single client or creator:

```ts
features: [withDefaultRetry({ maxAttempts: 5, maxDelayMs: 10_000 })];
```

| Option                 | Default                          | What it does                                                               |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `maxAttempts`          | `3`                              | How many retries. `0` retries indefinitely - see the warning below.        |
| `baseDelayMs`          | `1000`                           | The delay doubles per retry, starting at twice this.                       |
| `maxDelayMs`           | `30000`                          | Upper bound of every delay, including one a `retry-after` asked for.       |
| `jitter`               | `0.25`                           | How far the delay is spread around its computed value. `0` makes it exact. |
| `retryableStatusCodes` | `0`, `408`, `425`, `429`, `501`+ | Replaces the retryable statuses rather than adding to them.                |

::: warning `maxAttempts: 0` never surfaces an error
A query that retries forever never resolves to a `failure`: it stays `loading()` for as long as the server stays down, so a screen gated on `executionState()` shows a spinner and nothing else - no error, no retry button. Only ever right for a request nothing renders, which is why the [token refresh](/query/auth#token-refresh) uses it and the default policy does not.
:::

Override the policy per client (the `retryFn` [client option](/query/queries#the-query-client)) or per creator (the `retryFn` [creator option](/query/http#creator-options), or `.clone({ retryFn })`):

```ts
const getFlakyReport = myApiGet<GetReportArgs>('/report').clone({
  retryFn: createDefaultRetryFn({ maxAttempts: 8 }),
});
```

A `retryFn` belongs to the request, and a request is shared by every query with the same [cache key](/query/caching). When two creators for the same URL disagree, the `retryFn` of whichever consumer created the entry first governs it - a consumer binding to the existing entry later cannot change it.

### A retry nobody is waiting for is dropped

A request retries only while something is bound to it. When the last consumer of a query goes away mid-retry, the cache entry keeps whatever response it already had - so a consumer coming back still renders instantly - but the request itself is cancelled rather than left retrying into an empty room. A returning consumer re-executes as usual.

## Error codes

Misuse throws dev-mode `RuntimeError`s with numeric codes, grouped by area:

| Range     | Area                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–199     | Query core - e.g. a feature used twice, `withPolling` on a `POST`, a function route without `withArgs`.                                                                                                                   |
| 800       | A circular query dependency: the same query ran with identical args more than five times in a row, each run less than 100 ms after the last. Fast runs with _different_ args (a search box, a slider) never count.        |
| 200–299   | [Auth](/query/auth#error-codes) - missing token properties, an auth feature used twice.                                                                                                                                   |
| 400–499   | [Paged query stacks](/query/stacks#paged-queries) - e.g. fetching past the last page.                                                                                                                                     |
| 500–599   | [Query stacks](/query/stacks#query-stacks) - e.g. `withArgs` passed as a stack feature.                                                                                                                                   |
| 900–999   | [Query sequences and batches](/query/batching) plus [legacy interop](/query/migrating-from-v2#prepare-needs-an-injector) - e.g. a second `run()` while one is in flight, or `prepare()` called with no injection context. |
| 1000–1999 | [WebSockets](/query/ws#error-codes) - leaving a room that was never joined, malformed messages.                                                                                                                           |

The error message names the problem and the fix; the codes exist so you can grep for them.
