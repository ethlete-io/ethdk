# Query stacks & pagination

Stacks compose **many queries of the same creator** into one reactive object — for parallel detail requests, infinite lists and classic pagination. They work with any [query creator](/query/queries#query-creators), HTTP or GraphQL.

## Query stacks

`createQueryStack` runs one creator with reactive args that may produce several parallel queries (return an array from `args`) and aggregates their state:

```ts
import { createQueryStack, transformArrayResponse } from '@ethlete/query';

const postsStack = createQueryStack({
  queryCreator: getPost,
  args: () => this.postIds().map((postId) => ({ pathParams: { postId } })),
  transform: transformArrayResponse,
});
```

| Option            | Default       | Description                                                                                               |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| `queryCreator`    | — (required)  | The creator to run.                                                                                       |
| `args`            | — (required)  | Reactive fn returning one args object, an array (one query each), or `null` (ignored).                    |
| `dependencies`    | —             | Reactive deps passed to `args`; a change **clears** the stack.                                            |
| `features`        | `[]`          | [Features](/query/features) applied to every query. `withArgs`/`withResponseUpdate` are not allowed here. |
| `append`          | `false`       | Append new queries instead of replacing (infinite lists).                                                 |
| `appendFn`        | append to end | Controls merge order in append mode.                                                                      |
| `transform`       | identity      | Maps the array of responses (`transformArrayResponse`, `transformPaginatedResponse`).                     |
| `deduplicateArgs` | `true`        | Skip queries whose args (via `argsKeyFn`, default `JSON.stringify`) already exist.                        |
| `maxQueries`      | `Infinity`    | Evict via `removeStrategy` (`'oldest'` default, or `'newest'`).                                           |

The stack exposes aggregate signals (`queries`, `response`, `anyLoading`, `allLoading`, `loadingProgress`, `anyError`, `errors`, `firstQuery`, `lastQuery`) and methods `execute({ allowCache? })`, `retryFailed()`, `clear()`.

## Paged queries

`createPagedQueryStack` builds paged/infinite lists on top of a stack. A `responseNormalizer` maps your backend's pagination shape to a normalized one; adapters for common shapes ship with the package: `ethletePaginationAdapter`, `ggLikePaginationAdapter`, `dynLikePaginationAdapter`, `contentfulGqlLikePaginationAdapter` and `fakePaginationAdapter` (testing).

```ts
import { createPagedQueryStack, ethletePaginationAdapter } from '@ethlete/query';

const postPages = createPagedQueryStack({
  queryCreator: getPosts,
  responseNormalizer: ethletePaginationAdapter,
  args: (page) => ({ queryParams: { page, limit: 20 } }),
});
```

| Option                        | Default      | Description                                                                                           |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| `queryCreator`                | — (required) | The page query creator.                                                                               |
| `responseNormalizer`          | — (required) | Maps a response to `{ items, totalPages, currentPage, itemsPerPage, totalHits }`.                     |
| `args`                        | — (required) | `(page, allResponses) => RequestArgs \| null`; reactive — a signal change resets to the initial page. |
| `features`                    | `[]`         | Applied to every page query.                                                                          |
| `initialPage`                 | `1`          | First page loaded — pages can then be fetched in **both** directions.                                 |
| `blockExecutionDuringLoading` | `false`      | Ignore fetch calls while a page is loading.                                                           |

The paged stack exposes `items`, `loading`, `error`, `isFirstLoad`, `canFetchNextPage` / `canFetchPreviousPage`, `isLastPageLoaded` / `isFirstPageLoaded` and `maxPagination` / `minPagination`, plus:

- `fetchNextPage()` / `fetchPreviousPage()`
- `reset({ initialPage? })`
- `execute({ where?, allowCache? })` — `where: (item) => boolean` selectively re-executes the pages containing matching items (plus their neighbors), e.g. after editing one row.

## Live demo

The demo starts at page 4 of 8, so both fetch directions are available:

<StoryEmbed id="query-demos-paged-query--default" height="480px" />
