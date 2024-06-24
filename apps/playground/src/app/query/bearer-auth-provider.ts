/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DestroyRef, Injector, inject, isDevMode, signal } from '@angular/core';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, setCookie } from '@ethlete/core';
import { RouteString } from '@ethlete/query';
import { BearerAuthProviderConfig, BearerAuthProviderCookieConfig } from './bearer-auth-provider-config';
import { QueryMethod } from './query-creator';
import {
  cookieLoginTriedButCookieDisabled,
  disableCookieCalledWithoutCookieConfig,
  enableCookieCalledWithoutCookieConfig,
  loginCalledWithoutConfig,
  loginWithTokenCalledWithoutConfig,
  refreshTokenCalledWithoutConfig,
} from './query-errors';

export type BearerAuthProvider = {
  login: () => void;
  loginWithToken: () => void;
  refreshToken: () => void;

  /**
   *
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
};

export const createBearerAuthProvider = (options: BearerAuthProviderConfig): BearerAuthProvider => {
  const client = inject(options.queryClientRef);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);

  const cookieEnabled = signal(options.cookie?.enabled ?? false);
  const cookieOptions: Required<Omit<BearerAuthProviderCookieConfig, 'enabled'>> = {
    expiresInDays: 30,
    name: 'etAuth',
    path: '/',
    sameSite: 'lax',
    domain: getDomain() ?? 'localhost',
    ...(options.cookie ?? {}),
  };

  const login = () => {
    if (!options.login) {
      throw loginCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.login;

    const request = createRequest(method, route, {});
  };

  const loginWithToken = () => {
    if (!options.tokenLogin) {
      throw loginWithTokenCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.tokenLogin;

    const request = createRequest(method, route, {});
  };

  const refreshToken = () => {
    if (!options.tokenRefresh) {
      throw refreshTokenCalledWithoutConfig();
    }

    const { method = 'POST', route } = options.tokenRefresh;

    const request = createRequest(method, route, {});
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

    refreshToken();

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

  const createRequest = (method: QueryMethod, route: RouteString, body: object) => {
    return client.repository.request({
      destroyRef,
      method: method,
      route: route,
      body,
    });
  };

  const bearerAuthProvider: BearerAuthProvider = {
    login,
    loginWithToken,
    refreshToken,
    logout,
    enableCookie,
    disableCookie,
    tryLoginWithCookie,
  };

  return bearerAuthProvider;
};

export const provideBearerAuthProvider = (config: BearerAuthProviderConfig) => {
  return {
    provide: config.token,
    useFactory: () => createBearerAuthProvider(config),
  };
};
