import { computed, effect, isDevMode, Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  deleteCookie as coreDeleteCookie,
  createRootProvider,
  getCookie,
  getDomain,
  injectRoute,
  isObject,
  ProviderResult,
  setCookie,
} from '@ethlete/core';
import { of, switchMap, tap, timer } from 'rxjs';
import { AnyCreateQueryClientResult, QueryArgs, QueryCreator, QuerySnapshot, RequestArgs, ResponseType } from '../http';
import {
  bearerExpiresInPropertyNotNumber,
  cookieLoginTriedButCookieDisabled,
  defaultResponseTransformerResponseNotContainingAccessToken,
  defaultResponseTransformerResponseNotContainingRefreshToken,
  defaultResponseTransformerResponseNotObject,
  disableCookieCalledWithoutCookieConfig,
  enableCookieCalledWithoutCookieConfig,
  loginCalledWithoutConfig,
  loginWithTokenCalledWithoutConfig,
  refreshTokenCalledWithoutConfig,
  selectRoleCalledWithoutConfig,
  unableToDecryptBearerToken,
} from '../http/query-errors';
import { decryptBearer } from '../legacy/auth';

type InternalQueryExecuteOptions = {
  triggeredInternally?: boolean;
};

type AuthProviderQueryWithType<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
> =
  | {
      type: 'login';
      query: ReturnType<typeof createAuthProviderQuery<TLoginArgs>> | null;
    }
  | {
      type: 'tokenLogin';
      query: ReturnType<typeof createAuthProviderQuery<TTokenLoginArgs>> | null;
    }
  | {
      type: 'tokenRefresh';
      query: ReturnType<typeof createAuthProviderQuery<TTokenRefreshArgs>> | null;
    }
  | {
      type: 'selectRole';
      query: ReturnType<typeof createAuthProviderQuery<TSelectRoleArgs>> | null;
    };

type QuerySnapshotWithType<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
> =
  | ({
      type: 'login';
    } & QuerySnapshot<TLoginArgs>)
  | ({
      type: 'tokenLogin';
    } & QuerySnapshot<TTokenLoginArgs>)
  | ({
      type: 'tokenRefresh';
    } & QuerySnapshot<TTokenRefreshArgs>)
  | ({
      type: 'selectRole';
    } & QuerySnapshot<TSelectRoleArgs>);

export type BearerAuthProvider<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
  TBearerData,
> = {
  /**
   * Logs in the user with the given args.
   */
  login: (args: RequestArgs<TLoginArgs>) => QuerySnapshot<TLoginArgs>;

  /**
   * Logs in the user with the given token.
   */
  loginWithToken: (args: RequestArgs<TTokenLoginArgs>) => QuerySnapshot<TTokenLoginArgs>;

  /**
   * Refreshes the token with the given refresh token.
   */
  refreshToken: (args: RequestArgs<TTokenRefreshArgs>) => QuerySnapshot<TTokenRefreshArgs>;

  /**
   * Selects the role for the user.
   */
  selectRole: (args: RequestArgs<TSelectRoleArgs>) => QuerySnapshot<TSelectRoleArgs>;

  /**
   * Logs out the user and removes the cookie.
   */
  logout: () => void;

  /**
   * Enables cookie usage for the auth provider.
   */
  enableCookie: () => void;

  /**
   * Disables cookie usage for the auth provider and removes the cookie.
   */
  disableCookie: () => void;

  /**
   * Checks if the cookie is present.
   */
  isCookiePresent: () => boolean;

  /**
   * Tries to login with the given cookie config.
   * Returns `true` if a cookie was found, `false` otherwise.
   */
  tryLoginWithCookie: () => boolean;

  /**
   * The latest executed query that was not triggered internally.
   */
  latestExecutedQuery: Signal<QuerySnapshotWithType<
    TLoginArgs,
    TTokenLoginArgs,
    TTokenRefreshArgs,
    TSelectRoleArgs
  > | null>;

  /**
   * A signal that contains the current access and refresh tokens.
   */
  tokens: Signal<BearerAuthProviderTokens | null>;

  /**
   * The bearer data that was decrypted from the access token.
   */
  bearerData: Signal<TBearerData | null>;
};

const defaultResponseTransformer = <T>(response: T) => {
  if (!isObject(response)) {
    throw defaultResponseTransformerResponseNotObject(typeof response);
  }

  if (!('accessToken' in response)) {
    throw defaultResponseTransformerResponseNotContainingAccessToken();
  }

  if (!('refreshToken' in response)) {
    throw defaultResponseTransformerResponseNotContainingRefreshToken();
  }

  return response as unknown as BearerAuthProviderTokens;
};

const FIVE_MINUTES = 5 * 60 * 1000;

