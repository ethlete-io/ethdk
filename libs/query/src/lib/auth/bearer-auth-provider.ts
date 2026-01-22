import { computed, effect, inject, Injector, isDevMode, Signal, signal, WritableSignal } from '@angular/core';
import { createRootProvider, isObject, ProviderResult } from '@ethlete/core';
import { Observable, Subject } from 'rxjs';
import {
  AnyCreateQueryClientResult,
  QueryArgs,
  QueryClient,
  QueryRepository,
  QuerySnapshot,
  RequestArgs,
} from '../http';
import { decryptBearer } from '../legacy';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProviderTokens,
  TokenRefreshQueryBuilder,
} from './bearer-auth-query-builders';
import {
  CookieStorageFeature,
  CookieStorageFeatureBuilder,
  InactivityLogoutFeature,
  InactivityLogoutFeatureBuilder,
  TokenExpirationWarningFeature,
  TokenExpirationWarningFeatureBuilder,
  TokenRevocationFeature,
  TokenRevocationFeatureBuilder,
} from './features';
import { setupLeaderElection, setupMultiTabSync } from './internal';

export type AnyFeatureBuilder =
  | CookieStorageFeatureBuilder<QueryArgs>
  | TokenExpirationWarningFeatureBuilder
  | InactivityLogoutFeatureBuilder
  | TokenRevocationFeatureBuilder<QueryArgs>;

type ExtractQueryKey<T> =
  T extends AuthQueryBuilder<infer K, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    ? K
    : T extends TokenRefreshQueryBuilder<infer K, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      ? K
      : never;

type ExtractQueryArgs<T> =
  T extends AuthQueryBuilder<string, infer TArgs>
    ? TArgs
    : T extends TokenRefreshQueryBuilder<string, infer TArgs>
      ? TArgs
      : never;

export type QueryRegistry<TBuilders extends readonly AnyQueryBuilder[]> = {
  [K in ExtractQueryKey<TBuilders[number]>]: {
    execute: (
      args: RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>>,
    ) => QuerySnapshot<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>>;
    snapshot: Signal<QuerySnapshot<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>> | null>;
  };
};

type HasCookieStorage<TFeatures extends readonly AnyFeatureBuilder[]> =
  Extract<TFeatures[number], { _type: 'cookieStorage' }> extends never ? false : true;

type HasTokenExpirationWarning<TFeatures extends readonly AnyFeatureBuilder[]> =
  Extract<TFeatures[number], { _type: 'tokenExpirationWarning' }> extends never ? false : true;

type HasInactivityLogout<TFeatures extends readonly AnyFeatureBuilder[]> =
  Extract<TFeatures[number], { _type: 'inactivityLogout' }> extends never ? false : true;

type HasTokenRevocation<TFeatures extends readonly AnyFeatureBuilder[]> =
  Extract<TFeatures[number], { _type: 'tokenRevocation' }> extends never ? false : true;

export type FeatureRegistry<TFeatures extends readonly AnyFeatureBuilder[]> = (HasCookieStorage<TFeatures> extends true
  ? { cookieStorage: CookieStorageFeature }
  : Record<string, never>) &
  (HasTokenExpirationWarning<TFeatures> extends true
    ? { tokenExpirationWarning: TokenExpirationWarningFeature }
    : Record<string, never>) &
  (HasInactivityLogout<TFeatures> extends true
    ? { inactivityLogout: InactivityLogoutFeature }
    : Record<string, never>) &
  (HasTokenRevocation<TFeatures> extends true ? { tokenRevocation: TokenRevocationFeature } : Record<string, never>);

export type CreateBearerAuthProviderConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[],
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
  queries: [...TBuilders];
  /**
   * Feature builders
   */
  features?: [...TFeatures];
  /**
   * A function that decrypts the bearer token
   * @default decryptBearer()
   */
  bearerDecryptFn?: (token: string) => TBearerData;
  /**
   * Multi-tab sync configuration
   * Set to false to disable
   * Leader election is automatically enabled when multiTabSync is enabled
   * @default { enabled: true, channelName: 'ethlete-auth-sync', syncTokens: true, syncLogout: true, leaderElection: true }
   */
  multiTabSync?:
    | false
    | {
        /**
         * Whether multi-tab sync is enabled
         * @default true
         */
        enabled?: boolean;
        /**
         * Channel name for BroadcastChannel
         * @default 'ethlete-auth-sync'
         */
        channelName?: string;
        /**
         * Whether to sync token updates across tabs
         * @default true
         */
        syncTokens?: boolean;
        /**
         * Whether to sync logout across tabs
         * @default true
         */
        syncLogout?: boolean;
        /**
         * Whether to use leader election for token refresh
         * When enabled, only one tab (the leader) will perform automatic token refreshes
         * @default true
         */
        leaderElection?: boolean;
      };
};

