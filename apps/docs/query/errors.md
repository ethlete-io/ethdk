# Errors & retries

## The error object

Failed requests resolve to a **`QueryErrorResponse`** on [`query.error()`](/query/queries#the-query-object): `{ raw: HttpErrorResponse, code: number, retryState }` plus a normalized message — either a single message (`isList: false`, `error.message`) or a violation list (`isList: true`, `errors[].message`).

The normalizer understands class-validator errors, Symfony violation lists/list errors, `{ message }`, `{ detail }`, plain strings and string arrays — so templates can render error messages without caring about the backend flavor.

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
