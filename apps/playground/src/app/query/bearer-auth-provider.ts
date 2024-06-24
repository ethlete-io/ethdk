/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DestroyRef, Injector, Signal, inject, isDevMode, signal } from '@angular/core';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, setCookie } from '@ethlete/core';
import { BearerAuthProviderConfig, BearerAuthProviderCookieConfig } from './bearer-auth-provider-config';
import { HttpRequest } from './http-request';
import { QueryArgs, RequestArgs } from './query';
import { QueryMethod, RouteType } from './query-creator';
import {
  cookieLoginTriedButCookieDisabled,
  disableCookieCalledWithoutCookieConfig,
  enableCookieCalledWithoutCookieConfig,
  loginCalledWithoutConfig,
  loginWithTokenCalledWithoutConfig,
  refreshTokenCalledWithoutConfig,
} from './query-errors';

export type BearerAuthProvider<
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
> = {
  /**
   * Logs in the user with the given args.
   */
  login: (args: RequestArgs<TLoginArgs>) => HttpRequest<TLoginArgs>;

  /**
   * Logs in the user with the given token.
   */
  loginWithToken: (args: RequestArgs<TTokenLoginArgs>) => HttpRequest<TTokenLoginArgs>;

  /**
   * Refreshes the token with the given refresh token.
   */
  refreshToken: (args: RequestArgs<TTokenRefreshArgs>) => HttpRequest<TTokenRefreshArgs>;

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
   * The current login request signal.
   */
  currentLoginRequest: Signal<HttpRequest<TLoginArgs> | null>;

  /**
   * The current token login request signal.
   */
  currentTokenLoginRequest: Signal<HttpRequest<TTokenLoginArgs> | null>;

  /**
   * The current token refresh request signal.
   */
  currentTokenRefreshRequest: Signal<HttpRequest<TTokenRefreshArgs> | null>;
};

export const createBearerAuthProvider = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
>(
  options: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>,
): BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs> => {
  const client = inject(options.queryClientRef);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);

  const cookieEnabled = signal(options.cookie?.enabled ?? false);
  const cookieOptions: Required<Omit<BearerAuthProviderCookieConfig<TTokenRefreshArgs>, 'enabled'>> = {
    expiresInDays: 30,
    name: 'etAuth',
    path: '/',
    sameSite: 'lax',
    domain: getDomain() ?? 'localhost',
    refreshArgsTransformer: (token) => ({ body: { token } }) as RequestArgs<TTokenRefreshArgs>,
    ...(options.cookie ?? {}),
  };

  const currentLoginRequest = signal<HttpRequest<TLoginArgs> | null>(null);
  const currentTokenLoginRequest = signal<HttpRequest<TTokenLoginArgs> | null>(null);
  const currentTokenRefreshRequest = signal<HttpRequest<TTokenRefreshArgs> | null>(null);

  const login = (args: RequestArgs<TLoginArgs>) => {
    if (!options.login) {
      throw loginCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.login;

    const request = createRequest<TLoginArgs>(method, route, args).request;

    currentLoginRequest.set(request);

    return request;
  };

  const loginWithToken = (args: RequestArgs<TTokenLoginArgs>) => {
    if (!options.tokenLogin) {
      throw loginWithTokenCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.tokenLogin;

    const request = createRequest<TTokenLoginArgs>(method, route, args).request;

    currentTokenLoginRequest.set(request);

    return request;
  };

  const refreshToken = (args: RequestArgs<TTokenRefreshArgs>) => {
    if (!options.tokenRefresh) {
      throw refreshTokenCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.tokenRefresh;

    const request = createRequest<TTokenRefreshArgs>(method, route, args).request;

    currentTokenRefreshRequest.set(request);

    return request;
  };

  const logout = () => {
    deleteCookie();
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createRequest = <T extends QueryArgs>(method: QueryMethod, route: RouteType<T>, args: RequestArgs<T>) => {
    return client.repository.request<T>({
      destroyRef,
      method,
      route,
      body: args.body,
      pathParams: args.pathParams,
      queryParams: args.queryParams,
    });
  };

  const bearerAuthProvider: BearerAuthProvider<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs> = {
    login,
    loginWithToken,
    refreshToken,
    logout,
    enableCookie,
    disableCookie,
    tryLoginWithCookie,
    currentLoginRequest: currentLoginRequest.asReadonly(),
    currentTokenLoginRequest: currentTokenLoginRequest.asReadonly(),
    currentTokenRefreshRequest: currentTokenRefreshRequest.asReadonly(),
  };

  return bearerAuthProvider;
};

export const provideBearerAuthProvider = <
  TLoginArgs extends QueryArgs,
  TTokenLoginArgs extends QueryArgs,
  TTokenRefreshArgs extends QueryArgs,
>(
  config: BearerAuthProviderConfig<TLoginArgs, TTokenLoginArgs, TTokenRefreshArgs>,
) => {
  return {
    provide: config.token,
    useFactory: () => createBearerAuthProvider(config),
  };
};
