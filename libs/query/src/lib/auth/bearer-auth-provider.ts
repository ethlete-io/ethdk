import { computed, effect, inject, Injector, isDevMode, Signal, signal, WritableSignal } from '@angular/core';
import { createRootProvider, isObject, ProviderResult } from '@ethlete/core';
import { Observable, Subject } from 'rxjs';
import {
  AnyCreateQueryClientResult,
  authExtractTokensResponseMissingAccessToken,
  authExtractTokensResponseMissingRefreshToken,
  authExtractTokensResponseNotObject,
  authProviderFeatureUsedMultipleTimes,
  QueryArgs,
  QueryClient,
  QueryRepository,
  QuerySnapshot,
  RequestArgs,
  RunQueryExecuteOptions,
} from '../http';
import { decryptBearer } from '../legacy';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProviderTokens,
  TokenRefreshQueryBuilder,
} from './bearer-auth-query-builders';
import {
  InactivityLogoutFeature,
  PersistentAuthFeature,
  TokenExpirationWarningFeature,
  TrackingFeature,
} from './features';
import { setupLeaderElection, setupMultiTabSync } from './internal';

export { AnyQueryBuilder } from './bearer-auth-query-builders';

export const BearerAuthFeatureType = {
  PERSISTENT_AUTH: 'PERSISTENT_AUTH',
  TOKEN_EXPIRATION_WARNING: 'TOKEN_EXPIRATION_WARNING',
  INACTIVITY_LOGOUT: 'INACTIVITY_LOGOUT',
  TOKEN_REVOCATION: 'TOKEN_REVOCATION',
  TRACKING: 'TRACKING',
} as const;

export type BearerAuthFeatureType = (typeof BearerAuthFeatureType)[keyof typeof BearerAuthFeatureType];

