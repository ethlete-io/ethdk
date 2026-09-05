import { Injector, Signal, WritableSignal } from '@angular/core';
import { QueryBatchDevtoolsHandle } from '../http/query-batch';
import { AnyCreateQueryClientResult, QueryClient } from '../http/query-client';
import { CreateQueryCreatorOptions, QueryConfig } from '../http/query-creator';
import { QueryRepository } from '../http/query-repository';
import { QueryDevtoolsFeature } from './query-devtools-features';
import { QueryDevtoolsFormLinksHandle, QueryDevtoolsFormLinksRecorder } from './query-devtools-form-links';
import { QueryDevtoolsOverridesRecorder } from './query-devtools-overrides';
import { QueryDevtoolsStatsHandle, QueryDevtoolsStatsRecorder } from './query-devtools-stats';

/**
 * The kind of object a {@link QueryDevtoolsEntry} describes. Part of the devtools contract consumed
 * by `<et-query-devtools>` - not a general-purpose query API.
 */
export type QueryDevtoolsEntryKind =
  | 'query'
  | 'query-stack'
  | 'paged-query-stack'
  | 'query-sequence'
  | 'query-batch'
  | 'auth-provider'
  | 'ws-client'
  | 'query-form';

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

  /**
   * The batch that created a query, for the one query `createQueryBatch` runs per item. The panel folds
   * such queries under their batch's own entry instead of listing a row per item, and the registry caps
   * their tombstones per batch so a bulk run cannot evict everything else it kept.
   */
  batch?: QueryBatchDevtoolsHandle;

  /** Which of the batch's items the query was created for, for a batch's item query. */
  batchItemIndex?: number;

  /** How many of a batch's requests may be in flight at once, for batches. */
  concurrency?: number;

  /** Whether a batch's first failure stops the rest of the run, for batches. */
  stopOnError?: boolean;

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
   * When the query behind this entry was destroyed, or `null`/absent while it is still live. A
   * destroyed entry is kept as a tombstone - a frozen snapshot of what the query last held - so a
   * request that failed on the way out (a `401` that redirects to login and takes its component with
   * it) is still readable by the time the panel is opened. Its `handle` answers with constants and
   * every action on it is inert.
   */
  destroyedAt?: number | null;

  /**
   * What the entry has done since it was created - executions, requests, payload sizes. Present for
   * queries; stacks, sequences and auth providers aggregate the stats of the queries they own instead.
   */
  stats?: QueryDevtoolsStatsHandle;

  /** The query forms this entry's args read, for queries created with a `withArgs` feature. */
  formLinks?: QueryDevtoolsFormLinksHandle;

  /**
   * The response overrides armed on this entry, for queries. Unlike {@link stats}/{@link formLinks} -
   * whose write side is internal instrumentation the panel only ever reads - the panel itself is what
   * arms an override, so this exposes the full recorder rather than a read-only handle.
   */
  overrides?: QueryDevtoolsOverridesRecorder;
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

  /** @see QueryDevtoolsEntry.formLinks */
  formLinks?: QueryDevtoolsFormLinksHandle;

  /** @see QueryDevtoolsEntry.overrides */
  overrides?: QueryDevtoolsOverridesRecorder;
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
 * Whether `provideQueryDevtools()` has been called on this page. When `false` every instrumentation
 * site is a no-op, which is what a devtools UI gates itself on so a build that omits the provider
 * renders nothing.
 *
 * It is answered by the `provideQueryDevtools()` call itself, which runs while the providers array is
 * built - so it is already settled by the time an application bootstraps and needs no signal.
 */
export const isQueryDevtoolsEnabled = () => registrar !== null;

/**
 * Registers an entry with the devtools registry. Returns an unregister callback. A no-op (returning
 * a no-op callback) unless {@link provideQueryDevtools} has been called.
 * @internal
 */
export const registerQueryDevtoolsEntry = (entry: QueryDevtoolsRegistration): (() => void) =>
  registrar?.(entry) ?? noop;

let statsFactory: (() => QueryDevtoolsStatsRecorder) | null = null;

/**
 * Installs the stats recorder factory. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsStatsFactory = (fn: () => QueryDevtoolsStatsRecorder) => {
  statsFactory = fn;
};

/**
 * A stats recorder for one entry, or `null` unless {@link provideQueryDevtools} has been called.
 *
 * Instrumentation sites must go through this instead of importing `createQueryDevtoolsStats`: a static
 * import pins the whole stats module (~1.4 kB) into every bundle that touches a query, and a runtime
 * `isQueryDevtoolsEnabled()` guard at the call site does not undo that. Reached only from the provider,
 * it is dead code in an app without devtools.
 * @internal
 */
export const createQueryDevtoolsStatsRecorder = (): QueryDevtoolsStatsRecorder | null => statsFactory?.() ?? null;

let formLinksFactory: (() => QueryDevtoolsFormLinksRecorder) | null = null;

