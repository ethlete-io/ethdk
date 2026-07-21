# Errors & retries

## The error object

Failed requests resolve to a **`QueryErrorResponse`** on [`query.error()`](/query/queries#the-query-object): `{ raw: HttpErrorResponse, code: number, retryState }` plus a normalized message — either a single message (`isList: false`, `error.message`) or a violation list (`isList: true`, `errors[].message`).

The normalizer understands class-validator errors, Symfony violation lists/list errors, `{ message }`, `{ detail }`, plain strings and string arrays — so templates can render error messages without caring about the backend flavor.

## Mapping violations onto signal forms

When a mutation fails with a violation list (Symfony-style `{ violations: [{ propertyPath, message }] }`), `mapViolationsToFormErrors` turns it into signal-forms validation errors, resolved against your form's field tree — return its result from a [`submit()`](https://angular.dev/guide/forms) action and each violation lands on the field its `propertyPath` names:

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

- **`executeUntilSettled(query, executeArgs?)`** executes the query and resolves with a settled [snapshot](/query/queries#the-query-object) once the execution completes — the snapshot is frozen to that execution, so a later one can't swap the `response()` / `error()` you read.
- **`mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })`** accepts the error in any shape it may reach you: a `QueryErrorResponse`, a raw `HttpErrorResponse`, an error body, or a plain violation array (there's also a standalone `extractFormViolations(error)` if you only need the list). Each violation's `propertyPath` — dot and bracket notation, e.g. `items[2].name` — is resolved against `fieldTree`:
  - **Resolved** → an error with `kind: 'etServerViolation'`, the violation's `message`, and the matched field. Signal forms shows it on that field and clears it when the field is edited.
  - **Unresolved** (no matching field, or a `null` path) → a form-level error on the submitted field by default; pass `onUnmappedViolation` to replace it (return `null` to drop the violation).
  - **Path mismatch between API payload and form model?** `rewritePath: (path, violation) => string | null` rewrites paths before resolution.
- A failure **without** violations (e.g. a plain 500) degrades to form-level errors with `kind: 'etServerError'` built from the normalized message — so a failed submit is never silently treated as success.

The [forms guide](/components/forms#server-side-violations) shows the rendering side, including the `provideFormErrorMessageResolver` hook for centralizing/localizing error texts by `kind`.

### Validating against the server as the user types

The `submit()` flow above maps violations at write time. To validate a field
against the server **before** submit — uniqueness, cross-entity or server-clock
checks — use `validateWithQuery`, the query-backed counterpart of Angular's
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
  changes — only after the field's synchronous validators pass. Point `args` at
  the field context: `(ctx) => ({ pathParams, body: { ...ctx.value() } })`.
- A **`204` / success** reports no errors; a **`422` violation list** maps onto
  the child fields by `propertyPath`; a **network / other error** degrades to a
  non-swallowed form-level error — the same mapping as `mapViolationsToFormErrors`.
- **`debounce`** (default `300` ms), **`when`** (gate the request) and
  **`mapViolations`** (override the violation → error step) tune the behavior.
- **On the legacy `V2QueryClient`?** Use **`validateWithV2Query`** — same
  signature and behavior, for `V2Query` creators (`hubApiClient.post(...)`).

## Retries

The default retry policy (`shouldRetryRequest`) retries up to **3 times** with a delay of `1s + 1s × attempt` (capped at 5s):

- status `0` (offline/CORS) — always retried,
- `5xx` from `501` upwards (except a Symfony Pagerfanta out-of-range error),
- `408` (timeout), `425` (too early), `429` (honoring `retry-after` / `x-retry-after` headers).

Override it per client (the `retryFn` [client option](/query/queries#the-query-client)) or per creator (the `retryFn` [creator option](/query/http#creator-options), or `.clone({ retryFn })`).

## Error codes

Misuse throws dev-mode `RuntimeError`s with numeric codes, grouped by area:

| Range     | Area                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0–199     | Query core — e.g. a feature used twice, `withPolling` on a `POST`, a function route without `withArgs`, circular query dependencies. |
| 200–299   | [Auth](/query/auth#error-codes) — missing token properties, an auth feature used twice.                                              |
| 400–499   | [Paged query stacks](/query/stacks#paged-queries) — e.g. fetching past the last page.                                                |
| 500–599   | [Query stacks](/query/stacks#query-stacks) — e.g. `withArgs` passed as a stack feature.                                              |
| 1000–1999 | [WebSockets](/query/ws#error-codes) — leaving a room that was never joined, malformed messages.                                      |

The error message names the problem and the fix; the codes exist so you can grep for them.
