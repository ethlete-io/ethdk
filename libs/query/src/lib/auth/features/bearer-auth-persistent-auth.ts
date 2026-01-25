import { Signal, effect, signal } from '@angular/core';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, injectRoute, setCookie } from '@ethlete/core';
import { QueryArgs, RequestArgs } from '../../http';
import { BearerAuthProviderFeatureContext } from '../bearer-auth-provider';
import { decryptToken, encryptToken } from '../utils';

export type PersistentAuthConfig<TRefreshArgs extends QueryArgs> = {
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
   * Default remember me state when no user preference is stored.
   * @default false
   */
  defaultRememberMe?: boolean;
  /**
   * The days until the cookie expires (only used when rememberMe is true)
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

export type PersistentAuthFeatureBuilder<TRefreshArgs extends QueryArgs> = {
  _type: 'persistentAuth';
  config: PersistentAuthConfig<TRefreshArgs>;
  setup: (context: BearerAuthProviderFeatureContext) => PersistentAuthFeature;
};

export type PersistentAuthFeature = {
  /**
   * Current remember me state (session cookie vs persistent cookie)
   */
  rememberMe: Signal<boolean>;
  /**
   * Set remember me preference.
   * - true: Creates persistent cookie with expiresInDays
   * - false: Creates session cookie (deleted on browser close)
   */
  setRememberMe: (enabled: boolean) => void;
  /**
   * Try to login using stored cookie
   */
  tryLogin: () => void;
};

export const withPersistentAuth = <TRefreshArgs extends QueryArgs>(
  config: PersistentAuthConfig<TRefreshArgs>,
): PersistentAuthFeatureBuilder<TRefreshArgs> => ({
  _type: 'persistentAuth',
  config,
  setup: (context: BearerAuthProviderFeatureContext) => createPersistentAuthFeature(config, context),
});

export const createPersistentAuthFeature = (
  config: PersistentAuthConfig<QueryArgs>,
  context: BearerAuthProviderFeatureContext,
): PersistentAuthFeature => {
  const { refreshToken, executeQuery } = context;
  const cookieName = config.name ?? 'etAuth';
  const rememberMeStorageKey = `${cookieName}-rememberMe`;
  const route = injectRoute();

  const initializeRememberMe = (): boolean => {
    const storedPreference = typeof localStorage !== 'undefined' ? localStorage.getItem(rememberMeStorageKey) : null;
    if (storedPreference !== null) {
      return storedPreference === 'true';
    }

    const existingCookie = getCookie(cookieName);
    if (existingCookie) {
      return true;
    }

    return config.defaultRememberMe ?? false;
  };

  const rememberMeSignal = signal(initializeRememberMe());

  effect(() => {
    const token = refreshToken();
    const rememberMe = rememberMeSignal();
    const domain = config.domain ?? getDomain() ?? 'localhost';
    const path = config.path ?? '/';
    const sameSite = config.sameSite ?? 'lax';

    if (token) {
      const encryptedToken = encryptToken(token);
      if (rememberMe) {
        const expiresInDays = config.expiresInDays ?? 30;
        setCookie(cookieName, encryptedToken, expiresInDays, domain, path, sameSite);
      } else {
        setCookie(cookieName, encryptedToken, null, domain, path, sameSite);
      }
    } else {
      coreDeleteCookie(cookieName, path, domain);
    }
  });

  const tryLogin = () => {
    const currentRoute = route();
    const excludeRoutes = config.autoLogin.excludeRoutes ?? [];
    const shouldExclude = excludeRoutes.some((r) => currentRoute.startsWith(r));

    if (shouldExclude) {
      return;
    }

    const storedToken = getCookie(cookieName);
    if (storedToken) {
      const decryptedToken = decryptToken(storedToken);
      const args = config.autoLogin.buildArgs(decryptedToken);
      executeQuery(config.autoLogin.queryKey, args, true);
    }
  };

  const setRememberMe = (enabled: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(rememberMeStorageKey, String(enabled));
    }
    rememberMeSignal.set(enabled);
  };

  tryLogin();

  return {
    rememberMe: rememberMeSignal.asReadonly(),
    setRememberMe,
    tryLogin,
  };
};
