# @ethlete/types

Shared TypeScript types for the Ethlete API — the framework-agnostic base of the SDK. The package contains **no runtime code**: every export is an interface, type alias or string-union type, so importing it adds nothing to your bundle.

```ts
import { MatchListView, MatchStatus, Paginated } from '@ethlete/types';
```

::: info Mostly generated — intentionally not documented per-type
The bulk of the package (everything under `lib/api/`) is **auto-generated from the Ethlete backend** and updated through automated merge requests. Per-type documentation would go stale with every sync, so this page only describes the shape of the package. For a concrete type, the source is the reference: the barrel at [`libs/types/src/lib/api/index.ts`](https://github.com/ethlete-io/ethdk/blob/main/libs/types/src/lib/api/index.ts) lists every export, and your editor's autocomplete shows the fields. Generated files are marked `// Generated Interface, do not change manually!` — never edit them by hand.
:::

## Generated API types

The generated types follow a consistent naming scheme:

| Suffix                           | Meaning                                | Examples                                                        |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| `…View`                          | A response shape returned by the API   | `MatchListView`, `TournamentListView`, `PaginationView`         |
| `…ViewUnion`                     | A discriminated union of related views | `ParticipantViewUnion`, `GameListViewUnion`                     |
| `…RequestData`                   | A request payload / search-param shape | `PaginatedSearchRequestData`, `DateRangeRequestData`            |
| Status / type unions (no suffix) | String-union "enums" for API states    | `MatchStatus`, `TournamentStatus`, `StageType`, `CheckInStatus` |

They are grouped by API domain (`Match`, `Tournament`, `Game`, `Participant`, `Season`, …) but all re-exported flat from the package entry — always import from `@ethlete/types` directly.

## Hand-written types

A small set of types is maintained by hand on top of the generated ones:

- **Pagination wrappers** — generic shapes for paginated responses from different backends:
  - `Paginated<T>` — the standard Ethlete API pagination (`PaginationView` with typed `items`).
  - `NormalizedPagination<T>` — the backend-agnostic shape (`items`, `totalPages`, `totalHits`, `currentPage`, `itemsPerPage`) that `@ethlete/query`'s pagination utilities normalize to.
  - `GgLikePaginated<T>`, `DynLikePaginated<T>`, `ContentfulGqlLikePaginated<T>` — pagination shapes of other backends the SDK integrates with.
- **`FormViolationListView`** — a list wrapper around the generated `FormViolationView`, used for API form-validation errors.

## Where it's used

Every other `@ethlete/*` package sits on top of `types`. Notably, [`@ethlete/query`](/query/) uses the pagination wrappers for [paged queries](/query/stacks), and `@ethlete/cdk`'s bracket component consumes the tournament structure views (`RoundStageStructureWithMatchesView`, `MatchListView`). Apps use the same types to annotate their query responses.
