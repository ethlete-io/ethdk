import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, map, Observable, of, startWith, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  AnyLegacyQuery,
  AnyLegacyQueryCreator,
  AnyV2Query,
  AnyV2QueryCreator,
  createLegacyQueryCreator,
  createQueryCollectionSubject,
  createSecureGetQuery,
  decryptBearer,
  def,
  filterSuccess,
  isBearerAuthProvider,
  isQueryStateSuccess,
  switchQueryCollectionState,
  switchQueryState,
  takeUntilResponse,
  V2BearerAuthProvider,
  V2QueryClient,
} from '../index';
import { LEGACY_CLIENT_KINDS, LegacyClientKind, mintToken, Scenario, useScenario } from './harness';

type Credentials = { username: string; password: string };
type LoginResponse = { token: string; refreshToken: string };
type User = { id: string; name: string };
type JwtData = { user: { id: string } };

type AnyCreator = {
  prepare: (args?: Record<string, unknown>) => { execute: () => unknown };
  createSubject: () => unknown;
};

type AuthApp = {
  postLogin: AnyCreator;
  postRefreshLogin: AnyCreator;
  getUserMe: AnyCreator;
  tokens$: Observable<{ token: string | null; refreshToken: string | null } | null>;
  setSession: (tokens: LoginResponse) => void;
  clearSession: () => void;
  restoreSession: () => unknown;
  destroy: () => void;
};

const AUTH_APP = new InjectionToken<AuthApp>('AUTH_APP');
const BASE_URL = 'https://api.test';
const COOKIE_NAME = 'legacy-auth-patterns-tokens';

@Injectable()
class AuthService {
  private readonly app = inject(AUTH_APP);
  private readonly didLogout$ = new Subject<void>();

  private readonly postLogin = this.app.postLogin;
  private readonly postRefreshLogin = this.app.postRefreshLogin;
  private readonly getUserMe = this.app.getUserMe;

  readonly loginQuery$ = createQueryCollectionSubject({
    postLogin: this.postLogin as unknown as AnyV2QueryCreator,
    postRefreshLogin: this.postRefreshLogin as unknown as AnyLegacyQueryCreator,
  });

  readonly loginSuccessView$ = this.loginQuery$.pipe(
    switchQueryCollectionState(),
    map((state) => {
      if (isQueryStateSuccess(state)) {
        return state.response as LoginResponse;
      }
      return null;
    }),
  );

  readonly tokens$ = this.app.tokens$;
  readonly jwtData$ = this.tokens$.pipe(map((t) => (t?.token ? decryptBearer<JwtData>(t.token) : null)));
  readonly user$ = this.jwtData$.pipe(map((t) => t?.user ?? null));

  readonly userMeQuery$ = this.getUserMe.createSubject() as BehaviorSubject<AnyV2Query | AnyLegacyQuery | null>;
  readonly userMeResponse$ = this.userMeQuery$.pipe(
    switchQueryState(),
    filterSuccess(),
    map((r) => r.response as User),
  );

  readonly isLoggedIn$ = this.loginSuccessView$.pipe(
    startWith(null),
    map((r) => !!r),
  );

  constructor() {
    this.user$
      .pipe(
        tap((user) => {
          if (!user) {
            this.userMeQuery$.next(null);
            return;
          }

          this.userMeQuery$.next(this.getUserMe.prepare().execute() as AnyV2Query);
        }),
      )
      .subscribe();
  }

  tryLoginViaCookie() {
    const refreshQuery = this.app.restoreSession();

    if (refreshQuery) {
      this.loginQuery$.next({ type: 'postRefreshLogin', query: refreshQuery as never });
    }

    return this.loginQuery$.value;
  }

  loginWithUsernameAndPassword(data: Credentials) {
    this.loginQuery$.next({ type: 'postLogin', query: this.postLogin.prepare({ body: data }).execute() as never });

    this.setAuthProviderOnSuccess();

    return this.loginQuery$.value;
  }

  loginWithSalesforceToken(refreshToken: string) {
    this.loginQuery$.next({
      type: 'postRefreshLogin',
      query: this.postRefreshLogin.prepare({ body: { refreshToken } }).execute() as never,
    });

    this.setAuthProviderOnSuccess();
  }

  logout() {
    this.loginQuery$.next(null);
    this.didLogout$.next();

    this.app.clearSession();

    this.userMeQuery$.next(null);
  }

  private setAuthProviderOnSuccess() {
    this.loginQuery$
      .pipe(
        switchQueryCollectionState(),
        takeUntilResponse(),
        takeUntil(this.didLogout$),
        tap((state) => {
          if (!isQueryStateSuccess(state)) {
            return;
          }

          this.app.clearSession();
          this.app.setSession(state.response as LoginResponse);
        }),
      )
      .subscribe();
  }
}

