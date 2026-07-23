# 09 — Query error

**Status: planned, not started.** Size: S–M. Research done 2026-07-23 against
`libs/cdk/src/lib/components/query-error/` (~280 lines). Net-new in
`libs/components`.

## What cdk ships today

`et-query-error` (headless directive + thin component): classifies
`error.detail` by shape (class-validator arrays, Symfony violation lists via
`@ethlete/types`, generic `{message}`, dev-mode `{detail}`, plain string,
status-code fallback), renders title + message(s) list + conditional Retry
button (`extractQuery(query).execute({ skipCache: true })`, retryability via
`v2ShouldRetryRequest`). i18n = hardcoded EN/DE string tables in
`@ethlete/query` selected by a `language` input. No CSS shipped.

**Coupling verdict from research**: the `query` input + retry contract is
bound to the **legacy** client's types (`RequestError`, `AnyV2Query`,
`AnyLegacyQuery`, `extractQuery`, `v2ShouldRetryRequest` all live under
`libs/query/src/lib/legacy/`), but the error-shape classifiers
(`isClassValidatorError`, `isSymfonyFormViolationListError`,
`isSymfonyListError`) and the EN/DE code→message tables live in the
**current** `libs/query/src/lib/http/` layer — reusable as-is.

## Rewrite decisions

- **Architectural template**: follow
  `libs/components/src/lib/stream/error/stream-player-error.component.ts` —
  headless directive via `hostDirectives`, surface theming
  (`ProvideSurfaceDirective`/`injectSurfaceThemes`), the components lib's
  `ButtonComponent` and `IconDirective`, and `injectLocale()` for language
  instead of a `language` input (cdk's EN/DE input is the weakest part of its
  API — locale should come from context; keep the tables in `@ethlete/query`).
- **Target the current query client first**: the `query`/error inputs accept
  the current client's query handle + error shape; derive retryability from
  the current client's retry logic. **Legacy support**: like the select/table
  adapters, if a legacy binding is still needed, make it a separate thin
  adapter rather than a union-typed input — decide based on whether consuming
  apps still hold legacy queries in views that would use this component
  (ask/check at implementation time).
- Reuse the existing classifiers + i18n tables from
  `libs/query/src/lib/http/query-error-response-utils.ts` — no duplication.
- Rendering parity: title, single message vs `<ul>` list, title-dedup
  heuristic, Retry button (with `skipCache`). Add proper semantics:
  `role="alert"`/`aria-live="polite"` on appearance (cdk has none).
- Ship themed default styling this time (cdk had none): error color from the
  semantic color theming (`injectErrorTheme()` per the `theming` skill),
  `@layer components`.
- Slots for customization: replaceable title/actions templates so apps can
  extend (e.g. "contact support" link) without forking.

## Deliverables

Headless directive + styled component, stories (single message, violation
list, retryable 500, i18n/locale), docs page
(`apps/docs/components/query-error.md`), changeset. cdk query-error stays
untouched.
