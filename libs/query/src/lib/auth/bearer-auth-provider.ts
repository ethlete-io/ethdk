import { computed, effect, inject, Injector, isDevMode, Signal, signal } from '@angular/core';
import { createRootProvider, isObject, ProviderResult } from '@ethlete/core';
import { AnyCreateQueryClientResult, QueryArgs, QuerySnapshot, RequestArgs } from '../http';
import { CookieStorageFeature, CookieStorageFeatureBuilder } from './bearer-auth-cookie-storage';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProviderTokens,
  TokenRefreshQueryBuilder,
} from './bearer-auth-query-builders';

export type AnyFeatureBuilder = CookieStorageFeatureBuilder<QueryArgs>;

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

export type FeatureRegistry<TFeatures extends readonly AnyFeatureBuilder[]> =
  HasCookieStorage<TFeatures> extends true
    ? {
        cookieStorage: CookieStorageFeature;
      }
    : Record<string, never>;

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
   */
  bearerDecryptFn?: (token: string) => TBearerData;
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
   * The decrypted bearer data (if bearerDecryptFn was provided)
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

const createBearerAuthProviderImpl = <
  TBuilders extends readonly AnyQueryBuilder[],
  TFeatures extends readonly AnyFeatureBuilder[],
  TBearerData,
>(
  config: CreateBearerAuthProviderConfig<TBuilders, TFeatures, TBearerData>,
) => {
  // Capture injector for use in async query creation
  const injector = inject(Injector);
  
  const queryClient = config.queryClientRef[1]();

  if (!queryClient) {
    throw new Error(`Query client not found for auth provider "${config.name}"`);
  }

  const accessToken = signal<string | null>(null);
  const refreshToken = signal<string | null>(null);

  const bearerData = computed<TBearerData | null>(() => {
    const token = accessToken();
    if (!token || !config.bearerDecryptFn) return null;

    try {
      return config.bearerDecryptFn(token);
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

  const querySetupContext = {
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

  const featureSetupContext = {
    refreshToken,
    executeQuery: querySetupContext.executeQuery,
  };

  const features: Record<string, unknown> = {};

  if (config.features?.length) {
    for (const featureBuilder of config.features) {
      if (featureBuilder._type === 'cookieStorage') {
        features['cookieStorage'] = featureBuilder.setup(featureSetupContext);
      }
    }
  }

  const logout = () => {
    accessToken.set(null);
    refreshToken.set(null);
    queryClient.repository.unbindAllSecure();
  };

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