const createNativeAuthApp = (s: Scenario): AuthApp => {
  const owner = s.consumer();
  const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));

  const postLogin = client.post({
    route: '/auth/login',
    types: { args: def<{ body: Credentials }>(), response: def<LoginResponse>() },
  });
  const postRefreshLogin = client.post({
    route: '/auth/refresh',
    types: { args: def<{ body: { refreshToken: string } }>(), response: def<LoginResponse>() },
  });
  const getUserMe = client.get({ route: '/users/me', secure: true, types: { response: def<User>() } });

  const createAuthProvider = (token?: string, refreshToken?: string) =>
    new V2BearerAuthProvider({
      token,
      refreshConfig: {
        queryCreator: postRefreshLogin,
        token: refreshToken,
        cookieName: COOKIE_NAME,
        cookieEnabled: true,
        responseAdapter: (x) => ({ token: x.token, refreshToken: x.refreshToken }),
        requestArgsAdapter: (token) => ({ body: { refreshToken: token.refreshToken as string } }),
      },
    });

  return {
    postLogin: postLogin as unknown as AnyCreator,
    postRefreshLogin: postRefreshLogin as unknown as AnyCreator,
    getUserMe: getUserMe as unknown as AnyCreator,
    tokens$: client.authProvider$.pipe(
      switchMap((p) => {
        if (!p) {
          return of(null);
        }

        if (isBearerAuthProvider<typeof postRefreshLogin>(p)) {
          return p.tokens$;
        }

        return of(null);
      }),
    ),
    setSession: (tokens) => client.setAuthProvider(createAuthProvider(tokens.token, tokens.refreshToken)),
    clearSession: () => client.clearAuthProvider(),
    restoreSession: () => {
      const provider = createAuthProvider();
      client.setAuthProvider(provider);

      return provider.currentRefreshQuery;
    },
    destroy: () => {
      client._store.forEach((query, key) => {
        query.stopPolling();
        query.abort();
        client._store.remove(key);
      });

      client.clearAuthProvider();
      owner.destroy();
    },
  };
};

const createInteropAuthApp = (s: Scenario): AuthApp => {
  const auth = s.auth({ loginPath: '/v3/login', refreshPath: '/v3/refresh' });
  const injector = s.run(() => inject(Injector));

  const wrap = (creator: unknown, name: string) => {
    const legacy = createLegacyQueryCreator({ creator: creator as never, name }) as unknown as AnyCreator;
    const prepare = legacy.prepare.bind(legacy);

    return Object.assign(legacy, { prepare: (args?: Record<string, unknown>) => prepare({ ...args, injector }) });
  };

  return {
    postLogin: wrap(s.post<{ body: Credentials; response: LoginResponse }>('/auth/login'), 'legacyPostLogin'),
    postRefreshLogin: wrap(
      s.post<{ body: { refreshToken: string }; response: LoginResponse }>('/auth/refresh'),
      'legacyPostRefreshLogin',
    ),
    getUserMe: wrap(createSecureGetQuery(s.clientRef, auth.ref)<{ response: User }>('/users/me'), 'legacyGetUserMe'),
    tokens$: toObservable(auth.accessToken, { injector }).pipe(
      map((token) => (token ? { token, refreshToken: auth.refreshToken() } : null)),
    ),
    setSession: (tokens) => auth.setTokens(tokens.token, tokens.refreshToken),
    clearSession: () => {
      if (auth.isAuthenticated()) auth.logout();
    },
    restoreSession: () => null,
    destroy: () => undefined,
  };
};

const createAuthApp = (s: Scenario, kind: LegacyClientKind) =>
  kind === 'native' ? createNativeAuthApp(s) : createInteropAuthApp(s);

const tokenFor = (userId: string) => mintToken({ claims: { user: { id: userId } } });

const serveAuth = (s: Scenario) => {
  s.api.on('POST', '/auth/login', ({ body }) => {
    const { username, password } = body as Credentials;

    return password === 'secret'
      ? { body: { token: tokenFor(username), refreshToken: mintToken() }, delay: 50 }
      : { status: 401, body: { message: 'invalid credentials' }, delay: 50 };
  });
  s.api.on('POST', '/auth/refresh', () => ({ body: { token: tokenFor('sso'), refreshToken: mintToken() }, delay: 50 }));
  s.api.on('GET', '/users/me', ({ headers }) => {
    const token = headers.get('Authorization')?.slice('Bearer '.length) ?? '';
    const id = decryptBearer<JwtData>(token)?.user.id ?? '?';

    return { body: { id, name: `User ${id}` }, delay: 20 };
  });
  s.api.protect('/users/me');
};

