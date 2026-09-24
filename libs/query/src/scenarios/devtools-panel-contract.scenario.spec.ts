import { createEnvironmentInjector, EnvironmentInjector, inject, VERSION } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addQueryDevtoolsAuthAccount,
  clearQueryDevtoolsAuthCredentials,
  clearQueryDevtoolsAuthSessions,
  createBearerAuthProvider,
  createPostQuery,
  createQueryClient,
  isQueryDevtoolsEnabled,
  logoutQueryDevtoolsAuthSession,
  provideQueryDevtools,
  queryDevtoolsAbout,
  queryDevtoolsAllowsLocalAuthSessions,
  queryDevtoolsApiEnvIds,
  queryDevtoolsApiEnvScope,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthSessionsFor,
  registerEthleteVersion,
  removeQueryDevtoolsAuthAccount,
  setQueryDevtoolsApiEnv,
  setQueryDevtoolsAppInfo,
  setQueryDevtoolsAuthCredentials,
  withAuthenticationQuery,
  withRefreshQuery,
} from '../index';
import { inProductionMode, mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const HUB_ENV_KEY = 'et-devtools-panel-contract-hub-env';
const CDN_ENV_KEY = 'et-devtools-panel-contract-cdn-env';
const PROVIDER_NAME = 'devtools-panel-contract-provider';
const APP_INFO = { version: '1.2.3', commit: 'abc1234', production: false };

type TokenArgs = { body: { email?: string }; response: { accessToken: string; refreshToken: string } };

const devtoolsProviders = () => [
  provideQueryDevtools({
    about: APP_INFO,
    apiEnvs: [
      {
        name: 'Hub API',
        storageKey: HUB_ENV_KEY,
        fallback: 'staging',
        envs: [{ id: 'staging' }, { id: 'dev' }, { id: 'production', production: true }],
      },
      { name: 'CDN', storageKey: CDN_ENV_KEY, envs: [{ id: 'cdn-a' }, { id: 'cdn-b' }] },
    ],
    authAccounts: [
      { provider: PROVIDER_NAME, label: 'Member', loginQuery: 'login' },
      { provider: PROVIDER_NAME, label: 'Dev admin', loginQuery: 'login', envs: ['dev'] },
    ],
  }),
];

let bootCounter = 0;

const bootAuthTab = (s: Scenario) => {
  s.api.on('POST', '/auth/login', ({ body }) => {
    const email = (body as TokenArgs['body']).email ?? 'user';

    return {
      body: {
        accessToken: mintToken({ claims: { sub: email } }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000, claims: { sub: email } }),
      },
    };
  });

  const clientRef = createQueryClient({
    name: `devtools-panel-contract-${++bootCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);
  const authRef = createBearerAuthProvider({
    name: PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
    ],
  });
  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('devtools panel contract scenario: failed to create the auth provider');

  return { auth, destroy: () => injector.destroy() };
};

const accountLabels = () => queryDevtoolsAuthAccountsFor(PROVIDER_NAME).map((account) => account.label);

describe('the devtools contract the panel reads', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: devtoolsProviders });

  beforeEach(() => {
    clearQueryDevtoolsAuthSessions();
    setQueryDevtoolsApiEnv(HUB_ENV_KEY, null);
    setQueryDevtoolsApiEnv(CDN_ENV_KEY, null);
  });

  it('about reports the loaded packages, the Angular version and the app info, and mirrors onto window.ethlete', () => {
    scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    registerEthleteVersion('components', '9.9.9-panel');
    registerEthleteVersion('query-devtools', '9.9.9-panel');

    const about = queryDevtoolsAbout();

    expect(about.angular).toBe(VERSION.full);
    expect(about.app).toEqual(APP_INFO);
    expect(about.ethlete).toMatchObject({
      core: expect.any(String),
      query: expect.any(String),
      components: '9.9.9-panel',
      'query-devtools': '9.9.9-panel',
    });
    expect((window as unknown as Record<string, unknown>)['ethlete']).toEqual(about);

    setQueryDevtoolsAppInfo(undefined);

    expect(queryDevtoolsAbout().app).toBeNull();
    expect((window as unknown as { ethlete: { app: unknown } }).ethlete.app).toBeNull();

    setQueryDevtoolsAppInfo(APP_INFO);
  });

  it('the env scope and ids follow each switch, falling back while nothing is stored', () => {
    scenario();

    expect(queryDevtoolsApiEnvScope()).toBe(`${CDN_ENV_KEY}=&${HUB_ENV_KEY}=staging`);
    expect(queryDevtoolsApiEnvIds()).toEqual(['staging']);

    setQueryDevtoolsApiEnv(HUB_ENV_KEY, 'dev');
    setQueryDevtoolsApiEnv(CDN_ENV_KEY, 'cdn-a');

    expect(queryDevtoolsApiEnvScope()).toBe(`${CDN_ENV_KEY}=cdn-a&${HUB_ENV_KEY}=dev`);
    expect(queryDevtoolsApiEnvIds()).toEqual(['dev', 'cdn-a']);

    setQueryDevtoolsApiEnv(CDN_ENV_KEY, 'cdn-b');

    expect(queryDevtoolsApiEnvScope()).toBe(`${CDN_ENV_KEY}=cdn-b&${HUB_ENV_KEY}=dev`);
    expect(queryDevtoolsApiEnvIds()).toEqual(['dev', 'cdn-b']);
  });

  it('a declared account is offered only for the envs it names, and a panel account only in the scope it was added in', () => {
    scenario();

    expect(accountLabels()).toEqual(['Member']);

    setQueryDevtoolsApiEnv(HUB_ENV_KEY, 'dev');

    expect(accountLabels()).toEqual(['Member', 'Dev admin']);

    addQueryDevtoolsAuthAccount({ provider: PROVIDER_NAME, label: 'Hand-added', loginQuery: 'login' });

    expect(accountLabels()).toEqual(['Member', 'Dev admin', 'Hand-added']);

    setQueryDevtoolsApiEnv(HUB_ENV_KEY, 'staging');

    expect(accountLabels()).toEqual(['Member']);

    setQueryDevtoolsApiEnv(HUB_ENV_KEY, 'dev');

    expect(accountLabels()).toEqual(['Member', 'Dev admin', 'Hand-added']);
  });

  it('clearing credentials keeps the account; removing a panel account drops it and its credentials', () => {
    scenario();

    const [member] = queryDevtoolsAuthAccountsFor(PROVIDER_NAME);

    if (!member) throw new Error('devtools panel contract scenario: the declared account is missing');

    setQueryDevtoolsAuthCredentials({ accountId: member.id, values: { email: 'm@test', password: 'secret' } });

    expect(queryDevtoolsAuthAccountsFor(PROVIDER_NAME)[0]).toMatchObject({
      values: { email: 'm@test', password: 'secret' },
      ready: true,
    });

    clearQueryDevtoolsAuthCredentials(member.id);

    expect(queryDevtoolsAuthAccountsFor(PROVIDER_NAME)[0]).toMatchObject({
      label: 'Member',
      values: { email: '', password: '' },
      ready: false,
    });

    const handAddedId = addQueryDevtoolsAuthAccount({
      provider: PROVIDER_NAME,
      label: 'Hand-added',
      loginQuery: 'login',
    });
    setQueryDevtoolsAuthCredentials({ accountId: handAddedId, values: { email: 'h@test', password: 'secret' } });

    expect(accountLabels()).toEqual(['Member', 'Hand-added']);

    removeQueryDevtoolsAuthAccount(handAddedId);

    expect(accountLabels()).toEqual(['Member']);

    const readdedId = addQueryDevtoolsAuthAccount({
      provider: PROVIDER_NAME,
      label: 'Hand-added',
      loginQuery: 'login',
    });
    const readded = queryDevtoolsAuthAccountsFor(PROVIDER_NAME).find((account) => account.id === readdedId);

    expect(readded?.values).toEqual({ email: '', password: '' });
  });

  it('logout ends the live session without forgetting it', async () => {
    const s = scenario();
    const tab = bootAuthTab(s);

    tab.auth.queries.login.execute({ body: { email: 'a@test' } });
    await s.settle();

    expect(tab.auth.sessionStatus()).toBe('authenticated');
    expect(queryDevtoolsAuthSessionsFor(PROVIDER_NAME)).toHaveLength(1);

    logoutQueryDevtoolsAuthSession(PROVIDER_NAME);
    await s.settle();

    expect(tab.auth.sessionStatus()).not.toBe('authenticated');
    expect(tab.auth.accessToken()).toBeNull();
    expect(queryDevtoolsAuthSessionsFor(PROVIDER_NAME)).toHaveLength(1);

    logoutQueryDevtoolsAuthSession('devtools-panel-contract-unknown-provider');

    tab.destroy();
  });

  it('local auth sessions are allowed in a development build only', () => {
    scenario();

    expect(queryDevtoolsAllowsLocalAuthSessions()).toBe(true);
    expect(inProductionMode(() => queryDevtoolsAllowsLocalAuthSessions())).toBe(false);
  });
});
