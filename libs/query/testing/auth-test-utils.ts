import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnyFeatureBuilder,
  AuthQueryBuilder,
  BearerAuthProvider,
  createBearerAuthProvider,
  TokenRefreshQueryBuilder,
  withAuthenticationQuery,
  withRefreshQuery,
} from '@ethlete/query';
import { QueryTestSetup } from './query-test-setup';
import { expectFlushAndWait } from './query-test-utils';

export type AuthTestSetupConfig<
  TLoginArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TRefreshArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TFeatures extends readonly AnyFeatureBuilder[] = [],
  TBearerData = unknown,
> = {
  /** The query test setup instance */
  querySetup: QueryTestSetup;
  /** Login endpoint path. Default: '/auth/login' */
  loginPath?: string;
  /** Refresh endpoint path. Default: '/auth/refresh' */
  refreshPath?: string;
  /** Whether to enable auto-retry on 401. Default: false */
  autoRetryOn401?: boolean;
  /** Function to extract tokens from login response */
  extractLoginTokens?: (response: TLoginArgs['response']) => { accessToken: string; refreshToken: string };
  /** Function to extract tokens from refresh response */
  extractRefreshTokens?: (response: TRefreshArgs['response']) => { accessToken: string; refreshToken: string };
  /** Feature builders for additional auth functionality */
  features?: [...TFeatures];
  /** Custom bearer decrypt function for testing */
  bearerDecryptFn?: (token: string) => TBearerData;
  /** Whether to disable multi-tab sync. Default: false */
  multiTabSync?:
    | false
    | { enabled?: boolean; channelName?: string; syncTokens?: boolean; syncLogout?: boolean; leaderElection?: boolean };
};

export type AuthTestSetup<
  TLoginArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TRefreshArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TFeatures extends readonly AnyFeatureBuilder[] = [],
  TBearerData = unknown,
> = {
  /** The bearer auth provider instance */
  auth: BearerAuthProvider<
    [AuthQueryBuilder<'login', TLoginArgs>, TokenRefreshQueryBuilder<'refresh', TRefreshArgs>],
    TFeatures,
    TBearerData
  >;
  /** Helper to login a user and flush the HTTP request */
  login: (credentials: TLoginArgs['body'], response: TLoginArgs['response']) => void;
  /** Helper to trigger a refresh and flush the HTTP request */
  refresh: (token: string, response: TRefreshArgs['response']) => void;
  /** Helper to make a secure request that requires authentication */
  makeSecureRequest: (route: string) => void;
};

export const setupAuthTest = <
  TLoginArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TRefreshArgs extends { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } } = {
    body: Record<string, unknown>;
    response: { accessToken: string; refreshToken: string };
  },
  TFeatures extends readonly AnyFeatureBuilder[] = [],
  TBearerData = unknown,
>(
  config: AuthTestSetupConfig<TLoginArgs, TRefreshArgs, TFeatures, TBearerData>,
): AuthTestSetup<TLoginArgs, TRefreshArgs, TFeatures, TBearerData> => {
  const {
    querySetup,
    loginPath = '/auth/login',
    refreshPath = '/auth/refresh',
    autoRetryOn401 = false,
    extractLoginTokens = (response) => ({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    }),
    extractRefreshTokens = (response) => ({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    }),
    features = [] as unknown as [...TFeatures],
    bearerDecryptFn,
    multiTabSync = false,
  } = config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const login = querySetup.createPost<TLoginArgs>(loginPath as any, {} as any) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refresh = querySetup.createPost<TRefreshArgs>(refreshPath as any, {} as any) as any;

  const [, injectAuth] = createBearerAuthProvider({
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
        autoRetryOn401,
      }),
    ],
    features,
    bearerDecryptFn,
    multiTabSync,
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
      auth.queries.refresh.execute({ body: { token } as any } as any);
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
    auth,
    login: loginHelper,
    refresh: refreshHelper,
    makeSecureRequest,
  };
};
