---
'@ethlete/query': major
---

Error-response parsing and the default retry policy are now opt-in query client features. A client
without them reads the plain `string` / `{ message }` / `{ detail }` / `string[]` ladder and retries
nothing - which takes ~1.4 kB gz (12 % of the `createQueryClient` + `createGetQuery` entry) out of an
app that never needed the rest.

- `withHtmlErrorParsing()` - recovers the sentence out of an HTML error page (a proxy's 502, a
  maintenance page).
- `withSymfonyErrors()` - Symfony/API-Platform violation lists, bare violation arrays and
  class-validator `{ message: string[] }`.
- `withDefaultRetry()` - the `shouldRetryRequest` policy for every request without its own `retryFn`.
  Without it `error.retryState` always reads `{ retry: false }`.
- `withEthleteApiErrors()` - all three, i.e. the previous behavior.
- `registerQueryErrorParser(parser)` - for a body shape the SDK does not know.

**Migration:** run `npx nx g @ethlete/query:migrate-query-opt-in-features` to add
`withEthleteApiErrors()` to every `createQueryClient` (behavior preserving), or
`--reportOnly` to only list the affected call sites first. Then narrow it: an API that
answers JSON only does not need `withHtmlErrorParsing()`, and an app that handles its own
failures does not need `withDefaultRetry()`.

Also: `createPagedQueryStack().execute({ where })` no longer calls `shouldRetryRequest` to decide
whether to re-run an errored page - it re-runs every errored page, which is what the previous check
did in practice (its result was always truthy).