export type BearerAuthProvider<
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[],
  TBearerData,
> = {
  /**
   * Registry of all configured auth queries
   */
  queries: QueryRegistry<TBuilders>;

  /**
   * Registry of all configured features
   */
  features: FeatureRegistry<TFeatures>;

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
   * Logout the user (clears all tokens and unbinds secure queries)
   */
  logout: () => void;

  /**
   * Observable that emits after a successful token refresh.
   * Secure queries can subscribe to this to re-execute themselves with the new token.
   */
  afterTokenRefresh$: Observable<void>;
};

export type BearerAuthProviderFeatureContext<TBearerData = unknown> = {
  refreshToken: WritableSignal<string | null>;
  executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => QuerySnapshot<QueryArgs>;
  afterTokenRefresh$: Observable<void>;
  accessToken: WritableSignal<string | null>;
  bearerData: Signal<TBearerData | null>;
  logout: () => void;
  injector: Injector;
  setTokens: (access: string, refresh: string) => void;
  isLeader: () => boolean;
};

export type BearerAuthProviderQueryContext<TBearerData = unknown> = {
  accessToken: WritableSignal<string | null>;
  refreshToken: WritableSignal<string | null>;
  executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => QuerySnapshot<QueryArgs>;
  bearerDecryptFn: ((token: string) => TBearerData) | undefined;
  queryClient: QueryClient;
  repository: QueryRepository;
  afterTokenRefresh$: Observable<void>;
  isLeader: () => boolean;
};

