/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { DestroyRef, Injector, inject, signal } from '@angular/core';
import { BearerAuthProviderConfig } from './bearer-auth-provider-config';

export type BearerAuthProvider = {
  login: () => void;
  loginWithToken: () => void;
  refreshToken: () => void;
  logout: () => void;
  enableCookie: () => void;
  disableCookie: () => void;
};

export const createBearerAuthProvider = (options: BearerAuthProviderConfig) => {
  const client = inject(options.queryClientRef);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);

  const cookieEnabled = signal(options.cookie?.enabled ?? false);

  const tokenRequest = client.repository.request({
    destroyRef,
    method: 'POST',
    route: '/auth/token',
    skipExecution: true,
  });

  console.log(tokenRequest);

  const login = () => {};

  const loginWithToken = () => {};

  const refreshToken = () => {};

  const logout = () => {};

  const enableCookie = () => {
    cookieEnabled.set(true);
  };

  const disableCookie = () => {
    cookieEnabled.set(false);
  };

  const bearerAuthProvider: BearerAuthProvider = {
    login,
    loginWithToken,
    refreshToken,
    logout,
    enableCookie,
    disableCookie,
  };

  return bearerAuthProvider;
};

export const provideBearerAuthProvider = (config: BearerAuthProviderConfig) => {
  return {
    provide: config.token,
    useFactory: () => createBearerAuthProvider(config),
  };
};