export type BearerAuthFeature<TBuilders extends readonly AnyQueryBuilder[], TBearerData> = {
  type: BearerAuthFeatureType;
  setup: (context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown;
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

export type QueryRegistry<TBuilders extends readonly AnyQueryBuilder[]> = {
  [K in ExtractQueryKey<TBuilders[number]>]: {
    execute: (
      args: RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>>,
      options?: RunQueryExecuteOptions,
    ) => QuerySnapshot<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>>;
    snapshot: Signal<QuerySnapshot<ExtractQueryArgs<Extract<TBuilders[number], { key: K }>>> | null>;
  };
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

export type BearerAuthProviderFeatureContext<
  TBearerData = unknown,
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
> = {
  refreshToken: WritableSignal<string | null>;
  afterTokenRefresh$: Observable<void>;
  accessToken: WritableSignal<string | null>;
  bearerData: Signal<TBearerData | null>;
  logout: () => void;
  injector: Injector;
  setTokens: (access: string, refresh: string) => void;
  isLeader: () => boolean;
  queries: QueryRegistry<TBuilders>;
};

export type BearerAuthProviderQueryContext<
  TBearerData = unknown,
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
> = {
  accessToken: WritableSignal<string | null>;
  refreshToken: WritableSignal<string | null>;
  bearerDecryptFn: ((token: string) => TBearerData) | undefined;
  queryClient: QueryClient;
  repository: QueryRepository;
  afterTokenRefresh$: Observable<void>;
  isLeader: () => boolean;
  queries: QueryRegistry<TBuilders>;
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

const setupBearerQueryRegistry = <TBuilders extends readonly AnyQueryBuilder[]>(
  builders: TBuilders,
  injector: Injector,
  latestExecutedQuery: WritableSignal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>,
  latestNonInternalQuery: WritableSignal<{ key: string; snapshot: QuerySnapshot<QueryArgs> } | null>,
  setTokens: (access: string, refresh: string) => void,
) => {
  const queries = {} as QueryRegistry<TBuilders>;
  const querySnapshots = new Map<string, Signal<QuerySnapshot<QueryArgs> | null>>();

  for (const builder of builders) {
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

    const execute = (args: RequestArgs<QueryArgs>, options?: { triggeredBy?: string }) => {
      const query = builder.config.queryCreator({
        onlyManualExecution: true,
        injector,
      });
      query.execute({ args, options });
      const snapshot = query.createSnapshot();

      latestExecutedQuery.set({ key: builder.key, snapshot });
      if (!snapshot.triggeredBy()) {
        latestNonInternalQuery.set({ key: builder.key, snapshot });
      }

      querySnapshot.set(snapshot);
      return snapshot;
    };

    queries[builder.key as ExtractQueryKey<TBuilders[number]>] = {
      execute,
      snapshot: querySnapshot.asReadonly(),
    } as unknown as QueryRegistry<TBuilders>[ExtractQueryKey<TBuilders[number]>];
  }

  return { queries, querySnapshots };
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

  if (!featureBuilders?.length) {
    return features;
  }

  const featureTypes = new Set<BearerAuthFeatureType>();

  for (const featureSetup of featureBuilders) {
    const feature = featureSetup(context) as BearerAuthFeature<TBuilders, TBearerData> & { instance: unknown };

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
  }

  return features;
};

const setupMultiTabSyncIfEnabled = (
  config: CreateBearerAuthProviderConfig<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  accessToken: WritableSignal<string | null>,
  refreshToken: WritableSignal<string | null>,
  queryClient: QueryClient,
) => {
  const multiTabSyncConfig = config.multiTabSync;
  const multiTabSyncEnabled = multiTabSyncConfig !== false && (multiTabSyncConfig?.enabled ?? true);

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
};

const createLeaderElection = (
  config: CreateBearerAuthProviderConfig<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
) => {
  const multiTabSyncConfig = config.multiTabSync;
  const multiTabSyncEnabled = multiTabSyncConfig !== false && (multiTabSyncConfig?.enabled ?? true);
  const leaderElectionEnabled =
    multiTabSyncEnabled &&
    (typeof multiTabSyncConfig === 'object' ? (multiTabSyncConfig?.leaderElection ?? true) : true);
  const leaderElection = leaderElectionEnabled ? setupLeaderElection() : null;
  return () => (leaderElectionEnabled ? (leaderElection?.isLeader() ?? true) : true);
};

const createBearerAuthProviderImpl = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
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

  const setTokens = (access: string, refresh: string) => {
    accessToken.set(access);
    refreshToken.set(refresh);
    afterTokenRefresh$.next();
  };

  const { queries } = setupBearerQueryRegistry(
    config.queries,
    injector,
    latestExecutedQuery,
    latestNonInternalQuery,
    setTokens,
  );

  const logout = () => {
    accessToken.set(null);
    refreshToken.set(null);
    queryClient.repository.unbindAllSecure();
  };

  const isLeader = createLeaderElection(config);

  const querySetupContext: BearerAuthProviderQueryContext<TBearerData, TBuilders> = {
    accessToken,
    refreshToken,
    bearerDecryptFn: config.bearerDecryptFn,
    queryClient,
    repository: queryClient.repository,
    isLeader,
    afterTokenRefresh$,
    queries: queries as unknown as QueryRegistry<TBuilders>,
  };

  for (const builder of config.queries) {
    builder.setup?.(querySetupContext);
  }

  const featureSetupContext: BearerAuthProviderFeatureContext<TBearerData, TBuilders> = {
    refreshToken,
    accessToken,
    bearerData,
    logout,
    injector,
    setTokens,
    isLeader,
    afterTokenRefresh$,
    queries: queries as unknown as QueryRegistry<TBuilders>,
  };

  const features = setupFeatures(config.features, featureSetupContext);

  setupMultiTabSyncIfEnabled(config, accessToken, refreshToken, queryClient);

  return {
    queries,
    features: features as FeatureRegistry<TFeatures, TBuilders>,
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
  TFeatures extends readonly ((context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>) => unknown)[],
  TBearerData = unknown,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => createRootProvider(() => createBearerAuthProviderImpl(config), { name: `BearerAuthProvider_${config.name}` });

export type BearerAuthProviderRef<
  TBuilders extends readonly AnyQueryBuilder[] = readonly AnyQueryBuilder[],
  TFeatures extends readonly ((
    context: BearerAuthProviderFeatureContext<TBearerData, TBuilders>,
  ) => unknown)[] = readonly ((
    context: BearerAuthProviderFeatureContext<unknown, readonly AnyQueryBuilder[]>,
  ) => unknown)[],
  TBearerData = unknown,
> = ProviderResult<BearerAuthProvider<TBuilders, TFeatures, TBearerData>>;

export type AnyCreateBearerAuthProviderResult = BearerAuthProviderRef<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type AnyBearerAuthProvider = NonNullable<ReturnType<AnyCreateBearerAuthProviderResult[1]>>;