const createBearerAuthProviderImpl = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[],
  TBearerData,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => {
  const injector = inject(Injector);
  const queryClient = config.queryClientRef[1]();

  const accessToken = signal<string | null>(null);
  const refreshToken = signal<string | null>(null);
  const afterTokenRefresh$ = new Subject<void>();

  const bearerData = computed<TBearerData | null>(() => {
    const token = accessToken();
    if (!token) return null;

    try {
      return config.bearerDecryptFn?.(token) ?? decryptBearer<TBearerData>(token);
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

  type QueriesRegistry = Record<
    string,
    {
      execute: (args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => QuerySnapshot<QueryArgs>;
      snapshot: Signal<QuerySnapshot<QueryArgs> | null>;
    }
  >;
  const queries: QueriesRegistry = {};
  const querySnapshots = new Map<string, Signal<QuerySnapshot<QueryArgs> | null>>();

  const defaultExtractTokens = (response: unknown): BearerAuthProviderTokens => {
    if (!isObject(response)) {
      throw new Error('Response is not an object');
    }
    if (!('accessToken' in response) || typeof response['accessToken'] !== 'string') {
      throw new Error('Response does not contain accessToken property');
    }
    if (!('refreshToken' in response) || typeof response['refreshToken'] !== 'string') {
      throw new Error('Response does not contain refreshToken property');
    }
    return { accessToken: response['accessToken'], refreshToken: response['refreshToken'] };
  };

  const setTokens = (access: string, refresh: string) => {
    accessToken.set(access);
    refreshToken.set(refresh);
    afterTokenRefresh$.next();
  };

  for (const builder of config.queries) {
    const querySnapshot = signal<QuerySnapshot<QueryArgs> | null>(null);
    querySnapshots.set(builder.key, querySnapshot);

    const extractTokens = builder.config.extractTokens ?? defaultExtractTokens;

    effect(() => {
      const snapshot = querySnapshot();
      if (!snapshot) return;

      const response = snapshot.response();
      const loading = snapshot.loading();
      const error = snapshot.error();

      if (response && !loading && !error) {
        try {
          const tokens = extractTokens(response);
          setTokens(tokens.accessToken, tokens.refreshToken);
        } catch (extractError) {
          if (isDevMode()) {
            console.error(`Failed to extract tokens from ${builder.key} response:`, extractError);
          }
        }
      }
    });

    const execute = (args: RequestArgs<QueryArgs>, triggeredInternally = false) => {
      const query = builder.config.queryCreator({ onlyManualExecution: true, injector });

      query.execute({ args });

      const snapshot = query.createSnapshot();

      latestExecutedQuery.set({ key: builder.key, snapshot });
      if (!triggeredInternally) {
        latestNonInternalQuery.set({ key: builder.key, snapshot });
      }

      querySnapshot.set(snapshot);

      return snapshot;
    };

    queries[builder.key] = {
      execute,
      snapshot: querySnapshot.asReadonly(),
    };
  }

  const logout = () => {
    accessToken.set(null);
    refreshToken.set(null);
    queryClient.repository.unbindAllSecure();
  };

  const multiTabSyncConfig = config.multiTabSync;
  const multiTabSyncEnabled = multiTabSyncConfig !== false && (multiTabSyncConfig?.enabled ?? true);
  const leaderElectionEnabled =
    multiTabSyncEnabled &&
    (typeof multiTabSyncConfig === 'object' ? (multiTabSyncConfig?.leaderElection ?? true) : true);

  const leaderElection = leaderElectionEnabled ? setupLeaderElection() : null;

  const isLeader = () => {
    if (!leaderElectionEnabled) return true;
    return leaderElection?.isLeader() ?? true;
  };

  const querySetupContext: BearerAuthProviderQueryContext<TBearerData> = {
    accessToken,
    refreshToken,
    executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => {
      const query = queries[key];
      if (!query) {
        throw new Error(`Query "${key}" not found in registry`);
      }

      if (query.snapshot()?.loading()) return query.snapshot() as QuerySnapshot<QueryArgs>;

      return query.execute(args, triggeredInternally);
    },
    bearerDecryptFn: config.bearerDecryptFn,
    queryClient,
    repository: queryClient.repository,
    isLeader,
    afterTokenRefresh$,
  };

  for (const builder of config.queries) {
    builder.setup?.(querySetupContext);
  }

  const featureSetupContext: BearerAuthProviderFeatureContext<TBearerData> = {
    refreshToken,
    executeQuery: querySetupContext.executeQuery,
    accessToken,
    bearerData,
    logout,
    injector,
    setTokens,
    isLeader,
    afterTokenRefresh$,
  };

  const features: Record<string, unknown> = {};

  if (config.features?.length) {
    for (const featureBuilder of config.features) {
      features[featureBuilder._type] = featureBuilder.setup(featureSetupContext);
    }
  }

  if (multiTabSyncEnabled) {
    setupMultiTabSync(
      {
        channelName: typeof multiTabSyncConfig === 'object' ? multiTabSyncConfig?.channelName : undefined,
        syncTokens: typeof multiTabSyncConfig === 'object' ? multiTabSyncConfig?.syncTokens : undefined,
        syncLogout: typeof multiTabSyncConfig === 'object' ? multiTabSyncConfig?.syncLogout : undefined,
      },
      accessToken,
      refreshToken,
      queryClient,
    );
  }

  return {
    queries: queries as unknown as QueryRegistry<TBuilders>,
    features: features as FeatureRegistry<TFeatures>,
    accessToken: accessToken.asReadonly(),
    refreshToken: refreshToken.asReadonly(),
    bearerData,
    isAuthenticated,
    latestExecutedQuery: latestExecutedQuery.asReadonly(),
    latestNonInternalQuery: latestNonInternalQuery.asReadonly(),
    logout,
    afterTokenRefresh$,
  } as BearerAuthProvider<TBuilders, TFeatures, TBearerData>;
};

export const createBearerAuthProvider = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[],
  TBearerData = unknown,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => createRootProvider(() => createBearerAuthProviderImpl(config), { name: `BearerAuthProvider_${config.name}` });

export type BearerAuthProviderRef<
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[] = readonly AnyFeatureBuilder[],
  TBearerData = unknown,
> = ProviderResult<BearerAuthProvider<TBuilders, TFeatures, TBearerData>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCreateBearerAuthProviderResult = BearerAuthProviderRef<any, any, any>;
export type AnyBearerAuthProvider = NonNullable<ReturnType<AnyCreateBearerAuthProviderResult[1]>>;