const record = <T>(source: Observable<T>) => {
  const values: T[] = [];
  const subscription = source.subscribe((value) => values.push(value));

  return { values, last: () => values[values.length - 1], stop: () => subscription.unsubscribe() };
};

describe.each(LEGACY_CLIENT_KINDS)('bearer auth through a query collection on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const setup = () => {
    const s = scenario();
    serveAuth(s);
    const app = createAuthApp(s, kind);
    const c = s.consumer([{ provide: AUTH_APP, useValue: app }, AuthService]);
    const service = c.run(() => inject(AuthService));

    return { s, app, c, service };
  };

  it('posts one login per attempt, then sends the bearer on the follow-up query', () => {
    const { s, app, c, service } = setup();
    const loggedIn = record(service.isLoggedIn$);
    const me = record(service.userMeResponse$);

    for (const username of ['ada', 'grace', 'linus']) {
      service.loginWithUsernameAndPassword({ username, password: 'wrong' });
      s.tick(1000);
    }

    expect(s.api.requestCount('POST', '/auth/login')).toBe(3);
    expect(s.api.requestCount('GET', '/users/me')).toBe(0);
    expect(loggedIn.last()).toBe(false);
    if (kind === 'interop') {
      for (let i = 0; i < 3; i++) s.expectError((entry) => (entry.error as { status?: number }).status === 401);
    }

    service.loginWithUsernameAndPassword({ username: 'ada', password: 'secret' });
    s.flush();

    expect(s.api.requestCount('POST', '/auth/login')).toBe(4);
    expect(s.api.requestCount('GET', '/users/me')).toBe(1);
    expect(s.api.requests.at(-1)?.status).toBe(200);
    expect(loggedIn.last()).toBe(true);
    expect(me.values).toEqual([{ id: 'ada', name: 'User ada' }]);

    service.logout();
    s.flush();

    expect(loggedIn.last()).toBe(false);
    expect(service.userMeQuery$.value).toBeNull();

    service.loginWithUsernameAndPassword({ username: 'grace', password: 'secret' });
    s.flush();

    expect(s.api.requestCount('POST', '/auth/login')).toBe(5);
    expect(s.api.requestCount('GET', '/users/me')).toBe(2);
    expect(me.values).toEqual([
      { id: 'ada', name: 'User ada' },
      { id: 'grace', name: 'User grace' },
    ]);
    expect(s.api.requests.filter((request) => request.status === 401)).toHaveLength(3);

    loggedIn.stop();
    me.stop();
    service.logout();
    c.destroy();
    app.destroy();
  });

  it('logs in through the refresh query and ignores a login response that lands after logout', () => {
    const { s, app, c, service } = setup();
    const loggedIn = record(service.isLoggedIn$);
    const me = record(service.userMeResponse$);

    service.loginWithSalesforceToken(mintToken());
    s.flush();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(loggedIn.last()).toBe(true);
    expect(me.values).toEqual([{ id: 'sso', name: 'User sso' }]);

    service.logout();
    service.loginWithUsernameAndPassword({ username: 'ada', password: 'secret' });
    s.tick(10);
    service.logout();
    s.flush();

    expect(s.api.requestCount('POST', '/auth/login')).toBe(1);
    expect(s.api.requestCount('GET', '/users/me')).toBe(1);
    expect(loggedIn.last()).toBe(false);

    loggedIn.stop();
    me.stop();
    c.destroy();
    app.destroy();
  });

  it.runIf(kind === 'native')('restores a session from the refresh cookie on page load', () => {
    const { s, app, c, service } = setup();

    service.loginWithUsernameAndPassword({ username: 'ada', password: 'secret' });
    s.flush();
    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
    expect(cookie).toBeDefined();

    c.destroy();
    app.destroy();
    document.cookie = `${cookie}; path=/`;

    const reloaded = createAuthApp(s, kind);
    const c2 = s.consumer([{ provide: AUTH_APP, useValue: reloaded }, AuthService]);
    const again = c2.run(() => inject(AuthService));
    const loggedIn = record(again.isLoggedIn$);
    const me = record(again.userMeResponse$);

    expect(again.tryLoginViaCookie()?.type).toBe('postRefreshLogin');
    s.flush();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(loggedIn.last()).toBe(true);
    expect(me.values).toEqual([{ id: 'sso', name: 'User sso' }]);

    loggedIn.stop();
    me.stop();
    again.logout();
    c2.destroy();
    reloaded.destroy();
  });
});
