/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { computed, effect, isDevMode, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, isObject, setCookie } from '@ethlete/core';
import { decryptBearer } from '@ethlete/query';
import { of, switchMap, tap, timer } from 'rxjs';
import {
  BearerAuthProviderConfig,
  BearerAuthProviderCookieConfig,
  BearerAuthProviderRouteConfig,
  BearerAuthProviderTokens,
} from './bearer-auth-provider-config';
import { Query, QueryArgs, RequestArgs } from './query';
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
} from './query-errors';

export type BearerAuthProvider<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
> = {
  /**
   * Logs in the user with the given args.
   */
  login: (args: RequestArgs<TLoginArgs>) => void;

  /**
   * Logs in the user with the given token.
   */
  loginWithToken: (args: RequestArgs<TTokenLoginArgs>) => Query<TTokenLoginArgs>;

  /**
   * Refreshes the token with the given refresh token.
   */
  refreshToken: (args: RequestArgs<TTokenRefreshArgs>) => Query<TTokenRefreshArgs>;

  /**
   * Selects the role for the user.
   */
  selectRole: (args: RequestArgs<TSelectRoleArgs>) => Query<TSelectRoleArgs>;

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
   * Tries to login with the given cookie config.
   * Returns `true` if a cookie was found, `false` otherwise.
   */
  tryLoginWithCookie: () => boolean;

  /**
   * The login query created using the login query creator.
   */
  loginQuery?: Query<TLoginArgs>;

  /**
   * The token login query created using the token login query creator.
   */
  tokenLoginQuery?: Query<TTokenLoginArgs>;

  /**
   * The token refresh query created using the token refresh query creator.
   */
  tokenRefreshQuery?: Query<TTokenRefreshArgs>;

  /**
   * The select role query created using the select role query creator.
   */
  selectRoleQuery?: Query<TSelectRoleArgs>;
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
  const query = config.queryCreator();

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

    const remainingTime = new Date(expiresIn * 1000).getTime() - refreshBuffer - new Date().getTime();

    console.log('expiresIn', expiresIn / 1000 / 60 / 60 / 24);

    return remainingTime;
  });

  const execute = (newArgs: RequestArgs<T>) => {
    query.execute(newArgs);
  };

  return {
    execute,
    query,
    tokens,
    expiresIn,
  };
};

export const createBearerAuthProvider = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
>(
  options: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>,
): BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs> => {
  const cookieEnabled = signal(options.cookie === undefined ? false : options.cookie.enabled ?? true);
  const cookieOptions: Required<Omit<BearerAuthProviderCookieConfig<TTokenRefreshArgs>, 'enabled'>> = {
    expiresInDays: 30,
    name: 'etAuth',
    path: '/',
    sameSite: 'lax',
    domain: getDomain() ?? 'localhost',
    refreshArgsTransformer: (token) => ({ body: { token } }) as RequestArgs<TTokenRefreshArgs>,
    ...(options.cookie ?? {}),
  };

  const loginQuery = options.login ? createAuthProviderQuery(options.login, options) : null;
  const tokenLoginQuery = options.tokenLogin ? createAuthProviderQuery(options.tokenLogin, options) : null;
  const tokenRefreshQuery = options.tokenRefresh ? createAuthProviderQuery(options.tokenRefresh, options) : null;
  const selectRoleQuery = options.selectRole ? createAuthProviderQuery(options.selectRole, options) : null;

  const highestExpiringQuery = computed(() => {
    const loginExp = loginQuery?.expiresIn() ?? -1;
    const tokenLoginExp = tokenLoginQuery?.expiresIn() ?? -1;
    const tokenRefreshExp = tokenRefreshQuery?.expiresIn() ?? -1;
    const selectRoleExp = selectRoleQuery?.expiresIn() ?? -1;

    // get the highest expiration date
    const exp = Math.max(loginExp, tokenLoginExp, tokenRefreshExp, selectRoleExp);

    if (exp === -1) return null;

    if (exp === loginExp) return loginQuery;
    if (exp === tokenLoginExp) return tokenLoginQuery;
    if (exp === tokenRefreshExp) return tokenRefreshQuery;
    if (exp === selectRoleExp) return selectRoleQuery;

    return null;
  });

  // TODO: A signal for if the login is in progress
  // This could be either a login or a token login or a token refresh triggered by the cookie
  // TODO: A signal for if the refresh is in progress
  // TODO: A signal for if the login errored
  // TODO: A signal for if the refresh errored
  // If the refresh errored, we should log out the user. This should only happen if the api returns a 401 meaning the token is invalid
  // TODO: Some kind of logic to provide a custom token & refresh token (eg. in dyn we need to use the select role route after login)

  toObservable(highestExpiringQuery)
    .pipe(
      switchMap((res) => {
        if (!res || !options.tokenRefresh) return of(null);

        const expIn = res.expiresIn();
        const tokens = res.tokens();

        if (!expIn || !tokens) return of(null);

        return timer(expIn).pipe(
          tap(() => refreshToken(cookieOptions.refreshArgsTransformer(tokens.tokens.refreshToken))),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  effect(() => {
    const isCookieEnabled = cookieEnabled();
    const res = highestExpiringQuery();

    if (!isCookieEnabled) {
      deleteCookie();
      return;
    }

    if (!res) return;
    const { tokens } = res;

    const rt = tokens()?.tokens.refreshToken;

    if (!rt) return;

    writeCookie(rt);
  });

  const login = (args: RequestArgs<TLoginArgs>) => {
    if (!loginQuery) {
      throw loginCalledWithoutConfig();
    }

    loginQuery.execute(args);

    return loginQuery.query;
  };

  const loginWithToken = (args: RequestArgs<TTokenLoginArgs>) => {
    if (!tokenLoginQuery) {
      throw loginWithTokenCalledWithoutConfig();
    }

    tokenLoginQuery.execute(args);

    return tokenLoginQuery.query;
  };

  const refreshToken = (args: RequestArgs<TTokenRefreshArgs>) => {
    if (!tokenRefreshQuery) {
      throw refreshTokenCalledWithoutConfig();
    }

    tokenRefreshQuery.execute(args);

    return tokenRefreshQuery.query;
  };

  const selectRole = (args: RequestArgs<TSelectRoleArgs>) => {
    if (!selectRoleQuery) {
      throw selectRoleCalledWithoutConfig();
    }

    selectRoleQuery.execute(args);

    return selectRoleQuery.query;
  };

  const logout = () => {
    deleteCookie();
    loginQuery?.query.execute.reset();
    tokenLoginQuery?.query.execute.reset();
    tokenRefreshQuery?.query.execute.reset();
    selectRoleQuery?.query.execute.reset();
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

  const bearerAuthProvider: BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs> = {
    login,
    loginWithToken,
    refreshToken,
    selectRole,
    logout,
    enableCookie,
    disableCookie,
    tryLoginWithCookie,
    loginQuery: loginQuery?.query,
    selectRoleQuery: selectRoleQuery?.query,
    tokenLoginQuery: tokenLoginQuery?.query,
    tokenRefreshQuery: tokenRefreshQuery?.query,
  };

  if (cookieEnabled()) {
    tryLoginWithCookie();
  }

  return bearerAuthProvider;
};

export const provideBearerAuthProvider = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
  TSelectRoleArgs extends QueryArgs,
>(
  config: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs, TSelectRoleArgs>,
) => {
  return {
    provide: config.token,
    useFactory: () => createBearerAuthProvider(config),
  };
};
