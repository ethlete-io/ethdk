import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  isDevMode,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { createRootProvider, isObject, ProviderResult } from '@ethlete/core';
import { AnyCreateQueryClientResult, QueryArgs, QueryClient, QuerySnapshot, RequestArgs } from '../http';
import { decryptBearer } from '../legacy';
import { CookieStorageFeature, CookieStorageFeatureBuilder } from './bearer-auth-cookie-storage';
import { InactivityLogoutFeature, InactivityLogoutFeatureBuilder } from './bearer-auth-inactivity-logout';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProviderTokens,
  TokenRefreshQueryBuilder,
} from './bearer-auth-query-builders';
import {
  TokenExpirationWarningFeature,
  TokenExpirationWarningFeatureBuilder,
} from './bearer-auth-token-expiration-warning';
import { TokenRevocationFeature, TokenRevocationFeatureBuilder } from './bearer-auth-token-revocation';

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
   * @default { enabled: true, channelName: 'ethlete-auth-sync', syncTokens: true, syncLogout: true }
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
};

export type BearerAuthProviderFeatureContext<TBearerData = unknown> = {
  refreshToken: WritableSignal<string | null>;
  executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => QuerySnapshot<QueryArgs>;
  accessToken: WritableSignal<string | null>;
  bearerData: Signal<TBearerData | null>;
  logout: () => void;
  injector: Injector;
  setTokens: (access: string, refresh: string) => void;
};

export type BearerAuthProviderQueryContext<TBearerData = unknown> = {
  accessToken: WritableSignal<string | null>;
  refreshToken: WritableSignal<string | null>;
  executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => QuerySnapshot<QueryArgs>;
  bearerDecryptFn: ((token: string) => TBearerData) | undefined;
  queryClient: QueryClient;
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
          accessToken.set(tokens.accessToken);
          refreshToken.set(tokens.refreshToken);
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

  const querySetupContext: BearerAuthProviderQueryContext<TBearerData> = {
    accessToken,
    refreshToken,
    executeQuery: (key: string, args: RequestArgs<QueryArgs>, triggeredInternally?: boolean) => {
      const query = queries[key];
      if (!query) {
        throw new Error(`Query "${key}" not found in registry`);
      }
      return query.execute(args, triggeredInternally);
    },
    bearerDecryptFn: config.bearerDecryptFn,
    queryClient,
  };

  for (const builder of config.queries) {
    builder.setup?.(querySetupContext);
  }

  const logout = () => {
    accessToken.set(null);
    refreshToken.set(null);
    queryClient.repository.unbindAllSecure();
  };

  const featureSetupContext: BearerAuthProviderFeatureContext<TBearerData> = {
    refreshToken,
    executeQuery: querySetupContext.executeQuery,
    accessToken,
    bearerData,
    logout,
    injector,
    setTokens: (access: string, refresh: string) => {
      accessToken.set(access);
      refreshToken.set(refresh);
    },
  };

  const features: Record<string, unknown> = {};

  if (config.features?.length) {
    for (const featureBuilder of config.features) {
      features[featureBuilder._type] = featureBuilder.setup(featureSetupContext);
    }
  }

  const multiTabSyncConfig = config.multiTabSync;
  const multiTabSyncEnabled = multiTabSyncConfig !== false && (multiTabSyncConfig?.enabled ?? true);

  if (multiTabSyncEnabled) {
    const destroyRef = inject(DestroyRef);
    const channelName =
      typeof multiTabSyncConfig === 'object'
        ? (multiTabSyncConfig?.channelName ?? 'ethlete-auth-sync')
        : 'ethlete-auth-sync';
    const syncTokens = typeof multiTabSyncConfig === 'object' ? (multiTabSyncConfig?.syncTokens ?? true) : true;
    const syncLogout = typeof multiTabSyncConfig === 'object' ? (multiTabSyncConfig?.syncLogout ?? true) : true;

    let channel: BroadcastChannel | null = null;
    let isProcessingExternalUpdate = false;

    type SyncMessage =
      | {
          type: 'tokens-updated';
          accessToken: string;
          refreshToken: string;
        }
      | {
          type: 'logout';
        };

    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName);

      channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        const message = event.data;

        // Prevent infinite loops
        if (isProcessingExternalUpdate) return;

        isProcessingExternalUpdate = true;

        try {
          if (message.type === 'logout' && syncLogout) {
            logout();
          } else if (message.type === 'tokens-updated' && syncTokens) {
            accessToken.set(message.accessToken);
            refreshToken.set(message.refreshToken);
          }
        } finally {
          isProcessingExternalUpdate = false;
        }
      };

      destroyRef.onDestroy(() => {
        channel?.close();
      });

      // Sync token updates
      if (syncTokens) {
        effect(() => {
          const access = accessToken();
          const refresh = refreshToken();

          if (access && refresh && !isProcessingExternalUpdate && channel) {
            const message: SyncMessage = {
              type: 'tokens-updated',
              accessToken: access,
              refreshToken: refresh,
            };
            channel.postMessage(message);
          }
        });
      }

      // Track logout (when tokens become null after being set)
      if (syncLogout) {
        let hadTokens = false;

        effect(() => {
          const access = accessToken();

          if (access) {
            hadTokens = true;
          } else if (hadTokens && !isProcessingExternalUpdate && channel) {
            // Tokens were cleared = logout
            const message: SyncMessage = {
              type: 'logout',
            };
            channel.postMessage(message);
            hadTokens = false;
          }
        });
      }
    } else if (isDevMode()) {
      console.warn('BroadcastChannel is not supported in this environment. Multi-tab sync will be disabled.');
    }
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
