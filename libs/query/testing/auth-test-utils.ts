import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider, withAuthenticationQuery, withRefreshQuery } from '@ethlete/query';
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
> = {
  querySetup: QueryTestSetup;
  loginPath?: string;
  refreshPath?: string;
  autoRetryOn401?: boolean;
  extractLoginTokens?: (response: TLoginArgs['response']) => { accessToken: string; refreshToken: string };
  extractRefreshTokens?: (response: TRefreshArgs['response']) => { accessToken: string; refreshToken: string };
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
> = {
  auth: NonNullable<ReturnType<ReturnType<typeof createBearerAuthProvider>[1]>>;
  login: (credentials: TLoginArgs['body'], response: TLoginArgs['response']) => void;
  refresh: (token: string, response: TRefreshArgs['response']) => void;
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
>(
  config: AuthTestSetupConfig<TLoginArgs, TRefreshArgs>,
): AuthTestSetup<TLoginArgs, TRefreshArgs> => {
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
