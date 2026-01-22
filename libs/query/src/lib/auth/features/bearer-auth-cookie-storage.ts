import { Signal, effect, signal } from '@angular/core';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, injectRoute, setCookie } from '@ethlete/core';
import { QueryArgs, RequestArgs } from '../../http';
import { BearerAuthProviderFeatureContext } from '../bearer-auth-provider';

export type CookieStorageConfig<TRefreshArgs extends QueryArgs> = {
  /**
   * The cookie name where the refresh token is stored
   * @default 'etAuth'
   */
  name?: string;
  /**
   * The domain of the cookie. If not set, the current origin will be used.
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
   * The same site property of the cookie
   * @default 'lax'
   */
  sameSite?: 'strict' | 'none' | 'lax';
  /**
   * Auto-login configuration
   */
  autoLogin: {
    /**
     * The query key to use for auto-login (must reference a registered query)
     */
    queryKey: string;
    /**
     * A function that turns the token gotten from the cookie into the body for the auto-login request
     * @default (token) => ({ body: { token } })
     */
    buildArgs: (token: string) => RequestArgs<TRefreshArgs>;
    /**
     * An array of routes where the auto login via cookie should not be triggered.
     *
     * @default []
     */
    excludeRoutes?: string[];
  };
};

export type CookieStorageFeatureBuilder<TRefreshArgs extends QueryArgs> = {
  _type: 'cookieStorage';
  config: CookieStorageConfig<TRefreshArgs>;
  setup: (context: BearerAuthProviderFeatureContext) => CookieStorageFeature;
};

export type CookieStorageFeature = {
  /**
   * Check if cookies are enabled
   */
  isEnabled: Signal<boolean>;
  /**
   * Enable cookie storage
   */
  enable: () => void;
  /**
   * Disable cookie storage and delete existing cookies
   */
  disable: () => void;
  /**
   * Try to login using stored cookie
   */
  tryLogin: () => void;
};

export const withCookieTokenStorage = <TRefreshArgs extends QueryArgs>(
  config: CookieStorageConfig<TRefreshArgs>,
): CookieStorageFeatureBuilder<TRefreshArgs> => ({
  _type: 'cookieStorage',
  config,
  setup: (context: BearerAuthProviderFeatureContext) => createCookieStorageFeature(config, context),
});

export const createCookieStorageFeature = (
  config: CookieStorageConfig<QueryArgs>,
  context: BearerAuthProviderFeatureContext,
): CookieStorageFeature => {
  const { refreshToken, executeQuery } = context;
  const cookieName = config.name ?? 'etAuth';
  const cookieEnabled = signal(true);
  const route = injectRoute();

  effect(() => {
    const token = refreshToken();
    if (token && cookieEnabled()) {
      const domain = config.domain ?? getDomain() ?? 'localhost';
      const expiresInDays = config.expiresInDays ?? 30;
      const path = config.path ?? '/';
      const sameSite = config.sameSite ?? 'lax';

      setCookie(cookieName, token, expiresInDays, domain, path, sameSite);
    } else if (!token && cookieEnabled()) {
      const domain = config.domain ?? getDomain() ?? 'localhost';
      const path = config.path ?? '/';
      coreDeleteCookie(cookieName, path, domain);
    }
  });

  const tryLogin = () => {
    const currentRoute = route();
    const excludeRoutes = config.autoLogin.excludeRoutes ?? [];
    const shouldExclude = excludeRoutes.some((r) => currentRoute.startsWith(r));

    if (shouldExclude || !cookieEnabled()) {
      return;
    }

    const storedToken = getCookie(cookieName);
    if (storedToken) {
      const args = config.autoLogin.buildArgs(storedToken);
      executeQuery(config.autoLogin.queryKey, args, true);
    }
  };

  tryLogin();

  return {
    isEnabled: cookieEnabled.asReadonly(),
    enable: () => {
      cookieEnabled.set(true);
    },
    disable: () => {
      cookieEnabled.set(false);
      const domain = config.domain ?? getDomain() ?? 'localhost';
      const path = config.path ?? '/';
      coreDeleteCookie(cookieName, path, domain);
    },
    tryLogin,
  };
};
