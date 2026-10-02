import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnyQueryBuilder,
  AuthQueryBuilder,
  BearerAuthProvider,
  BearerAuthProviderFeatureContext,
  createBearerAuthProvider,
  FeatureRegistry,
  TokenRefreshQueryBuilder,
  TokenRefreshQueryConfig,
  withAuthenticationQuery,
  withRefreshQuery,
} from '@ethlete/query';
import { QueryTestSetup } from './query-test-setup';
import { expectFlushAndWait } from './query-test-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFeatureBuilder = (context: BearerAuthProviderFeatureContext<any, readonly AnyQueryBuilder[]>) => {
  type: string;
  instance: unknown;
};

type AuthTestArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };

/** The query builders of the provider {@link setupAuthTest} builds: a `login` and a `refresh` query. */
export type AuthTestQueryBuilders<
  TLoginArgs extends AuthTestArgs = AuthTestArgs,
  TRefreshArgs extends AuthTestArgs = AuthTestArgs,
> = [AuthQueryBuilder<'login', TLoginArgs>, TokenRefreshQueryBuilder<'refresh', TRefreshArgs>];

/** A feature for the provider {@link setupAuthTest} builds, typed against its `login`/`refresh` queries. */
export type AuthTestFeatureBuilder = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: BearerAuthProviderFeatureContext<any, AuthTestQueryBuilders>,
) => unknown;

export type AuthTestSetupConfig<
  TLoginArgs extends AuthTestArgs = AuthTestArgs,
  TRefreshArgs extends AuthTestArgs = AuthTestArgs,
  TFeatures extends readonly AuthTestFeatureBuilder[] = [],
  TBearerData = unknown,
> = {
  /** The query test setup instance */
  querySetup: QueryTestSetup;
  /** Login endpoint path. Default: '/auth/login' */
  loginPath?: string;
  /** Refresh endpoint path. Default: '/auth/refresh' */
  refreshPath?: string;
  /** Whether to refresh and retry a secure request that answers 401. Default: true, as in production */
  autoRetryOn401?: boolean;
  /** Function to extract tokens from login response */
  extractLoginTokens?: (response: TLoginArgs['response']) => { accessToken: string; refreshToken: string };
  /** Function to extract tokens from refresh response */
  extractRefreshTokens?: (response: TRefreshArgs['response']) => { accessToken: string; refreshToken: string };
  /** Builds the refresh request from the refresh token. See TokenRefreshQueryConfig for details */
  buildRefreshArgs?: TokenRefreshQueryConfig<TRefreshArgs>['buildArgs'];
  /** Feature builders for additional auth functionality */
  features?: TFeatures;
  /** Custom bearer decrypt function for testing */
  bearerDecryptFn?: (token: string) => TBearerData;
  /** Refresh strategy configuration. See TokenRefreshQueryConfig for details */
  refreshStrategy?: TokenRefreshQueryConfig<TRefreshArgs>['refreshStrategy'];
  /** Minimum refresh interval in milliseconds */
  minRefreshInterval?: number;
  /** Whether to refresh if token is already expired */
  refreshIfExpired?: boolean;
  /** Property name for expiration in JWT */
  expiresInPropertyName?: string;
  /** What to do when the refresh query fails for good. Defaults to the provider's own policy */
  onRefreshFailure?: TokenRefreshQueryConfig<TRefreshArgs>['onRefreshFailure'];
};

export type AuthTestSetup<
  TLoginArgs extends AuthTestArgs = AuthTestArgs,
  TRefreshArgs extends AuthTestArgs = AuthTestArgs,
  TFeatures extends readonly AuthTestFeatureBuilder[] = [],
  TBearerData = unknown,
> = {
  /** The bearer auth provider instance */
  auth: Omit<BearerAuthProvider<AuthTestQueryBuilders<TLoginArgs, TRefreshArgs>, [], TBearerData>, 'features'> & {
    features: FeatureRegistry<TFeatures, AuthTestQueryBuilders<TLoginArgs, TRefreshArgs>>;
  };
  /** Helper to login a user and flush the HTTP request */
  login: (credentials: TLoginArgs['body'], response: TLoginArgs['response']) => void;
  /** Helper to trigger a refresh and flush the HTTP request. Sends `buildRefreshArgs(token)` when configured, else `{ body: { token } }` */
  refresh: (token: string, response: TRefreshArgs['response']) => void;
  /** Helper to make a secure request that requires authentication */
  makeSecureRequest: (route: string) => void;
};

