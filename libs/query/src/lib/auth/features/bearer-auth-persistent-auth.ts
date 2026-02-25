import { Signal, effect, signal } from '@angular/core';
import { deleteCookie as coreDeleteCookie, getCookie, getDomain, injectRoute, setCookie } from '@ethlete/core';
import { RequestArgs } from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthProviderFeatureContext,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';
import { decryptToken, encryptToken } from '../utils';

export type PersistentAuthConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
> = {
  /**
   * Default remember me state when no user preference is stored.
   * @default false
   */
  defaultRememberMe?: boolean;

  /**
   * Cookie configuration
   */
  cookie?: {
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
  };

  /**
   * Auto-login configuration
   */
  autoLogin: {
    /**
     * The query key to use for auto-login (must reference a registered query)
     */
    queryKey: TKey;
    /**
     * A function that turns the token gotten from the cookie into the body for the auto-login request
     * @default (token) => ({ body: { token } })
     */
    buildArgs: (token: string) => RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>>;
    /**
     * An array of routes where the auto login via cookie should not be triggered.
     *
     * @default []
     */
    excludeRoutes?: string[];
  };
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

export const withPersistentAuth = <
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
>(
  config: PersistentAuthConfig<TBuilders, TKey>,
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const instance = createPersistentAuthFeature(config, context);
    return {
      type: BearerAuthFeatureType.PERSISTENT_AUTH,
      instance,
    };
  };
};

export const createPersistentAuthFeature = <
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
>(
  config: PersistentAuthConfig<TBuilders, TKey>,
  context: BearerAuthProviderFeatureContext<unknown, TBuilders>,
): PersistentAuthFeature => {
  const { refreshToken } = context;
  const cookieName = config.cookie?.name ?? 'etAuth';
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
    const domain = config.cookie?.domain ?? getDomain() ?? 'localhost';
    const path = config.cookie?.path ?? '/';
    const sameSite = config.cookie?.sameSite ?? 'lax';

    if (token) {
      const encryptedToken = encryptToken(token);
      if (rememberMe) {
        const expiresInDays = config.cookie?.expiresInDays ?? 30;
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
      context.queries[config.autoLogin.queryKey].execute(args, { triggeredBy: 'persistent-auth' });
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
