import { AnyCreateQueryClientResult, QueryClient } from '../http/query-client';
import { CreateQueryCreatorOptions, QueryConfig } from '../http/query-creator';
import { QueryRepository } from '../http/query-repository';
import { QueryDevtoolsFeature } from './query-devtools-features';
import { QueryDevtoolsStatsHandle } from './query-devtools-stats';

/**
 * The kind of object a {@link QueryDevtoolsEntry} describes. Part of the devtools contract consumed
 * by `<et-query-devtools>` - not a general-purpose query API.
 */
export type QueryDevtoolsEntryKind =
  'query' | 'query-stack' | 'paged-query-stack' | 'query-sequence' | 'auth-provider' | 'ws-client';

/**
 * One chunk of a parsed query route: either literal text (`param: null`) or a path param, whose name
 * is in {@link QueryDevtoolsRoutePart.text}. Lets the devtools tell a route's static parts from its
 * dynamic ones and fill the latter in with the values a query actually used.
 */
export type QueryDevtoolsRoutePart = {
  text: string;
  param: string | null;
};

/**
 * One of a bearer auth provider's queries, described without instantiating it - which is what lets
 * tooling build the token-refresh request of a provider whose refresh query has not run yet.
 */
export type QueryDevtoolsAuthQuery = {
  key: string;

  /** `token-refresh` for the query registered via `withRefreshQuery`, `auth` for the rest. */
  kind: 'auth' | 'token-refresh';

  method: string;

  /** Stringified route with path params rendered as `:name`. */
  route: string;

  /** The args a token refresh sends for a given refresh token. Only set on the refresh query. */
  buildArgs?: (refreshToken: string) => { body?: unknown };
};

/**
 * Descriptive, mostly-static metadata about a registered devtools entry. The live, reactive state
 * is read from the entry's {@link QueryDevtoolsEntry.handle} instead.
 */
export type QueryDevtoolsEntryMeta = {
  /** Display name of the owning query client, where known. */
  clientName?: string;

  /** Base URL of the owning query client, where known. */
  clientBaseUrl?: string;

  /** Human readable display name (e.g. an auth provider or web socket client name). */
  name?: string;

  /** The connection URL, for web socket clients. */
  url?: string;

  /** The GraphQL document string, for GraphQL queries. */
  gqlQuery?: string;

  /** Stringified route with path params rendered as `:name`, for queries. */
  route?: string;

  /** The same route, split into its literal and path-param parts. */
  routeParts?: QueryDevtoolsRoutePart[];

  /** Human readable HTTP/GQL method, for queries (e.g. `GET`, `GQL QUERY`). */
  method?: string;

  /** The features applied at creation, with the options each was configured with. */
  features?: QueryDevtoolsFeature[];

  /** Whether the query authenticates through a bearer auth provider, for queries. */
  isSecure?: boolean;

  /** Name of the bearer auth provider a secure query authenticates with. */
  authProviderName?: string;

  /** The provider's own queries, for auth providers. */
  authQueries?: QueryDevtoolsAuthQuery[];

  /** The query config passed at creation, for queries. */
  queryConfig?: QueryConfig;

  /** The creator options passed at creation, for queries. */
  creator?: CreateQueryCreatorOptions;

  /** The owning client's repository, where known (queries and auth providers). */
  repository?: QueryRepository;

  /**
   * The owning client itself, where known (queries and auth providers). Read for state that hangs off
   * the client rather than the repository - the multi-tab sync engine, in particular.
   */
  client?: QueryClient;

  /**
   * The DOM element of the component/directive that created a query, when available. Used by the
   * devtools "inspect" tool to map a query back to its place in the live UI.
   */
  element?: HTMLElement | null;
};

/**
 * A single entry in the {@link queryDevtoolsEntries} registry. The `handle` is the live object
 * (query, stack, sequence or auth provider) so its signals stay reactive when read by the UI.
 */
export type QueryDevtoolsEntry = {
  id: string;
  kind: QueryDevtoolsEntryKind;
  meta: QueryDevtoolsEntryMeta;
  handle: unknown;
  createdAt: number;

  /**
   * What the entry has done since it was created - executions, requests, payload sizes. Present for
   * queries; stacks, sequences and auth providers aggregate the stats of the queries they own instead.
   */
  stats?: QueryDevtoolsStatsHandle;
};

/**
 * What an instrumentation site hands to the registry. Raw values (`route`, `clientRef`) are rendered
 * into {@link QueryDevtoolsEntryMeta} by the registry rather than at the call site, so the code that
 * renders them is only reachable from {@link provideQueryDevtools}.
 */
export type QueryDevtoolsRegistration = {
  id?: string;
  kind: QueryDevtoolsEntryKind;
  handle: unknown;
  meta: QueryDevtoolsEntryMeta;

  /** The creator's route, stringified by the registry. */
  route?: unknown;

  /** The owning client, whose display name is derived by the registry. */
  clientRef?: AnyCreateQueryClientResult;

  /**
   * The bearer auth provider a secure query authenticates with, whose display name is derived by the
   * registry. Typed structurally so the registry does not have to import the auth layer it registers.
   */
  authProviderRef?: { token?: unknown };

  /** The auth provider's queries, whose routes are stringified by the registry. */
  authQueries?: (Omit<QueryDevtoolsAuthQuery, 'route'> & { route?: unknown })[];

  /** @see QueryDevtoolsEntry.stats */
  stats?: QueryDevtoolsStatsHandle;
};

/** The registry {@link provideQueryDevtools} installs. */
export type QueryDevtoolsRegistrar = (entry: QueryDevtoolsRegistration) => () => void;

const noop = () => undefined;

let registrar: QueryDevtoolsRegistrar | null = null;

/**
 * Installs the real registry. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsRegistrar = (fn: QueryDevtoolsRegistrar) => {
  registrar = fn;
};

/**
 * Whether {@link provideQueryDevtools} has been called. When `false`, every `register*` call is a
 * no-op so the devtools instrumentation retains no references and adds no overhead in production.
 * @internal
 */
export const isQueryDevtoolsEnabled = () => registrar !== null;

/**
 * Registers an entry with the devtools registry. Returns an unregister callback. A no-op (returning
 * a no-op callback) unless {@link provideQueryDevtools} has been called.
 * @internal
 */
export const registerQueryDevtoolsEntry = (entry: QueryDevtoolsRegistration): (() => void) =>
  registrar?.(entry) ?? noop;

let suppressStackRegistration = false;

/**
 * Suppresses devtools registration for the next {@link createQueryStack} call. Used by
 * `createPagedQueryStack` so its backing stack is not registered as a separate `query-stack` entry.
 * @internal
 */
export const suppressNextQueryStackDevtools = () => {
  suppressStackRegistration = true;
};

/**
 * Reads and clears the suppress-next-stack flag. Always call this from `createQueryStack` (even when
 * devtools are disabled) so a suppression request never leaks into a later stack.
 * @internal
 */
export const consumeSuppressQueryStackDevtools = () => {
  const value = suppressStackRegistration;
  suppressStackRegistration = false;

  return value;
};