/**
 * Installs the form-links recorder factory. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsFormLinksFactory = (fn: () => QueryDevtoolsFormLinksRecorder) => {
  formLinksFactory = fn;
};

/**
 * A form-links recorder for one query, or `null` unless {@link provideQueryDevtools} has been called.
 * Reached only from the provider for the same reason {@link createQueryDevtoolsStatsRecorder} is.
 * @internal
 */
export const createQueryDevtoolsFormLinksRecorder = (): QueryDevtoolsFormLinksRecorder | null =>
  formLinksFactory?.() ?? null;

let overridesFactory: (() => QueryDevtoolsOverridesRecorder) | null = null;

/**
 * Installs the overrides recorder factory. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsOverridesFactory = (fn: () => QueryDevtoolsOverridesRecorder) => {
  overridesFactory = fn;
};

/**
 * An overrides recorder for one query, or `null` unless {@link provideQueryDevtools} has been called.
 * Reached only from the provider for the same reason {@link createQueryDevtoolsStatsRecorder} is.
 * @internal
 */
export const createQueryDevtoolsOverridesRecorder = (): QueryDevtoolsOverridesRecorder | null =>
  overridesFactory?.() ?? null;

/** The ids of the query forms read by the args build currently running, or `null` outside of one. */
let formLinkSink: Set<string> | null = null;

/**
 * Runs `build` and reports which query forms it read. Nested builds are supported - the outer one
 * resumes collecting once the inner one is done.
 * @internal
 */
export const collectQueryFormLinks = <T>(build: () => T): { value: T; ids: string[] } => {
  const outer = formLinkSink;
  const sink = new Set<string>();

  formLinkSink = sink;

  try {
    return { value: build(), ids: [...sink] };
  } finally {
    formLinkSink = outer;
  }
};

/**
 * Records that a query form's committed value was read. The form calls this from its `value` signal, so
 * a read that happens while a query builds its args is what links the two - no naming convention, and
 * nothing to keep in sync when the args change.
 * @internal
 */
export const noteQueryFormRead = (id: string) => {
  formLinkSink?.add(id);
};

/** The request an upcoming attempt belongs to, for the fault resolver to match against. */
export type QueryDevtoolsFaultTarget = {
  /** Display name of the owning query client. Faults are armed per client. */
  clientName: string;

  method: string;
  url: string;
};

/** What the devtools want done with one upcoming attempt. */
export type QueryDevtoolsResolvedFault = {
  /** Extra latency in ms to wait out before the attempt starts. */
  latencyMs: number;

  /** The status to fail the attempt with instead of sending it, or `null` to let it through. */
  status: number | null;
};

/** What a mock resolver matches against - the same three things a fault resolver sees. */
export type QueryDevtoolsMockTarget = QueryDevtoolsFaultTarget;

/** The response the devtools want served instead of one upcoming attempt. */
export type QueryDevtoolsResolvedMock = {
  /** The status to respond with. `400` and above are delivered as an `HttpErrorResponse`. */
  status: number;

  body: unknown;

  /** How long to wait before the mocked response settles. */
  latencyMs: number;
};

let faultResolver: ((target: QueryDevtoolsFaultTarget) => QueryDevtoolsResolvedFault | null) | null = null;
let mockResolver: ((target: QueryDevtoolsMockTarget) => QueryDevtoolsResolvedMock | null) | null = null;

/**
 * Installs the fault resolver. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsFaultResolver = (
  fn: (target: QueryDevtoolsFaultTarget) => QueryDevtoolsResolvedFault | null,
) => {
  faultResolver = fn;
};

/**
 * Installs the mock resolver. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsMockResolver = (
  fn: (target: QueryDevtoolsMockTarget) => QueryDevtoolsResolvedMock | null,
) => {
  mockResolver = fn;
};

/**
 * Whether the devtools can do anything to a request at all - inject a fault, or serve a mock instead of
 * sending it. Checked before building the wrapper that resolves both per attempt, so a request in an app
 * without devtools keeps the pipeline it always had.
 * @internal
 */
export const isQueryDevtoolsRequestInterceptionEnabled = () => faultResolver !== null || mockResolver !== null;

/**
 * The mock to serve one upcoming attempt instead of sending it, or `null` to let it through.
 * @internal
 */
export const resolveQueryDevtoolsMock = (target: QueryDevtoolsMockTarget): QueryDevtoolsResolvedMock | null =>
  mockResolver?.(target) ?? null;

/**
 * Resolves the fault to apply to one upcoming attempt, or `null` when nothing is armed. Consumes a
 * `failNext` budget, so call it exactly once per attempt.
 * @internal
 */
export const resolveQueryDevtoolsFault = (target: QueryDevtoolsFaultTarget): QueryDevtoolsResolvedFault | null =>
  faultResolver?.(target) ?? null;

let tokenPayloadPatcher:
  ((options: { payload: unknown; providerName: string; expiresInPropertyName: string }) => unknown) | null = null;

