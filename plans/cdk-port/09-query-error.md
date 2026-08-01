# 09 - Query error

**Status: DONE (2026-07-30).** Size: S (smaller than the S–M estimate - see below).
Research done 2026-07-23 against `libs/cdk/src/lib/components/query-error/`
(~280 lines). Shipped net-new in `libs/components/src/lib/query-error/`. cdk
query-error untouched.

## What cdk ships today

`et-query-error` (headless directive + thin component): classifies
`error.detail` by shape (class-validator arrays, Symfony violation lists via
`@ethlete/types`, generic `{message}`, dev-mode `{detail}`, plain string,
status-code fallback), renders title + message(s) list + conditional Retry
button (`extractQuery(query).execute({ skipCache: true })`, retryability via
`v2ShouldRetryRequest`). i18n = hardcoded EN/DE string tables in
`@ethlete/query` selected by a `language` input. No CSS shipped.

## The finding that shrank the job

The plan assumed the classifiers had to be re-used and the error walked by hand.
They don't: **the current query client already does all of it.**
`createQueryErrorResponse` (in `libs/query/src/lib/http/query-error-response.ts`)
runs the same shape classifiers cdk called, and `query.error()` returns the
result with the retry policy's verdict already attached as `retryState`. So the
directive reads a normalized error instead of producing one - which is also what
makes it client-agnostic, since it never names a client's types.

## What shipped

| File                                      | Role                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `headless/query-error.directive.ts`       | State: title, messages, `isList`, `canRetry`, `retry()`       |
| `headless/query-error-slots.directive.ts` | `etQueryErrorTitle` / `etQueryErrorActions`                   |
| `query-error.component.ts/html/css`       | The themed default panel                                      |
| `query-error-labels.ts`                   | Locale-derived strings + `provideQueryErrorLabels`            |
| `query-error-legacy.ts`                   | `legacyQueryErrorSource`, `queryErrorResponseFromLegacyError` |
| `query-error.types.ts`, `-errors.ts`      | `QueryErrorView`, `QueryErrorRetryTarget`; `ET4000`           |

Plus `apps/docs/components/query-error.md` (+ sidebar, overview, error codes), 5
stories, a `minor` changeset, 10 unit tests.

## Carried over as planned

- Modelled on `stream-player-error`: headless directive via `hostDirectives`,
  the components-lib `ButtonComponent` + `IconDirective`, surface tokens for
  text.
- **`injectLocale()` instead of a `language` input** - cdk's weakest API point.
  EN/DE ship (those are the only tables `@ethlete/query` has); any other locale
  goes through `provideQueryErrorLabels`.
- Rendering parity: status title, single message vs `<ul>` list, the title-dedup
  heuristic, retry that bypasses the cache.
- **A11y added**: `role="alert"` on the host (cdk had none), `aria-hidden` icon,
  real `<ul>` for violation lists.
- **Themed styling added** (cdk shipped no CSS): the panel provides the app's
  `type: 'error'` theme as a colour scope on its own host via
  `injectErrorTheme()` + `ProvideColorDirective.forceColor`, so the tint, border
  and icon all follow the app's theme and the retry button inherits it without
  being told. `@layer components`, 7 public tokens.
- **Slots**: replaceable title and actions row, error in scope in both.

## Deviations (deliberate)

- **Legacy support is an adapter, not a union input** (the decision asked for at
  planning time; confirmed with the team 2026-07-30). `legacyQueryErrorSource`
  converts a legacy `RequestError` by handing its `httpErrorResponse` to the
  current client's normalizer - so both clients are described by one
  classification path, and this one file is all there is to delete when the last
  legacy query goes.
  - The adapter takes the **error**, not the query, because legacy query state is
    an `Observable` and how an app gets from `state$` to a signal is its own
    choice.
- **A third "useless message" case handled**: when a response carries no message
  at all, the query client falls back to Angular's `HttpErrorResponse.message`
  (`'Http failure response for /api/x: 500 Error'`). cdk never saw it because it
  classified `detail` itself. Rendering it would put developer text in front of a
  reader, so it is replaced by the status table's sentence. Found by a unit test,
  not by inspection.
- **`alwaysAllowRetry`** added: the policy is right nearly always, and an escape
  hatch is cheaper than arguing with it.
- `retryRequest` output (present-tense naming rule) fires with or without a
  `query`, so a retry can be handled entirely by the consumer.

## Verification

- 10 unit tests: each response shape, the two dedup cases, the retry gate and its
  cache-bypassing execute args, German locale, legacy conversion.
- Driven headlessly in Storybook across all five stories: `role="alert"`,
  `data-status`/`data-list`, violation list rendering, retry appearing only for
  the 503 and calling `execute`, the 500-with-no-body case showing the status
  sentence, the locale button switching both title and button label, both slots
  replacing their default, and the colour scope resolving to the app's error
  theme (`et-color--danger`, tint `rgb(220 38 38 / 0.08)`). No console errors.
