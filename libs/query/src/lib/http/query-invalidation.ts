import { HttpEventType } from '@angular/common/http';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryMethod } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import { QueryRepositoryRefreshFilterFn } from './query-repository';
import { QueryState } from './query-state';

/** A query of this client that an invalidation is deciding about. */
export type QueryInvalidationCandidate = {
  /** The HTTP method of the query. Always a cacheable read method. */
  method: QueryMethod;

  /** The full URL of the query, including its query params. */
  url: string;
};

/**
 * Decides whether a query should be refreshed by an invalidation.
 * @see QueryInvalidationOptions.filter
 */
export type QueryInvalidationFilterFn = (query: QueryInvalidationCandidate) => boolean;

/** A root-relative route (`/players`), resolved against the client's `baseUrl`, or an absolute URL. */
export type QueryInvalidationUrl = `/${string}` | `${string}://${string}`;

/** @see QueryClient.invalidateQueries */
export type QueryInvalidationOptions = {
  /**
   * Narrows the invalidation to one part of the API. Given relative it is resolved against the
   * client's `baseUrl`, exactly like a query route; an absolute URL is taken as it is.
   *
   * Matching is boundary aware rather than a plain prefix test, so `/players` covers `/players`,
   * `/players/1` and `/players?page=2` - but not `/players-archive`.
   */
  url?: QueryInvalidationUrl;

  /**
   * Narrows the invalidation to the reads that declared this tag (see {@link BaseQueryCreatorOptions.tags}).
   * Combined with `url`, a read has to match both.
   */
  tag?: string;

  /**
   * Narrows the invalidation further, on the built `{ method, url }` of each candidate. Runs after
   * `url` when both are given.
   *
   * **Not broadcast** - a function cannot cross a `BroadcastChannel`, so the other tabs narrow by
   * `url` alone and invalidate a superset. Pair it with `otherTabs: false` when the two must agree.
   *
   * @example
   * // Everything below /players, except the one list the current route is already refetching itself.
   * client.invalidateQueries({ url: '/players', filter: (query) => !query.url.includes('page=1') });
   */
  filter?: QueryInvalidationFilterFn;

  /**
   * Whether the user's other tabs invalidate the same queries. Requires
   * the {@link withMultiTabSync} client feature, and is ignored without it.
   *
   * @default true
   */
  otherTabs?: boolean;
};

/**
 * Resolves an {@link QueryInvalidationOptions.url} to the absolute form request URLs are built in, so
 * the comparison - and the message the other tabs receive - never depends on who resolves it.
 */
export const resolveInvalidationUrl = (baseUrl: string, url: string) => {
  const absolute = url.startsWith('/') ? `${baseUrl}${url}` : url;

  // A trailing slash would put the boundary check below one character past where the URL actually
  // ends, which is the one way `/players/` could fail to match `/players/1`.
  return absolute.endsWith('/') ? absolute.slice(0, -1) : absolute;
};

/**
 * Whether a query URL is the invalidated one or sits below it. The check on what follows the prefix
 * is what keeps `/players` from matching `/players-archive`, which a `startsWith` alone would.
 */
export const isUnderInvalidatedUrl = (queryUrl: string, invalidatedUrl: string) => {
  if (!queryUrl.startsWith(invalidatedUrl)) return false;

  const rest = queryUrl.slice(invalidatedUrl.length);

  return rest === '' || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('#');
};

/**
 * Turns an invalidation into the filter the repository refreshes by, or `undefined` when nothing
 * narrows it - "everything in use" is the repository's own cheapest path.
 */
export const createQueryInvalidationFilter = (options: {
  url: string | null;
  tag?: string | null;
  filter?: QueryInvalidationFilterFn;
}): QueryRepositoryRefreshFilterFn | undefined => {
  const { url, tag, filter } = options;

  if (!url && !tag && !filter) return undefined;

  return (request, tags) => {
    if (url && !isUnderInvalidatedUrl(request.url, url)) return false;
    if (tag && !tags?.includes(tag)) return false;

    return filter ? filter({ method: request.method, url: request.url }) : true;
  };
};

/** One thing a mutation invalidates: everything below a URL, or every read that declared a tag. */
export type QueryInvalidationTarget = { url: QueryInvalidationUrl } | { tag: string };

/** What a {@link BaseQueryCreatorOptions.invalidates} function is handed after a successful mutation. */
export type QueryInvalidatesContext<TArgs extends QueryArgs> = {
  /** The args the mutation was sent with. */
  args: RequestArgs<TArgs>;

  /** The mutation's response, or `null` for an empty one (a `204`). */
  response: ResponseType<TArgs> | null;
};

// Method syntax keeps the parameter bivariant, so a creator typed for its own args still fits the
// `CreateQueryCreatorOptions<QueryArgs>` the query internals pass around.
type Bivariant<TContext, TResult> = { fn(context: TContext): TResult }['fn'];

/** @see BaseQueryCreatorOptions.invalidates */
export type QueryInvalidatesOption<TArgs extends QueryArgs> =
  readonly QueryInvalidationTarget[] | Bivariant<QueryInvalidatesContext<TArgs>, readonly QueryInvalidationTarget[]>;

/** What a {@link BaseQueryCreatorOptions.tags} function is handed when the read executes. */
export type QueryTagsContext<TArgs extends QueryArgs> = {
  /** The args the read is sent with. */
  args: RequestArgs<TArgs>;
};

/** @see BaseQueryCreatorOptions.tags */
export type QueryTagsOption<TArgs extends QueryArgs> =
  readonly string[] | Bivariant<QueryTagsContext<TArgs>, readonly string[]>;

/** @internal */
export const resolveQueryTags = <TArgs extends QueryArgs>(
  tags: QueryTagsOption<TArgs>,
  args: RequestArgs<TArgs> | null,
) => (typeof tags === 'function' ? tags({ args: args ?? ({} as RequestArgs<TArgs>) }) : tags);

/** @internal */
export const invalidateOnSuccess = <TArgs extends QueryArgs>(options: {
  invalidates: QueryInvalidatesOption<TArgs>;
  state: QueryState<TArgs>;
  deps: QueryDependencies;
}) => {
  const { invalidates, state, deps } = options;

  const subscription = state.events$.subscribe((event) => {
    if (event.type !== HttpEventType.Response) return;

    const targets =
      typeof invalidates === 'function'
        ? invalidates({
            args: state.subtle.request()?.args ?? ({} as RequestArgs<TArgs>),
            response: state.response(),
          })
        : invalidates;

    for (const target of targets) deps.client.invalidateQueries(target);
  });

  deps.destroyRef.onDestroy(() => subscription.unsubscribe());
};