/**
 * Installs the access-token payload patcher. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsTokenPayloadPatcher = (
  fn: (options: { payload: unknown; providerName: string; expiresInPropertyName: string }) => unknown,
) => {
  tokenPayloadPatcher = fn;
};

/**
 * A decoded access token as the devtools want it seen, which today means with an overridden lifetime
 * applied. Returns the payload as decoded unless `provideQueryDevtools()` installed a patcher.
 *
 * Auth code must reach the override through this rather than importing the registry it lives in: a
 * static import would pin that module into every bundle that builds an auth provider, and a runtime
 * guard at the call site does not undo that.
 * @internal
 */
export const patchQueryDevtoolsTokenPayload = <T>(options: {
  payload: T;
  providerName: string;
  expiresInPropertyName: string;
}): T => (tokenPayloadPatcher ? (tokenPayloadPatcher(options) as T) : options.payload);

/** The batch item a query is being created for. @internal */
export type QueryDevtoolsBatchOwner = { batch: QueryBatchDevtoolsHandle; index: number };

/** The batch item being created right now, or `null` outside one. */
let batchOwner: QueryDevtoolsBatchOwner | null = null;

/**
 * Runs `create` with every query it creates attributed to `owner`'s batch and item. The attribution has
 * to be ambient: a batch's item query is built by the query creator the caller handed it, which takes no
 * devtools argument - so there is nothing to thread the owner through. Nested runs restore the outer one.
 * @internal
 */
export const runInQueryDevtoolsBatch = <T>(owner: QueryDevtoolsBatchOwner, create: () => T): T => {
  const outer = batchOwner;

  batchOwner = owner;

  try {
    return create();
  } finally {
    batchOwner = outer;
  }
};

/** The batch item a query being created belongs to, or `null` for one created outside a batch. @internal */
export const currentQueryDevtoolsBatch = () => batchOwner;

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

/**
 * What the devtools' session vault needs of a bearer auth provider. Typed structurally, so the auth
 * layer stays the only thing that knows how a provider is built.
 */
export type QueryDevtoolsAuthProviderHandle = {
  accessToken: Signal<string | null>;
  refreshToken: Signal<string | null>;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;

  /**
   * Why the live session last ended, as `BearerAuthProvider.sessionEndCause` reports it. Typed as a
   * string so this contract stays clear of the auth module, which imports this file.
   */
  sessionEndCause: Signal<string | null>;

  /**
   * The provider's auth queries, which is how the panel logs in as a declared account.
   *
   * Untyped for the reason `AnyBearerAuthProvider.queries` is: with unknown builders the registry
   * degrades to an index signature, and no structural contract survives it.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queries: any;
};

/** One bearer auth provider, as the devtools' session vault takes it. */
export type QueryDevtoolsAuthProviderRegistration = {
  /** The provider's own name, which every session is stored under. */
  name: string;

  handle: QueryDevtoolsAuthProviderHandle;
  client: QueryClient;

  /**
   * Whether this tab's session is its own rather than the one its siblings share. Written by the
   * devtools, read by `withBearerAuthMultiTabSync` and `withPersistentAuth`.
   */
  isTabLocalSession: WritableSignal<boolean>;

  /** The provider's injector, which the vault keeps its token-tracking effect on. */
  injector: Injector;
};

/** The tokens one tab was seeded with, which is a session that belongs to this tab alone. */
export type QueryDevtoolsAuthSeed = {
  accessToken: string;
  refreshToken: string;
};

let authProviderRegistrar: ((registration: QueryDevtoolsAuthProviderRegistration) => () => void) | null = null;

/**
 * Installs the session vault's provider registrar. Called by `provideQueryDevtools()`; nothing else may
 * call it.
 * @internal
 */
export const setQueryDevtoolsAuthProviderRegistrar = (
  fn: (registration: QueryDevtoolsAuthProviderRegistration) => () => void,
) => {
  authProviderRegistrar = fn;
};

/**
 * Hands one auth provider to the devtools' session vault, which then keeps the live session's tokens in
 * step with the stored one. A no-op without `provideQueryDevtools()`.
 * @internal
 */
export const registerQueryDevtoolsAuthProvider = (registration: QueryDevtoolsAuthProviderRegistration): (() => void) =>
  authProviderRegistrar?.(registration) ?? (() => undefined);

let authSeedReader: ((providerName: string) => QueryDevtoolsAuthSeed | null) | null = null;

/**
 * Installs the tab-local session reader. Called by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const setQueryDevtoolsAuthSeedReader = (fn: (providerName: string) => QueryDevtoolsAuthSeed | null) => {
  authSeedReader = fn;
};

/**
 * The session the panel put in this tab alone, or `null` for a tab on the shared one. Read once while a
 * provider is built, before its features run: the tokens have to be in place before `withPersistentAuth`
 * decides whether to spend its cookie.
 * @internal
 */
export const readQueryDevtoolsAuthSeed = (providerName: string): QueryDevtoolsAuthSeed | null =>
  authSeedReader?.(providerName) ?? null;