const createAuthProviderQuery = <T extends QueryArgs>(
  config: BearerAuthProviderRouteConfig<T>,
  authProviderConfig: {
    /**
     * The time in milliseconds before the token expires when the refresh should be triggered.
     * @default 300000 // (5 minutes)
     */
    refreshBuffer?: number;

    /**
     * The expires in property name inside the jwt body
     * @default 'exp'
     */
    expiresInPropertyName?: string;
  },
) => {
  const query = config.queryCreator({ onlyManualExecution: true });

  const triggeredInternally = signal(false);

  const tokens = computed(() => {
    const res = query.response();

    if (!res) return null;

    const transformed = config.responseTransformer?.(res) ?? defaultResponseTransformer(res);

    const bearerValue = decryptBearer(transformed.accessToken);

    if (!bearerValue) throw unableToDecryptBearerToken(transformed.accessToken);

    return {
      bearer: bearerValue,
      tokens: transformed,
    };
  });

  const expiresIn = computed(() => {
    const res = tokens();

    if (!res) return null;

    const expiresIn = res.bearer[authProviderConfig.expiresInPropertyName ?? 'exp'];
    const refreshBuffer = authProviderConfig.refreshBuffer ?? FIVE_MINUTES;

    if (typeof expiresIn !== 'number') {
      throw bearerExpiresInPropertyNotNumber(expiresIn);
    }

    // const dummyRemainingTime = (query.lastTimeExecutedAt() ?? 0) + 5000 - new Date().getTime();
    const remainingTime = new Date(expiresIn * 1000).getTime() - refreshBuffer - new Date().getTime();

    return remainingTime;
  });

  const execute = (newArgs: RequestArgs<T>, options?: InternalQueryExecuteOptions) => {
    query.execute({ args: newArgs });
    triggeredInternally.set(options?.triggeredInternally ?? false);
  };

  return {
    execute,
    query,
    tokens,
    expiresIn,
    triggeredInternally: triggeredInternally.asReadonly(),
  };
};

const createBearerAuthProviderImpl = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
  TBearerData,