export const setupAuthTest = <
  TLoginArgs extends AuthTestArgs = AuthTestArgs,
  TRefreshArgs extends AuthTestArgs = AuthTestArgs,
  TFeatures extends readonly AuthTestFeatureBuilder[] = readonly AuthTestFeatureBuilder[],
  TBearerData = unknown,
>(
  config: AuthTestSetupConfig<TLoginArgs, TRefreshArgs, TFeatures, TBearerData>,
): AuthTestSetup<TLoginArgs, TRefreshArgs, TFeatures, TBearerData> => {
  const {
    querySetup,
    loginPath = '/auth/login',
    refreshPath = '/auth/refresh',
    autoRetryOn401 = true,
    extractLoginTokens = (response) => ({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    }),
    extractRefreshTokens = (response) => ({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    }),
    buildRefreshArgs,
    features,
    bearerDecryptFn,
    refreshStrategy,
    minRefreshInterval,
    refreshIfExpired,
    expiresInPropertyName,
    onRefreshFailure,
  } = config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const login = querySetup.createPost<TLoginArgs>(loginPath as any, {} as any) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refresh = querySetup.createPost<TRefreshArgs>(refreshPath as any, {} as any) as any;

  const { inject: injectAuth } = createBearerAuthProvider({
    name: 'test-auth',
    queryClientRef: querySetup.queryClientRef,
    queries: [
      withAuthenticationQuery('login', {
        queryCreator: login,
        extractTokens: extractLoginTokens,
      }),
      withRefreshQuery('refresh', {
        queryCreator: refresh,
        extractTokens: extractRefreshTokens,
        buildArgs: buildRefreshArgs,
        autoRetryOn401,
        refreshStrategy,
        minRefreshInterval,
        refreshIfExpired,
        expiresInPropertyName,
        onRefreshFailure,
      }),
    ] as AuthTestQueryBuilders<TLoginArgs, TRefreshArgs>,
    features: (features ?? []) as unknown as readonly ((
      context: BearerAuthProviderFeatureContext<TBearerData, AuthTestQueryBuilders<TLoginArgs, TRefreshArgs>>,
    ) => unknown)[],
    bearerDecryptFn,
  });

  const auth = TestBed.runInInjectionContext(() => {
    const provider = injectAuth();
    if (!provider) {
      throw new Error('Failed to create auth provider in test setup');
    }
    return provider;
  });

  const loginHelper = (credentials: TLoginArgs['body'], response: TLoginArgs['response']) => {
    TestBed.runInInjectionContext(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth.queries.login.execute({ body: credentials } as any);
    });
    const fullUrl = `${querySetup.baseUrl}${loginPath}`;
    expectFlushAndWait(querySetup.httpTesting, fullUrl, response);
  };

  const refreshHelper = (token: string, response: TRefreshArgs['response']) => {
    TestBed.runInInjectionContext(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth.queries.refresh.execute((buildRefreshArgs?.(token) ?? { body: { token } }) as any);
    });
    const fullUrl = `${querySetup.baseUrl}${refreshPath}`;
    expectFlushAndWait(querySetup.httpTesting, fullUrl, response);
  };

  const makeSecureRequest = (route: string) => {
    TestBed.runInInjectionContext(() => {
      querySetup.queryClient.repository.request({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        route: route as any,
        method: 'GET',
        isSecure: true,
        consumerDestroyRef: TestBed.inject(DestroyRef),
      });
    });
  };

  return {
    auth: auth as unknown as AuthTestSetup<TLoginArgs, TRefreshArgs, TFeatures, TBearerData>['auth'],
    login: loginHelper,
    refresh: refreshHelper,
    makeSecureRequest,
  };
};
