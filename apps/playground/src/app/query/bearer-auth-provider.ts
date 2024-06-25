/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DestroyRef, Injector, Signal, computed, inject, isDevMode, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, isObject, setCookie } from '@ethlete/core';
import { decryptBearer } from '@ethlete/query';
import { combineLatest, map, of, switchMap, tap, timer } from 'rxjs';
import {
  BearerAuthProviderConfig,
  BearerAuthProviderCookieConfig,
  BearerAuthProviderTokens,
} from './bearer-auth-provider-config';
import { HttpRequest } from './http-request';
import { QueryArgs, RequestArgs } from './query';
import { QueryMethod, RouteType } from './query-creator';
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
  unableToDecryptBearerToken,
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

  const loginResponseTransformer = options.login?.responseTransformer ?? defaultResponseTransformer;
  const tokenLoginResponseTransformer = options.tokenLogin?.responseTransformer ?? defaultResponseTransformer;
  const tokenRefreshResponseTransformer = options.tokenRefresh?.responseTransformer ?? defaultResponseTransformer;

  const currentLoginRequest = signal<HttpRequest<TLoginArgs> | null>(null);
  const currentTokenLoginRequest = signal<HttpRequest<TTokenLoginArgs> | null>(null);
  const currentTokenRefreshRequest = signal<HttpRequest<TTokenRefreshArgs> | null>(null);

  const currentLoginResponse = computed(() => {
    const res = currentLoginRequest()?.response();

    if (!res) return null;

    const tokens = loginResponseTransformer(res);

    const bearerValue = decryptBearer(tokens.accessToken);

    if (!bearerValue) throw unableToDecryptBearerToken(tokens.accessToken);

    return {
      bearer: bearerValue,
      tokens,
    };
  });
  const currentTokenLoginResponse = computed(() => {
    const res = currentTokenLoginRequest()?.response();

    if (!res) return null;

    const tokens = tokenLoginResponseTransformer(res);

    const bearerValue = decryptBearer(tokens.accessToken);

    if (!bearerValue) throw unableToDecryptBearerToken(tokens.accessToken);

    return {
      bearer: bearerValue,
      tokens,
    };
  });
  const currentTokenRefreshResponse = computed(() => {
    const res = currentTokenRefreshRequest()?.response();

    if (!res) return null;

    const tokens = tokenRefreshResponseTransformer(res);

    const bearerValue = decryptBearer(tokens.accessToken);

    if (!bearerValue) throw unableToDecryptBearerToken(tokens.accessToken);

    return {
      bearer: bearerValue,
      tokens,
    };
  });

  const tokenData = computed(
    () => currentTokenRefreshResponse() ?? currentTokenLoginResponse() ?? currentLoginResponse(),
  );

  // TODO: A signal for if the login is in progress
  // This could be either a login or a token login or a token refresh triggered by the cookie
  // TODO: A signal for if the refresh is in progress
  // TODO: A signal for if the login errored
  // TODO: A signal for if the refresh errored
  // If the refresh errored, we should log out the user. This should only happen if the api returns a 401 meaning the token is invalid
  // TODO: Some kind of logic to provide a custom token & refresh token (eg. in dyn we need to use the select role route after login)
  // Maybe we should just implement a selectRole method that does this for us?

  combineLatest([toObservable(tokenData), toObservable(cookieEnabled)])
    .pipe(
      tap(([res, cookieEnabled]) => {
        if (!res || !cookieEnabled) return;

        const { tokens } = res;

        writeCookie(tokens.refreshToken);
      }),
      map(([res]) => res),
      switchMap((res) => {
        if (!res || !options.tokenRefresh) return of(null);

        const { bearer, tokens } = res;
        const expiresIn = bearer[options.expiresInPropertyName ?? 'exp'];
        const refreshBuffer = options.refreshBuffer ?? FIVE_MINUTES;

        if (typeof expiresIn !== 'number') {
          throw bearerExpiresInPropertyNotNumber(expiresIn);
        }

        const remainingTime = new Date(expiresIn * 1000).getTime() - refreshBuffer - new Date().getTime();

        return timer(remainingTime).pipe(
          tap(() => refreshToken(cookieOptions.refreshArgsTransformer(tokens.refreshToken))),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  destroyRef.onDestroy(() => {
    currentLoginRequest()?.destroy();
    currentTokenLoginRequest()?.destroy();
    currentTokenRefreshRequest()?.destroy();
  });

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
    currentLoginRequest.set(null);
    currentTokenLoginRequest.set(null);
    currentTokenRefreshRequest.set(null);
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