>(
  options: CreateBearerAuthProviderConfigOptions<
    TLoginArgs,
    TTokenLoginArgs,
    TTokenRefreshArgs,
    TSelectRoleArgs,
    TBearerData
  >,
): BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs, TBearerData> => {
  const route = injectRoute();

  const [, injectClient] = options.queryClientRef;
  const client = injectClient();

  const cookieEnabled = signal(options.cookie === undefined ? false : (options.cookie.enabled ?? true));
  const cookieOptions: Required<Omit<BearerAuthProviderCookieConfig<TTokenRefreshArgs>, 'enabled'>> = {
    expiresInDays: 30,
    name: 'etAuth',
    path: '/',
    sameSite: 'lax',
    domain: getDomain() ?? 'localhost',
    refreshArgsTransformer: (token) => ({ body: { token } }) as RequestArgs<TTokenRefreshArgs>,
    autoLoginExcludeRoutes: [],
    ...(options.cookie ?? {}),
  };

  const loginQuery = options.login ? createAuthProviderQuery(options.login, options) : null;
  const tokenLoginQuery = options.tokenLogin ? createAuthProviderQuery(options.tokenLogin, options) : null;
  const tokenRefreshQuery = options.tokenRefresh ? createAuthProviderQuery(options.tokenRefresh, options) : null;
  const selectRoleQuery = options.selectRole ? createAuthProviderQuery(options.selectRole, options) : null;

  const queries: AuthProviderQueryWithType<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>[] = [
    { type: 'login', query: loginQuery },
    { type: 'tokenLogin', query: tokenLoginQuery },
    { type: 'tokenRefresh', query: tokenRefreshQuery },
    { type: 'selectRole', query: selectRoleQuery },
  ];

  const latestExecutedQuery = computed(() => {
    const relevantQueries = queries.filter((q) => q.query && q.query.query.lastTimeExecutedAt() !== null);

    return findMostRecentQuery(relevantQueries);
  });

  const tokens = computed(() => {
    const query = latestExecutedQuery();

    return query?.query?.tokens()?.tokens ?? null;
  });

  const bearerData = computed(() => {
    const accessToken = tokens()?.accessToken;

    if (!accessToken) return null;

    return (options.bearerDecryptFn?.(accessToken) ?? decryptBearer(accessToken)) as TBearerData | null;
  });

  toObservable(
    computed(() => {
      const query = latestExecutedQuery();
      const expiresIn = query?.query?.expiresIn() ?? null;
      const tokens = query?.query?.tokens() ?? null;

      return { expiresIn, tokens, query };
    }),
  )
    .pipe(
      switchMap((res) => {
        if (!res.tokens || res.expiresIn === null || !options.tokenRefresh) return of(null);

        const expIn = res.expiresIn;
        const tokens = res.tokens;

        if (!expIn || !tokens) return of(null);

        return timer(expIn).pipe(
          tap(() =>
            refreshToken(
              {
                ...cookieOptions.refreshArgsTransformer(tokens.tokens.refreshToken),
              },
              { triggeredInternally: true },
            ),
          ),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  const latestNonInternalQuery = signal<QuerySnapshotWithType<
    TLoginArgs,
    TTokenLoginArgs,
    TTokenRefreshArgs,
    TSelectRoleArgs
  > | null>(null);

  effect(() => {
    const relevantQueries = queries.filter(
      (q) => q.query && !q.query.triggeredInternally() && q.query.query.lastTimeExecutedAt() !== null,
    );

    const lastQuery = findMostRecentQuery(relevantQueries);

    untracked(() => {
      if (!lastQuery || !lastQuery.query?.query) return;

      latestNonInternalQuery.set({
        type: lastQuery.type,
        ...lastQuery.query.query.createSnapshot(),
      } as QuerySnapshotWithType<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>);
    });
  });

  // Cookie writing
  effect(() => {
    const isCookieEnabled = cookieEnabled();
    const res = latestExecutedQuery();
    const error = res?.query?.query.error();

    if (!isCookieEnabled || (error && error.code === 401)) {
      deleteCookie();
      return;
    }

    if (!res?.query) return;

    const { tokens } = res.query;

    const rt = tokens()?.tokens.refreshToken;

    if (!rt) return;

    writeCookie(rt);
  });

  const login = (args: RequestArgs<TLoginArgs>) => {
    if (!loginQuery) {
      throw loginCalledWithoutConfig();
    }

    loginQuery.execute(args);

    return loginQuery.query.createSnapshot();
  };

  const loginWithToken = (args: RequestArgs<TTokenLoginArgs>) => {
    if (!tokenLoginQuery) {
      throw loginWithTokenCalledWithoutConfig();
    }

    tokenLoginQuery.execute(args);

    return tokenLoginQuery.query.createSnapshot();
  };

  const refreshToken = (args: RequestArgs<TTokenRefreshArgs>, options?: InternalQueryExecuteOptions) => {
    if (!tokenRefreshQuery) {
      throw refreshTokenCalledWithoutConfig();
    }

    tokenRefreshQuery.execute(args, { triggeredInternally: options?.triggeredInternally });

    return tokenRefreshQuery.query.createSnapshot();
  };

  const selectRole = (args: RequestArgs<TSelectRoleArgs>) => {
    if (!selectRoleQuery) {
      throw selectRoleCalledWithoutConfig();
    }

    selectRoleQuery.execute(args);

    return selectRoleQuery.query.createSnapshot();
  };

  const logout = () => {
    deleteCookie();
    loginQuery?.query.reset();
    tokenLoginQuery?.query.reset();
    tokenRefreshQuery?.query.reset();
    selectRoleQuery?.query.reset();
    latestNonInternalQuery.set(null);

    client.repository.unbindAllSecure();
  };

  const enableCookie = () => {
    if (isDevMode() && !options.cookie) {
      throw enableCookieCalledWithoutCookieConfig();
    }

    cookieEnabled.set(true);
  };

  const disableCookie = () => {
    if (isDevMode() && !options.cookie) {
      throw disableCookieCalledWithoutCookieConfig();
    }

    cookieEnabled.set(false);
    deleteCookie();
  };

  const isCookiePresent = () => {
    return !!getCookie(cookieOptions.name);
  };

  const tryLoginWithCookie = () => {
    const isCookieEnabled = cookieEnabled();

    if (!isCookieEnabled) {
      if (isDevMode()) {
        throw cookieLoginTriedButCookieDisabled();
      }
      return false;
    }

    const cookie = getCookie(cookieOptions.name);

    if (!cookie) {
      return false;
    }

    refreshToken(cookieOptions.refreshArgsTransformer(cookie));

    return true;
  };

  const writeCookie = (refreshToken: string) => {
    const { name, expiresInDays, domain, path, sameSite } = cookieOptions;

    setCookie(name, refreshToken, expiresInDays, domain, path, sameSite);
  };

  const deleteCookie = () => {
    const { name, path, domain } = cookieOptions;

    coreDeleteCookie(name, path, domain);
  };

  const findMostRecentQuery = (
    queriesToSearch: AuthProviderQueryWithType<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>[],
  ) => {
    return queriesToSearch.reduce(
      (acc, curr) => {
        if (!acc) return curr;

        const accExp = acc.query?.query.lastTimeExecutedAt() ?? null;
        const currExp = curr.query?.query.lastTimeExecutedAt() ?? null;

        if (currExp === null || accExp === null) return acc;

        return accExp > currExp ? acc : curr;
      },
      null as AuthProviderQueryWithType<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs> | null,
    );
  };

  const bearerAuthProvider: BearerAuthProvider<
    TLoginArgs,
    TTokenLoginArgs,
    TTokenRefreshArgs,
    TSelectRoleArgs,
    TBearerData
  > = {
    login,
    loginWithToken,
    refreshToken,
    selectRole,
    logout,
    enableCookie,
    disableCookie,
    isCookiePresent,
    tryLoginWithCookie,
    latestExecutedQuery: latestNonInternalQuery.asReadonly(),
    tokens,
    bearerData,
  };

  if (cookieEnabled()) {
    if (!cookieOptions.autoLoginExcludeRoutes.some((r) => route().startsWith(r))) {
      tryLoginWithCookie();
    }
  }

  return bearerAuthProvider;
};

export type BearerAuthProviderTokens = {
  accessToken: string;
  refreshToken: string;
};

export type BearerAuthProviderRouteConfig<TArgs extends QueryArgs> = {
  queryCreator: QueryCreator<TArgs>;

  /**
   * A function that transforms the response into the format that the auth provider expects
   *
   * The expected format is an object with the `accessToken` and `refreshToken` properties.
   *
   * @default (response) => response
   */
  responseTransformer?: (response: ResponseType<TArgs>) => BearerAuthProviderTokens;
};

export type BearerAuthProviderCookieConfig<TTokenRefreshArgs extends QueryArgs> = {
  /**
   * The cookie name where the refresh token is stored
   * @default 'etAuth'
   */
  name?: string;

  /**
   * The domain of the cookie. If not set, the current origin will be used.
   *
   * @example
   * "https://example.com" -> "example.com"
   * "https://sub.example.com" -> "example.com"
   */
  domain?: string;

  /**
   * The days until the cookie expires
   * @default 30
   */
  expiresInDays?: number;

  /**
   * The path of the cookie
   * @default '/'
   */
  path?: string;

  /**
   * Enable or disable the cookie
   * @default true
   */
  enabled?: boolean;

  /**
   * The same site property of the cookie
   * @default 'lax'
   */
  sameSite?: 'strict' | 'none' | 'lax';

  /**
   * A function that turns the token gotten from the cookie into the body for the refresh token request
   * @default (token) => ({ token })
   */
  refreshArgsTransformer?: (token: string) => RequestArgs<TTokenRefreshArgs>;

  /**
   * An array of routes where the auto login via cookie should not be triggered.
   *
   * This checks the current route against the array of routes using the `startsWith` method.
   * Make sure to start each route with a `/`.
   *
   * @default []
   * @example ['/login', '/register']
   */
  autoLoginExcludeRoutes?: string[];
};

export type CreateBearerAuthProviderConfigOptions<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
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
   * The login route configuration
   */
  login?: BearerAuthProviderRouteConfig<TLoginArgs>;

  /**
   * The token login route configuration
   */
  tokenLogin?: BearerAuthProviderRouteConfig<TTokenLoginArgs>;

  /**
   * The token refresh route configuration
   */
  tokenRefresh?: BearerAuthProviderRouteConfig<TTokenRefreshArgs>;

  /**
   * The select role route configuration
   */
  selectRole?: BearerAuthProviderRouteConfig<TSelectRoleArgs>;

  /**
   * The cookie configuration for the auth provider
   */
  cookie?: BearerAuthProviderCookieConfig<TTokenRefreshArgs>;

  /**
   * The time in milliseconds before the token expires when the refresh should be triggered.
   * @default 300000 // (5 minutes)
   */
  refreshBuffer?: number;

  /**
   * The expires in property name inside the jwt body
   * @default 'exp'
   */
  expiresInPropertyName?: string;

  /**
   * Determines if the token should be refreshed if **any** query returns a 401 response.
   * @default true
   */
  refreshOnUnauthorizedResponse?: boolean;

  /**
   * A function that decrypts the bearer token
   */
  bearerDecryptFn?: (token: string) => TBearerData;
};

export const createBearerAuthProvider = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
  TBearerData,
>(
  options: CreateBearerAuthProviderConfigOptions<
    TLoginArgs,
    TTokenLoginArgs,
    TTokenRefreshArgs,
    TSelectRoleArgs,
    TBearerData
  >,
) => createRootProvider(() => createBearerAuthProviderImpl(options), { name: `BearerAuthProvider_${options.name}` });

export type BearerAuthProviderRef<
  TLoginArgs extends QueryArgs = QueryArgs,
  TTokenLoginArgs extends QueryArgs = QueryArgs,
  TTokenRefreshArgs extends QueryArgs = QueryArgs,
  TSelectRoleArgs extends QueryArgs = QueryArgs,
  TBearerData = unknown,
> = ProviderResult<BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs, TBearerData>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCreateBearerAuthProviderResult = BearerAuthProviderRef<any, any, any, any, any>;
export type AnyBearerAuthProvider = NonNullable<ReturnType<AnyCreateBearerAuthProviderResult[1]>>;
