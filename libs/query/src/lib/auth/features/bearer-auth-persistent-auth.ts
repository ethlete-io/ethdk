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
     * An array of routes where the auto login via cookie should not be triggered. Prefix-matched, so
     * `'/reset-password'` also excludes `/reset-password-templates`; reach for `shouldAutoLogin` when
     * that matters.
     *
     * @default []
     */
    excludeRoutes?: string[];
    /**
     * Decides per URL whether auto-login may run, for the policy prefix matching cannot express - an
     * exact path, a parsed `UrlTree`, a query parameter. Receives the current route as the router
     * reports it.
     *
     * Runs *in addition to* `excludeRoutes`: either one refusing is enough to skip auto-login, so
     * adding a predicate can never re-enable a route the list excluded.
     *
     * @default undefined
     */
    shouldAutoLogin?: (url: string) => boolean;
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
      devtools: () => [
        { label: 'cookie', value: config.cookie?.name ?? 'etAuth' },
        { label: 'remembered for', value: `${config.cookie?.expiresInDays ?? 30}d` },
        { label: 'same site', value: config.cookie?.sameSite ?? 'lax' },
        { label: 'remember me default', value: config.defaultRememberMe ? 'yes' : 'no' },
        { label: 'auto login', value: config.autoLogin.queryKey },
        ...(config.autoLogin.excludeRoutes?.length
          ? [{ label: 'excluded routes', value: config.autoLogin.excludeRoutes.join(', ') }]
          : []),
        ...(config.autoLogin.shouldAutoLogin ? [{ label: 'auto login predicate', value: 'custom' }] : []),
      ],
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
  const { refreshToken, executionState } = context;
  const cookieName = config.cookie?.name ?? 'etAuth';
  const rememberMeStorageKey = `${cookieName}-rememberMe`;
  const route = injectRoute();

  const initializeRememberMe = () => {
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

  const cookieDomain = () => config.cookie?.domain ?? getDomain() ?? 'localhost';
  const cookiePath = () => config.cookie?.path ?? '/';

  const removeCookie = () => coreDeleteCookie(cookieName, cookiePath(), cookieDomain());

  effect(() => {
    const token = refreshToken();
    const rememberMe = rememberMeSignal();

    // A missing token is not a reason to drop the cookie. It is missing on every startup - `tryLogin`
    // reads the cookie synchronously and the auto-login only resolves a tick later - so deleting here
    // would throw away a 30-day refresh token before it was ever used. Deletion is driven by the events
    // that actually end a session instead, below.
    if (!token) return;

    const expiresInDays = rememberMe ? (config.cookie?.expiresInDays ?? 30) : null;

    setCookie(
      cookieName,
      encryptToken(token),
      expiresInDays,
      cookieDomain(),
      cookiePath(),
      config.cookie?.sameSite ?? 'lax',
    );
  });

  effect(() => {
    const state = executionState();

    if (!state) return;

    if (state.type === 'logout') {
      removeCookie();

      return;
    }

    // A token the server itself rejected is worth nothing on the next visit; anything else (offline, a
    // 500, an aborted startup) leaves it in place so a reload can try again.
    const wasRejected =
      state.state === 'error' &&
      (state.type === 'tokenRefresh' || state.type === 'autoLogin') &&
      (state.error.code === 401 || state.error.code === 403);

    if (wasRejected) removeCookie();
  });

  const tryLogin = () => {
    const currentRoute = route();
    const excludeRoutes = config.autoLogin.excludeRoutes ?? [];
    const shouldExclude = excludeRoutes.some((r) => currentRoute.startsWith(r));

    if (shouldExclude) {
      return;
    }

    if (config.autoLogin.shouldAutoLogin && !config.autoLogin.shouldAutoLogin(currentRoute)) {
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
