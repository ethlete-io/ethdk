import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  isDevMode,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { defineRootProvider, injectUnsavedChangesCoordinator, isObject, ProviderDefinition } from '@ethlete/core';
import { Observable, Subject } from 'rxjs';
import {
  DescribableFeature,
  describeQueryDevtoolsFeatures,
  QueryDevtoolsFeatureDescriber,
} from '../devtools/query-devtools-features';
import {
  isQueryDevtoolsEnabled,
  patchQueryDevtoolsTokenPayload,
  QueryDevtoolsAuthProviderHandle,
  readQueryDevtoolsAuthSeed,
  registerQueryDevtoolsAuthProvider,
  registerQueryDevtoolsEntry,
} from '../devtools/query-devtools-hook';
import {
  AnyCreateQueryClientResult,
  authExtractTokensResponseMissingAccessToken,
  authExtractTokensResponseMissingRefreshToken,
  authExtractTokensResponseNotObject,
  authProviderFeatureUsedMultipleTimes,
  createQueryErrorResponse,
  Query,
  QueryArgs,
  QueryClient,
  QueryErrorResponse,
  QueryRepository,
  QuerySnapshot,
  RequestArgs,
  RunQueryExecuteOptions,
} from '../http';
import { decryptBearer } from '../http/internal/request-route';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProviderTokens,
  TokenRefreshQueryBuilder,
} from './bearer-auth-query-builders';
import {
  BearerAuthMultiTabSyncFeature,
  InactivityLogoutFeature,
  PersistentAuthFeature,
  TokenExpirationWarningFeature,
  TrackingFeature,
} from './features';
import { BearerAuthSessionAdoption } from './internal';

export type { AnyQueryBuilder } from './bearer-auth-query-builders';

export type BearerAuthExecutionStateLoading<TType extends string = string> = {
  type: TType;
  state: 'loading';
};

export type BearerAuthExecutionStateSuccess<TType extends string = string> = {
  type: TType;
  state: 'success';
  response: unknown;
};

export type BearerAuthExecutionStateError<TType extends string = string> = {
  type: TType;
  state: 'error';
  error: QueryErrorResponse;
};

export type BearerAuthExecutionStateLogout = {
  type: 'logout';
  state: 'success';
};

export type BearerAuthExecutionStateTokenSeed = {
  type: 'tokenSeed';
  state: 'success';
};

export type BearerAuthExecutionState<TType extends string = string> =
  | BearerAuthExecutionStateLoading<TType>
  | BearerAuthExecutionStateSuccess<TType>
  | BearerAuthExecutionStateError<TType>
  | BearerAuthExecutionStateLogout
  | BearerAuthExecutionStateTokenSeed;

/**
 * Whether this tab has a session, and whether it is still finding out.
 *
 * - `unknown` - the provider has not finished its own startup yet. Never observed from a component.
 * - `restoring` - a session restore is in flight (`withPersistentAuth`'s auto-login).
 * - `authenticated` - tokens are applied.
 * - `anonymous` - no session, and nothing is trying to get one.
 */
export type BearerAuthSessionStatus = 'unknown' | 'restoring' | 'authenticated' | 'anonymous';

/**
 * Why the session ended. A user-initiated logout must stay put; a session that ended on its own
 * usually returns the user to where they were, so the two cannot be told apart by state alone.
 */
export type BearerAuthSessionEndCause =
  /** `logout()` called with no cause - a user clicking "log out". */
  | 'user'
  /** `withInactivityLogout`'s timer elapsed. */
  | 'inactivity'
  /** A token refresh failed for good, so the tab can no longer renew the session. */
  | 'expired'
  /** Another tab logged out and `withBearerAuthMultiTabSync` carried it here. */
  | 'otherTab';

export const BearerAuthFeatureType = {
  PERSISTENT_AUTH: 'PERSISTENT_AUTH',
  TOKEN_EXPIRATION_WARNING: 'TOKEN_EXPIRATION_WARNING',
  INACTIVITY_LOGOUT: 'INACTIVITY_LOGOUT',
  TOKEN_REVOCATION: 'TOKEN_REVOCATION',
  TRACKING: 'TRACKING',
  MULTI_TAB_SYNC: 'MULTI_TAB_SYNC',
} as const;

export type BearerAuthFeatureType = (typeof BearerAuthFeatureType)[keyof typeof BearerAuthFeatureType];

