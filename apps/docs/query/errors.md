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

The features are installed process-wide rather than per client: which body shapes an app understands is a property of the app, not of one of its APIs. For a shape the SDK does not know, register your own parser - it runs ahead of the built-in ladder, and returning `null` passes the body on to the next one:

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

## Mapping violations onto signal forms

When a mutation fails with a violation list (Symfony-style `{ violations: [{ propertyPath, message }] }`), `mapViolationsToFormErrors` turns it into signal-forms validation errors, resolved against your form's field tree - return its result from a [`submit()`](https://angular.dev/guide/forms) action and each violation lands on the field its `propertyPath` names:

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

- **`executeUntilSettled(query, executeArgs?)`** executes the query and resolves with a settled [snapshot](/query/queries#the-query-object) once the execution completes - the snapshot is frozen to that execution, so a later one can't swap the `response()` / `error()` you read.
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

## Retries

Retrying is opt-in: add `withDefaultRetry()` (or `withEthleteApiErrors()`) to the client's `features`, or bring your own `retryFn`. Without either, a failed request is not retried.

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

### A retry nobody is waiting for is dropped

A request retries only while something is bound to it. When the last consumer of a query goes away mid-retry, the cache entry keeps whatever response it already had - so a consumer coming back still renders instantly - but the request itself is cancelled rather than left retrying into an empty room. A returning consumer re-executes as usual.

## Error codes

Misuse throws dev-mode `RuntimeError`s with numeric codes, grouped by area:

| Range     | Area                                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–199     | Query core - e.g. a feature used twice, `withPolling` on a `POST`, a function route without `withArgs`, circular query dependencies.          |
| 200–299   | [Auth](/query/auth#error-codes) - missing token properties, an auth feature used twice.                                                       |
| 400–499   | [Paged query stacks](/query/stacks#paged-queries) - e.g. fetching past the last page.                                                         |
| 500–599   | [Query stacks](/query/stacks#query-stacks) - e.g. `withArgs` passed as a stack feature.                                                       |
| 900–999   | Query sequences and [legacy interop](/query/migrating-from-v2#prepare-needs-an-injector) - e.g. `prepare()` called with no injection context. |
| 1000–1999 | [WebSockets](/query/ws#error-codes) - leaving a room that was never joined, malformed messages.                                               |

The error message names the problem and the fix; the codes exist so you can grep for them.