export type BearerAuthFeature<TBuilders extends readonly AnyQueryBuilder[], TBearerData> = {
  type: BearerAuthFeatureType;
  setup: (context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown;

  /** How the feature was configured, for the devtools. Only called while devtools are enabled. */
  devtools?: QueryDevtoolsFeatureDescriber;
};

/**
 * What a feature gets before the provider's queries are wired up. Only the tokens, the client and the
 * two session entry points exist this early - everything else is built on top of what early setup
 * returns.
 *
 * Advanced: only a feature that has to run before the auth queries are wired needs this.
 */
export type BearerAuthProviderEarlySetupContext = {
  accessToken: WritableSignal<string | null>;
  refreshToken: WritableSignal<string | null>;
  queryClient: QueryClient;

  /**
   * The provider's own name. A feature that reaches outside the tab - a `BroadcastChannel`, a Web Lock,
   * a storage key - must namespace it with this, or two providers on the same origin share it.
   */
  name: string;

  /**
   * Applies a token pair the way a successful auth query does - including the `afterTokenRefresh$`
   * emission that retries secure queries which failed with a 401. Prefer this over writing
   * {@link accessToken} and {@link refreshToken}, which only changes what the next request sends.
   */
  applyTokens: (access: string, refresh: string) => void;

  /**
   * Applies a token pair *and* reports it as a token seed, exactly as the provider's own
   * `setTokens()` does. For a session this tab did not have before - everything that already holds
   * one is a rotation, and reporting those would stomp whatever the tab is doing.
   */
  setTokens: (access: string, refresh: string) => void;

  /** Ends the session, exactly as the provider's own `logout()` does. */
  logout: (cause?: BearerAuthSessionEndCause) => void;

  /** Why the last session ended, as {@link BearerAuthProvider.sessionEndCause} reports it. */
  sessionEndCause: Signal<BearerAuthSessionEndCause | null>;

  /**
   * Whether this tab's session is its own rather than the one every tab of the app shares. Only the
   * devtools set it, and only for a tab somebody asked to hold a different user. A feature that reaches
   * outside the tab - a `BroadcastChannel`, a cookie - must do nothing at all while it reads `true`.
   */
  isTabLocalSession: Signal<boolean>;
};

/**
 * How a tab that is not the leader gets a refresh out of the tab that is. Contributed by
 * `withBearerAuthMultiTabSync`; absent when every tab refreshes for itself.
 */
export type BearerAuthRefreshCoordination = {
  /** Asks the leader tab to refresh the session's tokens now. */
  request: () => void;

  /** Emits in the leader tab whenever another tab asked for a refresh. */
  requests$: Observable<void>;

  /**
   * Tells the other tabs that a refresh started here. It is what makes {@link request} more than a
   * message into the void: a follower that gets no answer takes the refresh over itself, so a leader
   * that is working on one has to say so.
   */
  announceStart: () => void;

  /** Emits whenever another tab announced that it started a refresh. */
  starts$: Observable<void>;
};

/**
 * How the tabs of one session keep a single idea of when the user was last active. Contributed by
 * `withBearerAuthMultiTabSync`; absent when a tab's idleness is nobody else's business.
 */
export type BearerAuthActivityCoordination = {
  /** Tells the other tabs the user did something here. */
  announce: () => void;

  /** Emits whenever another tab announced activity. Never echoes this tab's own. */
  activity$: Observable<void>;
};

/** The parts of the provider an early setup can contribute. */
export type BearerAuthProviderEarlySetupResult = {
  isLeader?: () => boolean;
  leaderElection?: { isLeader: Signal<boolean>; instanceCount: Signal<number> };
  refreshCoordination?: BearerAuthRefreshCoordination;
  sessionAdoption?: BearerAuthSessionAdoption;
  activityCoordination?: BearerAuthActivityCoordination;
};

/**
 * A feature builder that additionally runs before the auth queries are set up. The auth queries read
 * `isLeader` while being wired, so a feature that decides who the leader is cannot wait for the
 * regular feature pass.
 */
export type BearerAuthProviderEarlySetup = {
  earlySetup?: (context: BearerAuthProviderEarlySetupContext) => BearerAuthProviderEarlySetupResult;
};

export type ExtractQueryKey<T> =
  T extends AuthQueryBuilder<infer K, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    ? K
    : T extends TokenRefreshQueryBuilder<infer K, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      ? K
      : never;

export type ExtractQueryArgs<T> =
  T extends AuthQueryBuilder<string, infer TArgs>
    ? TArgs
    : T extends TokenRefreshQueryBuilder<string, infer TArgs>
      ? TArgs
      : never;

export type QueryRegistryEntry<TArgs extends QueryArgs> = {
  /**
   * Executes the auth query. `args` may be omitted for a query that takes none - its
   * `RequestArgs` is `{}`, which generic helper code cannot produce without a cast.
   */
  execute: (args?: RequestArgs<TArgs>, options?: RunQueryExecuteOptions) => QuerySnapshot<TArgs>;
  snapshot: Signal<QuerySnapshot<TArgs> | null>;
};

export type QueryRegistry<TBuilders extends readonly AnyQueryBuilder[]> = {
  [K in ExtractQueryKey<TBuilders[number]>]: QueryRegistryEntry<
    ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>
  >;
};

type HasFeatureType<
  TFeatures extends readonly unknown[],
  TType extends BearerAuthFeatureType,
> = TFeatures extends readonly ((context: any) => any)[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ? Extract<ReturnType<TFeatures[number]>, { type: TType }> extends never
    ? false
    : true
  : false;

type ExtractFeatureInstance<
  TFeatures extends readonly unknown[],
  TType extends BearerAuthFeatureType,
> = TFeatures extends readonly ((context: any) => any)[] // eslint-disable-line @typescript-eslint/no-explicit-any
  ? Extract<ReturnType<TFeatures[number]>, { type: TType }> extends { type: TType; instance: infer TInstance }
    ? TInstance
    : never
  : never;

export type FeatureRegistry<
  TFeatures extends readonly unknown[],
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
> = (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.PERSISTENT_AUTH> extends true
  ? { persistentAuth: PersistentAuthFeature }
  : unknown) &
  (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.TOKEN_EXPIRATION_WARNING> extends true
    ? { tokenExpirationWarning: TokenExpirationWarningFeature }
    : unknown) &
  (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.INACTIVITY_LOGOUT> extends true
    ? { inactivityLogout: InactivityLogoutFeature }
    : unknown) &
  (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.TOKEN_REVOCATION> extends true
    ? { tokenRevocation: ExtractFeatureInstance<TFeatures, typeof BearerAuthFeatureType.TOKEN_REVOCATION> }
    : unknown) &
  (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.TRACKING> extends true
    ? { tracking: TrackingFeature<TBuilders> }
    : unknown) &
  (HasFeatureType<TFeatures, typeof BearerAuthFeatureType.MULTI_TAB_SYNC> extends true
    ? { multiTabSync: BearerAuthMultiTabSyncFeature }
    : unknown);

export type CreateBearerAuthProviderConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData,
> = {
  /**
   * The name of the auth provider
   */
  name: string;

  /**
   * The query client tuple from createQueryClient
   */
  queryClientRef: AnyCreateQueryClientResult;

  /**
   * Query builders
   */
  queries: TBuilders;

  /**
   * Feature builders
   */
  features?: TFeatures;

  /**
   * A function that decrypts the bearer token
   * @default decryptBearer()
   */
  bearerDecryptFn?: (token: string) => TBearerData;
};

export type BearerAuthProvider<
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData,
> = {
  /**
   * Registry of all configured auth queries
   */
  queries: QueryRegistry<TBuilders>;

  /**
   * Registry of all configured features
   */
  features: FeatureRegistry<TFeatures, TBuilders>;

  /**
   * The current access token
   */
  accessToken: Signal<string | null>;

  /**
   * The current refresh token
   */
  refreshToken: Signal<string | null>;

  /**
   * The decrypted bearer data
   */
  bearerData: Signal<TBearerData | null>;

  /**
   * Whether the user is currently authenticated
   */
  isAuthenticated: Signal<boolean>;

  /**
   * Whether the access token this tab holds is already past its expiry, so a request carrying it can
   * only be rejected. Answers `false` without a refresh query, for a token whose expiry cannot be
   * read, and when the refresh query is configured not to refresh an expired token - in each of those
   * cases waiting for a new token would wait forever.
   *
   * Not a signal: the answer changes with the clock, not with a dependency.
   */
  isAccessTokenExpired: () => boolean;

  /**
   * The latest executed query (including internal triggers like auto-refresh)
   */
  latestExecutedQuery: Signal<{ key: ExtractQueryKey<TBuilders[number]>; snapshot: QuerySnapshot<QueryArgs> } | null>;

  /**
   * The latest non-internal query (user-triggered only)
   */
  latestNonInternalQuery: Signal<{
    key: ExtractQueryKey<TBuilders[number]>;
    snapshot: QuerySnapshot<QueryArgs>;
  } | null>;

  /**
   * The current execution state of the auth provider.
   * Tracks the latest auth operation (login, autoLogin, tokenRefresh, logout, revocation) with its state and payload.
   */
  executionState: Signal<BearerAuthExecutionState<
    ExtractQueryKey<TBuilders[number]> | 'autoLogin' | 'tokenRefresh' | 'logout' | 'revocation' | 'tokenSeed'
  > | null>;

  /**
   * Whether this tab has a session, and whether it is still finding out - the signal to gate an app
   * shell on. Unlike {@link executionState} it always has a value, it answers only this one question,
   * and it reaches `anonymous` even when nothing ever executed (no cookie to restore from).
   */
  sessionStatus: Signal<BearerAuthSessionStatus>;

  /**
   * Why the last session ended, or `null` while one is running and before the first ever ended.
   * Cleared as soon as tokens are applied again.
   */
  sessionEndCause: Signal<BearerAuthSessionEndCause | null>;

  /**
   * Seeds the provider with tokens that were issued outside of it - an SSO/OIDC callback that
   * arrives with both tokens in the URL, a token handed over by a native shell, a test harness.
   *
   * Behaves like a successful auth query: the tokens are applied, `bearerData` / `isAuthenticated`
   * update, `executionState` becomes `{ type: 'tokenSeed', state: 'success' }` (secure queries treat
   * this the same as a resolved auth query and run normally), and (unless disabled) other tabs are
   * synced. Without it the only way in is to execute the refresh query with the refresh token and
   * throw the access token away.
   *
   * Supersedes any token-issuing execution in flight, so a cookie auto-login still out with an older
   * refresh token can neither apply its tokens over this pair nor report its failure as the session's.
   *
   * Does **not** persist anything by itself - `withPersistentAuth` picks the tokens up through the
   * same signals it watches for query-issued ones.
   */
  setTokens: (accessToken: string, refreshToken: string) => void;

  /**
   * Logout the user (clears all tokens and unbinds secure queries). The optional cause is published
   * as {@link sessionEndCause}; it defaults to `'user'`, so a plain `logout()` reads as a click.
   */
  logout: (cause?: BearerAuthSessionEndCause) => void;

  /**
   * Observable that emits after a successful token refresh.
   * Secure queries can subscribe to this to re-execute themselves with the new token.
   */
  afterTokenRefresh$: Observable<void>;
};

export type BearerAuthProviderFeatureContext<
  TBearerData = unknown,
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
> = {
  name: string;
  refreshToken: WritableSignal<string | null>;
  afterTokenRefresh$: Observable<void>;
  accessToken: WritableSignal<string | null>;
  bearerData: Signal<TBearerData | null>;
  logout: (cause?: BearerAuthSessionEndCause) => void;
  injector: Injector;
  destroyRef: DestroyRef;
  setTokens: (access: string, refresh: string) => void;
  isLeader: () => boolean;

  /** @see BearerAuthProviderEarlySetupContext.isTabLocalSession */
  isTabLocalSession: Signal<boolean>;
  leaderElection?: { isLeader: Signal<boolean>; instanceCount: Signal<number> };

  /**
   * The join handshake a tab runs at startup when multi-tab sync is on: it asked the leader for the
   * live session, and `withPersistentAuth` holds its cookie auto-login until the answer arrives, so a
   * second tab adopts the session instead of spending a refresh token on one of its own. Absent when
   * there is nothing to adopt - no sync, no `BroadcastChannel`, or tokens deliberately tab-local.
   */
  sessionAdoption?: BearerAuthSessionAdoption;

  /**
   * How the tabs of this session share when the user was last active, so a feature that ends the
   * session on idleness ends it on the _session_ being idle rather than on this tab being idle.
   * Absent when no other tab is listening - no sync, no `BroadcastChannel`, or a tab-local logout.
   */
  activityCoordination?: BearerAuthActivityCoordination;
  queries: QueryRegistry<TBuilders>;
  latestExecutedQuery: Signal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>;
  executionState: WritableSignal<BearerAuthExecutionState | null>;
  sessionStatus: Signal<BearerAuthSessionStatus>;
  sessionEndCause: Signal<BearerAuthSessionEndCause | null>;
};

export type BearerAuthProviderQueryContext<
  TBearerData = unknown,
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
> = {
  /** The provider's own name, as `createBearerAuthProvider({ name })` was given it. */
  name: string;

  accessToken: WritableSignal<string | null>;
  refreshToken: WritableSignal<string | null>;
  bearerDecryptFn: ((token: string) => TBearerData) | undefined;
  queryClient: QueryClient;
  repository: QueryRepository;
  afterTokenRefresh$: Observable<void>;
  isLeader: () => boolean;
  refreshCoordination: BearerAuthRefreshCoordination | undefined;

  /** Ends the session, exactly as the provider's own `logout()` does. */
  logout: (cause?: BearerAuthSessionEndCause) => void;
  queries: QueryRegistry<TBuilders>;

  /** The query the current {@link executionState} belongs to, or `null` after a logout. */
  latestExecutedQuery: Signal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>;
  executionState: Signal<BearerAuthExecutionState | null>;

  /** Whether any execution that can issue tokens is still running, across every registry key. */
  hasTokenIssuingExecutionInFlight: Signal<boolean>;

  /**
   * Hands the provider the check behind {@link BearerAuthProvider.isAccessTokenExpired}. Only the
   * refresh query knows which claim carries the expiry and whether an expired token is refreshed at
   * all, so the provider cannot work it out on its own.
   */
  reportAccessTokenExpiry: (isExpired: () => boolean) => void;
};

const defaultExtractTokens = (response: unknown): BearerAuthProviderTokens => {
  if (!isObject(response)) {
    throw authExtractTokensResponseNotObject();
  }
  if (!('accessToken' in response) || typeof response['accessToken'] !== 'string') {
    throw authExtractTokensResponseMissingAccessToken();
  }
  if (!('refreshToken' in response) || typeof response['refreshToken'] !== 'string') {
    throw authExtractTokensResponseMissingRefreshToken();
  }
  return { accessToken: response['accessToken'], refreshToken: response['refreshToken'] };
};

const deriveExecutionStateType = (builder: AnyQueryBuilder, triggeredBy: string | undefined) => {
  if (triggeredBy === 'persistent-auth') return 'autoLogin';
  if (builder._type === 'tokenRefreshQuery') return 'tokenRefresh';
  if (triggeredBy === 'token-revocation') return 'revocation';
  return builder.key;
};

type BearerQueryRegistryContext = {
  injector: Injector;
  latestExecutedQuery: WritableSignal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>;
  latestNonInternalQuery: WritableSignal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>;
  applyTokens: (access: string, refresh: string) => void;
  executionState: WritableSignal<BearerAuthExecutionState | null>;
  sessionStatus: WritableSignal<BearerAuthSessionStatus>;
  isAuthenticated: Signal<boolean>;
};

/** An execution in progress. `id` is `null` for the ones that cannot issue tokens (a revocation). */
type CurrentExecution = { id: number | null; type: string; snapshot: QuerySnapshot<QueryArgs> };

const setupBearerQueryRegistry = <TBuilders extends readonly AnyQueryBuilder[]>(
  builders: TBuilders,
  context: BearerQueryRegistryContext,
) => {
  const { injector, latestExecutedQuery, latestNonInternalQuery, applyTokens, executionState, sessionStatus } = context;
  const queries = {} as QueryRegistry<TBuilders>;
  const querySnapshots = new Map<string, Signal<QuerySnapshot<QueryArgs> | null>>();

  // Supersession is provider-wide, not per key. Within one key the reused query already handles it,
  // but a token refresh landing while a login is in flight would otherwise apply its tokens over the
  // login's and report its own outcome as the session's - two writers, two different executions.
  let latestExecutionId = 0;
  const currentExecutions: Signal<CurrentExecution | null>[] = [];

  for (const builder of builders) {
    const querySnapshot = signal<QuerySnapshot<QueryArgs> | null>(null);
    querySnapshots.set(builder.key, querySnapshot);

    const extractTokens = builder.config.extractTokens ?? defaultExtractTokens;

    const currentExecution = signal<CurrentExecution | null>(null);
    currentExecutions.push(currentExecution);

    const isSuperseded = (execution: CurrentExecution) => execution.id !== null && execution.id !== latestExecutionId;

    effect(() => {
      const execution = currentExecution();
      if (!execution) return;

      const { type, snapshot } = execution;
      const response = snapshot.response();
      const loading = snapshot.loading();
      const error = snapshot.error();

      if (loading || isSuperseded(execution)) return;

      if (error) {
        executionState.set({ type, state: 'error', error });
      } else if (response) {
        try {
          const tokens = extractTokens(response);
          applyTokens(tokens.accessToken, tokens.refreshToken);
          executionState.set({ type, state: 'success', response });
        } catch (extractError) {
          executionState.set({ type, state: 'error', error: createQueryErrorResponse(extractError) });

          if (isDevMode()) {
            console.error(`Failed to extract tokens from ${builder.key} response:`, extractError);
          }
        }
      }

      // Keyed on `isAlive` rather than on the branches above: a cancelled restore produces neither a
      // response nor an error, and would otherwise leave `sessionStatus` at `restoring` forever.
      if (type === 'autoLogin' && !snapshot.isAlive() && !untracked(context.isAuthenticated)) {
        sessionStatus.set('anonymous');
      }
    });

    // One query per builder, reused by every execution. A query owns a child injector, a devtools
    // entry and a repository binding holding the request and response bodies - creating one per login
    // attempt or token refresh grows all of that for as long as the tab lives.
    let query: Query<QueryArgs> | null = null;

    const execute = (args?: RequestArgs<QueryArgs>, options?: { triggeredBy?: string }) => {
      query ??= builder.config.queryCreator({ onlyManualExecution: true, injector });

      query.execute({ args, options });
      const snapshot = query.createSnapshot();

      const stateType = deriveExecutionStateType(builder, options?.triggeredBy);
      const isRevocation = stateType === 'revocation';

      if (!isRevocation) {
        latestExecutedQuery.set({ key: builder.key, snapshot });
        if (!snapshot.triggeredBy()) {
          latestNonInternalQuery.set({ key: builder.key, snapshot });
        }
      }
      executionState.set({ type: stateType, state: 'loading' });

      if (stateType === 'autoLogin') {
        sessionStatus.set('restoring');
      }

      currentExecution.set({ id: isRevocation ? null : ++latestExecutionId, type: stateType, snapshot });
      querySnapshot.set(snapshot);
      return snapshot;
    };

    queries[builder.key as ExtractQueryKey<TBuilders[number]>] = {
      execute,
      snapshot: querySnapshot.asReadonly(),
    } as unknown as QueryRegistry<TBuilders>[ExtractQueryKey<TBuilders[number]>];
  }

  const hasTokenIssuingExecutionInFlight = computed(() =>
    currentExecutions.some((execution) => {
      const current = execution();

      return !!current && current.id !== null && current.snapshot.isAlive();
    }),
  );

  const invalidateTokenIssuingExecutions = () => {
    latestExecutionId++;
  };

  return { queries, querySnapshots, hasTokenIssuingExecutionInFlight, invalidateTokenIssuingExecutions };
};

const setupFeatures = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData,
>(
  featureBuilders: TFeatures | undefined,
  context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>,
) => {
  const features: Record<string, unknown> = {};

  /** The features as applied, in order - what the devtools describe. */
  const applied: DescribableFeature[] = [];

  if (!featureBuilders?.length) {
    return { features, applied };
  }

  const featureTypes = new Set<BearerAuthFeatureType>();

  for (const featureSetup of featureBuilders) {
    const feature = featureSetup(context) as BearerAuthFeature<TBuilders, TBearerData> &
      DescribableFeature & { instance: unknown };

    if (featureTypes.has(feature.type)) {
      throw authProviderFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    const featureName = feature.type
      .toLowerCase()
      .split('_')
      .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
      .join('');
    features[featureName] = feature.instance;
    applied.push({ type: feature.type, devtools: feature.devtools });
  }

  return { features, applied };
};

/**
 * Describes the provider's queries for the devtools from what their creators were built with, so a
 * refresh request can be exported before the refresh query has ever run.
 */
const describeAuthQueries = (builders: readonly AnyQueryBuilder[]) =>
  builders.map((builder) => {
    const internals = builder.config.queryCreator.subtle.creatorInternals as { route?: unknown; method?: string };
    const isRefresh = builder._type === 'tokenRefreshQuery';

    return {
      key: builder.key,
      kind: (isRefresh ? 'token-refresh' : 'auth') as 'auth' | 'token-refresh',
      method: internals.method ?? 'POST',
      route: internals.route,
      buildArgs: isRefresh ? builder.buildArgs : undefined,
    };
  });

const alwaysLeader = () => true;

const runEarlyFeatureSetup = (
  featureBuilders: readonly unknown[] | undefined,
  context: BearerAuthProviderEarlySetupContext,
) => {
  let isLeaderFn: () => boolean = alwaysLeader;
  let leaderElectionContext: BearerAuthProviderFeatureContext['leaderElection'];
  let refreshCoordination: BearerAuthRefreshCoordination | undefined;
  let sessionAdoption: BearerAuthSessionAdoption | undefined;
  let activityCoordination: BearerAuthActivityCoordination | undefined;

  for (const featureBuilder of featureBuilders ?? []) {
    const earlySetup = (featureBuilder as BearerAuthProviderEarlySetup).earlySetup;

    if (!earlySetup) continue;

    const result = earlySetup(context);

    isLeaderFn = result.isLeader ?? isLeaderFn;
    leaderElectionContext = result.leaderElection ?? leaderElectionContext;
    refreshCoordination = result.refreshCoordination ?? refreshCoordination;
    sessionAdoption = result.sessionAdoption ?? sessionAdoption;
    activityCoordination = result.activityCoordination ?? activityCoordination;
  }

  return { isLeaderFn, leaderElectionContext, refreshCoordination, sessionAdoption, activityCoordination };
};

const createBearerAuthProviderImpl = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => {
  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const queryClient = config.queryClientRef.inject();
  const unsavedChanges = injectUnsavedChangesCoordinator();

  const accessToken = signal<string | null>(null);
  const refreshToken = signal<string | null>(null);
  const afterTokenRefresh$ = new Subject<void>();

  const bearerData = computed<TBearerData | null>(() => {
    const token = accessToken();
    if (!token) return null;

    try {
      const decoded = config.bearerDecryptFn?.(token) ?? decryptBearer<TBearerData>(token);

      return patchQueryDevtoolsTokenPayload({
        payload: decoded,
        providerName: config.name,
        expiresInPropertyName: 'exp',
      });
    } catch (error) {
      if (isDevMode()) {
        console.error('Failed to decrypt bearer token:', error);
      }
      return null;
    }
  });

  const isAuthenticated = computed(() => !!accessToken());
  const latestExecutedQuery = signal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>(null);
  const latestNonInternalQuery = signal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>(null);
  const executionState = signal<BearerAuthExecutionState | null>(null);
  const sessionStatus = signal<BearerAuthSessionStatus>('unknown');
  const sessionEndCause = signal<BearerAuthSessionEndCause | null>(null);

  const applyTokens = (access: string, refresh: string) => {
    accessToken.set(access);
    refreshToken.set(refresh);
    sessionStatus.set('authenticated');
    sessionEndCause.set(null);
    // Emit on the next microtask so that synchronous reactive work triggered by applying
    // the tokens (signals/effects) has a chance to settle before subscribers react.
    // This avoids rare races where a subscriber reacting to the emission would run
    // before other effects have fully applied the new token state.
    queueMicrotask(() => afterTokenRefresh$.next());
  };

  // Public entry point only - a query-driven login already reports its own, more specific
  // executionState (e.g. `{ type: 'login', state: 'success' }`) via setupBearerQueryRegistry's
  // execute(), so that internal path calls applyTokens directly to avoid stomping it with this.
  const setTokens = (access: string, refresh: string) => {
    // A seed supersedes what is in flight, the way a logout does: the tokens are here, so a cookie
    // auto-login or a refresh still out with an older token can only report a failure that no longer
    // means anything - or apply the pair it comes back with over this one.
    invalidateTokenIssuingExecutions();
    applyTokens(access, refresh);
    executionState.set({ type: 'tokenSeed', state: 'success' });
  };

  const { queries, hasTokenIssuingExecutionInFlight, invalidateTokenIssuingExecutions } = setupBearerQueryRegistry(
    config.queries,
    {
      injector,
      latestExecutedQuery,
      latestNonInternalQuery,
      applyTokens,
      executionState,
      sessionStatus,
      isAuthenticated,
    },
  );

  const logout = (cause: BearerAuthSessionEndCause = 'user') => {
    invalidateTokenIssuingExecutions();
    accessToken.set(null);
    refreshToken.set(null);
    queryClient.repository.unbindAllSecure();
    latestExecutedQuery.set(null);
    latestNonInternalQuery.set(null);
    executionState.set({ type: 'logout', state: 'success' });
    sessionStatus.set('anonymous');
    sessionEndCause.set(cause);

    // Unsaved edits can no longer be saved once the session is gone. Guarding them past this point
    // only strands a "discard your changes?" dialog over the login page the app redirects to, and
    // leaves the tab locked against closing. See `injectUnsavedChangesCoordinator`.
    unsavedChanges.abandonAll('logout');
  };

  const isTabLocalSession = signal(false);

  // Before the features: `withPersistentAuth` starts its cookie auto-login during setup, and a tab that
  // was handed a session of its own must already hold it by then - both so the auto-login stands down,
  // and so the sync and the cookie see the flag before they decide whether to run at all.
  const devtoolsSeed = isQueryDevtoolsEnabled() ? readQueryDevtoolsAuthSeed(config.name) : null;

  if (devtoolsSeed) {
    isTabLocalSession.set(true);
    setTokens(devtoolsSeed.accessToken, devtoolsSeed.refreshToken);
  }

  const isLeader = runEarlyFeatureSetup(config.features, {
    accessToken,
    refreshToken,
    queryClient,
    name: config.name,
    applyTokens,
    setTokens,
    logout,
    sessionEndCause: sessionEndCause.asReadonly(),
    isTabLocalSession: isTabLocalSession.asReadonly(),
  });

  let readAccessTokenExpiry: (() => boolean) | null = null;

  const querySetupContext: BearerAuthProviderQueryContext<TBearerData, TBuilders> = {
    name: config.name,
    accessToken,
    refreshToken,
    bearerDecryptFn: config.bearerDecryptFn,
    queryClient,
    repository: queryClient.repository,
    isLeader: isLeader.isLeaderFn,
    refreshCoordination: isLeader.refreshCoordination,
    logout,
    afterTokenRefresh$,
    queries: queries as unknown as QueryRegistry<TBuilders>,
    latestExecutedQuery: latestExecutedQuery.asReadonly(),
    executionState: executionState.asReadonly(),
    hasTokenIssuingExecutionInFlight,
    reportAccessTokenExpiry: (isExpired) => {
      readAccessTokenExpiry = isExpired;
    },
  };

  for (const builder of config.queries) {
    builder.setup?.(querySetupContext);
  }

  const featureSetupContext: BearerAuthProviderFeatureContext<TBearerData, TBuilders> = {
    name: config.name,
    refreshToken,
    accessToken,
    bearerData,
    logout,
    injector,
    destroyRef,
    setTokens,
    isLeader: isLeader.isLeaderFn,
    isTabLocalSession: isTabLocalSession.asReadonly(),
    leaderElection: isLeader.leaderElectionContext,
    sessionAdoption: isLeader.sessionAdoption,
    activityCoordination: isLeader.activityCoordination,
    afterTokenRefresh$,
    queries: queries as unknown as QueryRegistry<TBuilders>,
    latestExecutedQuery: latestExecutedQuery.asReadonly(),
    executionState,
    sessionStatus: sessionStatus.asReadonly(),
    sessionEndCause: sessionEndCause.asReadonly(),
  };

  const { features, applied: appliedFeatures } = setupFeatures(config.features, featureSetupContext);

  // Runs after the features, because `withPersistentAuth` starts its auto-login during setup. Still
  // `unknown` here means nothing is trying to restore a session, so there is nothing to wait for -
  // unless the join handshake is still out, in which case another tab may be about to hand this one a
  // live session. Saying `anonymous` in that window would send the auth guard to the login page for a
  // session that exists, so the fallback waits for the handshake instead.
  if (sessionStatus() === 'unknown') {
    const adoption = isLeader.sessionAdoption;

    if (adoption?.isPending()) {
      void adoption.settled.then(() => {
        if (sessionStatus() === 'unknown') sessionStatus.set('anonymous');
      });
    } else {
      sessionStatus.set('anonymous');
    }
  }

  const provider = {
    queries,
    features: features as FeatureRegistry<TFeatures, TBuilders>,
    accessToken: accessToken.asReadonly(),
    refreshToken: refreshToken.asReadonly(),
    bearerData,
    isAuthenticated,
    isAccessTokenExpired: () => readAccessTokenExpiry?.() ?? false,
    latestExecutedQuery: latestExecutedQuery.asReadonly(),
    latestNonInternalQuery: latestNonInternalQuery.asReadonly(),
    executionState: executionState.asReadonly(),
    sessionStatus: sessionStatus.asReadonly(),
    sessionEndCause: sessionEndCause.asReadonly(),
    setTokens,
    logout,
    afterTokenRefresh$,
  } as BearerAuthProvider<TBuilders, TFeatures, TBearerData>;

  if (isQueryDevtoolsEnabled()) {
    const unregister = registerQueryDevtoolsEntry({
      kind: 'auth-provider',
      handle: provider,
      clientRef: config.queryClientRef,
      authQueries: describeAuthQueries(config.queries),
      meta: {
        name: config.name,
        clientBaseUrl: queryClient.baseUrl,
        repository: queryClient.repository,
        client: queryClient,
        features: describeQueryDevtoolsFeatures(appliedFeatures),
      },
    });

    destroyRef.onDestroy(unregister);

    destroyRef.onDestroy(
      registerQueryDevtoolsAuthProvider({
        name: config.name,
        handle: provider as unknown as QueryDevtoolsAuthProviderHandle,
        client: queryClient,
        isTabLocalSession,
        injector,
      }),
    );
  }

  return provider;
};

export const createBearerAuthProvider = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData = unknown,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => defineRootProvider(() => createBearerAuthProviderImpl(config), { name: `BearerAuthProvider_${config.name}` });

export type BearerAuthProviderRef<
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[] =
    readonly ((context: BearerAuthProviderFeatureContext<unknown, readonly AnyQueryBuilder[]>) => unknown)[],
  TBearerData = unknown,
> = ProviderDefinition<BearerAuthProvider<TBuilders, TFeatures, TBearerData>>;

export type AnyCreateBearerAuthProviderResult = BearerAuthProviderRef<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The exact provider type behind a `createBearerAuthProvider` result - query keys, feature registry
 * and bearer data all preserved.
 *
 * Prefer this over {@link AnyBearerAuthProvider} whenever the provider is reachable as a value, e.g.
 * when passing one into a helper:
 *
 * ```ts
 * export const myApiAuthProviderRef = createBearerAuthProvider({ ... });
 * export type MyApiAuthProvider = BearerAuthProviderOf<typeof myApiAuthProviderRef>;
 *
 * const doLogin = (provider: MyApiAuthProvider) => provider.queries.login({ body: { ... } });
 * ```
 */
export type BearerAuthProviderOf<TRef extends AnyCreateBearerAuthProviderResult> = NonNullable<
  ReturnType<TRef['inject']>
>;

export type AnyBearerAuthProvider = Omit<
  NonNullable<ReturnType<AnyCreateBearerAuthProviderResult['inject']>>,
  'queries'
> & {
  /**
   * Registry of all configured auth queries.
   *
   * Deliberately untyped here: with unknown builders the mapped type degrades to an index
   * signature, and `noPropertyAccessFromIndexSignature` then rejects `provider.queries.login`
   * (TS4111) - forcing every call site into bracket access or a hand-written structural contract.
   * Use {@link BearerAuthProviderOf} where the concrete provider is reachable and the keys survive.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queries: any;
};
