import { provideHttpClient, HttpBackend } from '@angular/common/http';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  EnvironmentProviders,
  ErrorHandler,
  Injector,
  Provider,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AnyCreateBearerAuthProviderResult,
  AnyQueryClient,
  AuthQueryBuilder,
  BearerAuthProvider,
  BearerAuthProviderFeatureContext,
  createBearerAuthProvider,
  createDeleteQuery,
  createGetQuery,
  createPatchQuery,
  createPostQuery,
  createPutQuery,
  createQueryClient,
  CreateQueryClientConfigOptions,
  QueryClientFeatureFn,
  QueryClientRef,
  TokenRefreshQueryBuilder,
  TokenRefreshQueryConfig,
  withAuthenticationQuery,
  withRefreshQuery,
} from '../../index';
import { afterEach, beforeEach, vi } from 'vitest';
import { createFakeApi, FakeApi } from './fake-api';
import { checkInvariants, InvariantName, ScenarioErrorEntry } from './invariants';
import { mintToken } from './tokens';

export type ScenarioProviders = (EnvironmentProviders | Provider)[];

export type ScenarioConfig = {
  name?: string;
  baseUrl?: string;
  clientOptions?: Omit<Partial<CreateQueryClientConfigOptions>, 'name' | 'baseUrl' | 'features'>;
  clientFeatures?: readonly QueryClientFeatureFn[];
  /**
   * Extra TestBed providers. A function runs once per scenario, inside `beforeEach`, for a provider
   * whose creation has a side effect that must not happen while the file is still being collected.
   */
  providers?: ScenarioProviders | (() => ScenarioProviders);
};

export type ScenarioConsumer = {
  injector: EnvironmentInjector;
  destroyRef: DestroyRef;
  run: <T>(fn: () => T) => T;
  destroy: () => void;
};

type AnyAuthFeatureBuilder = (
  context: BearerAuthProviderFeatureContext<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    ScenarioAuthBuilders
  >,
) => {
  type: string;
  instance: unknown;
};

type ScenarioAuthTokenArgs = {
  body: Record<string, unknown>;
  response: { accessToken: string; refreshToken: string };
};

/**
 * The login and refresh builders `auth()` registers. Pass it as the explicit generic of an auth
 * feature that is built outside of the `features` array, where nothing else supplies it.
 */
export type ScenarioAuthBuilders = readonly [
  AuthQueryBuilder<'login', ScenarioAuthTokenArgs>,
  TokenRefreshQueryBuilder<'refresh', ScenarioAuthTokenArgs>,
];

export type ScenarioAuthConfig<
  TFeatures extends readonly AnyAuthFeatureBuilder[] = readonly AnyAuthFeatureBuilder[],
  TBearerData = unknown,
> = {
  /** @default '/auth/login' */
  loginPath?: `/${string}`;
  /** @default '/auth/refresh' */
  refreshPath?: `/${string}`;
  autoRetryOn401?: boolean;
  /** @default 900000 (15 minutes) */
  accessTokenExpiresInMs?: number;
  /** @default 3600000 (1 hour) */
  refreshTokenExpiresInMs?: number;
  features?: [...TFeatures];
  refreshStrategy?: TokenRefreshQueryConfig<ScenarioAuthTokenArgs>['refreshStrategy'];
  minRefreshInterval?: number;
  refreshIfExpired?: boolean;
  expiresInPropertyName?: string;
  onRefreshFailure?: TokenRefreshQueryConfig<ScenarioAuthTokenArgs>['onRefreshFailure'];
  bearerDecryptFn?: (token: string) => TBearerData;
};

export type Scenario = {
  api: FakeApi;
  client: AnyQueryClient;
  clientRef: QueryClientRef;
  injector: Injector;
  get: ReturnType<typeof createGetQuery>;
  post: ReturnType<typeof createPostQuery>;
  put: ReturnType<typeof createPutQuery>;
  patch: ReturnType<typeof createPatchQuery>;
  delete: ReturnType<typeof createDeleteQuery>;
  run: <T>(fn: () => T) => T;
  consumer: () => ScenarioConsumer;
  tick: (ms?: number) => void;
  settle: (ms?: number) => Promise<void>;
  flush: (maxMs?: number) => void;
  errors: ScenarioErrorEntry[];
  expectError: (matcher: string | RegExp | ((entry: ScenarioErrorEntry) => boolean)) => void;
  allow: (name: InvariantName, reason: string) => void;
  auth: <TFeatures extends readonly AnyAuthFeatureBuilder[] = [], TBearerData = unknown>(
    config?: ScenarioAuthConfig<TFeatures, TBearerData>,
  ) => BearerAuthProvider<ScenarioAuthBuilders, TFeatures, TBearerData> & {
    /**
     * The provider's own root-provider definition - what `createSecureGetQuery` and friends need as
     * their second argument. `auth()` already resolves and returns the injected instance, which is
     * all a secure creator template cannot be built from.
     */
    ref: AnyCreateBearerAuthProviderResult;
  };
  destroy: () => void;
};

let authProviderCounter = 0;

const buildScenario = (config: ScenarioConfig): Scenario => {
  const baseUrl = config.baseUrl ?? 'https://api.test';
  const name = config.name ?? `scenario-${Math.random().toString(36).slice(2)}`;
  const api = createFakeApi({ baseUrl });
  const errors: ScenarioErrorEntry[] = [];
  const allowed = new Set<InvariantName>();
  const consumers = new Set<EnvironmentInjector>();

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push({ source: 'console.error', error: args[0] });
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: HttpBackend, useValue: api.backend },
      provideRouter([]),
      {
        provide: ErrorHandler,
        useValue: {
          handleError: (error: unknown) => errors.push({ source: 'ErrorHandler', error }),
        },
      },
      ...(typeof config.providers === 'function' ? config.providers() : (config.providers ?? [])),
    ],
  });

  const clientRef = createQueryClient({
    name,
    baseUrl,
    ...config.clientOptions,
    features: config.clientFeatures,
  });

  const injector = TestBed.inject(EnvironmentInjector);

  const client = TestBed.runInInjectionContext(() => {
    const instance = clientRef.inject();

    if (!instance) throw new Error(`Scenario: failed to create query client "${name}"`);

    return instance;
  });

  const run = <T>(fn: () => T): T => TestBed.runInInjectionContext(fn);

  const tick = (ms = 0) => {
    TestBed.tick();
    vi.advanceTimersByTime(ms);
    vi.runAllTicks();
    TestBed.tick();
  };

  const settle = async (ms = 0) => {
    tick(ms);
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
      TestBed.tick();
    }
  };

  const flush = (maxMs = 60_000) => {
    let elapsed = 0;
    let previousTimerCount = -1;
    let stableRounds = 0;

    while (elapsed < maxMs) {
      tick(50);
      elapsed += 50;

      const timerCount = vi.getTimerCount();

      if (api.pending().length === 0 && timerCount === previousTimerCount) {
        stableRounds++;
        if (stableRounds >= 2) return;
      } else {
        stableRounds = 0;
      }

      previousTimerCount = timerCount;
    }

    throw new Error(`Scenario: flush() did not settle within ${maxMs}ms`);
  };

  const consumer = (): ScenarioConsumer => {
    const childInjector = createEnvironmentInjector([], injector);

    consumers.add(childInjector);

    return {
      injector: childInjector,
      destroyRef: childInjector.get(DestroyRef),
      run: (fn) => childInjector.runInContext(fn),
      destroy: () => {
        consumers.delete(childInjector);
        childInjector.destroy();
      },
    };
  };

  const expectError = (matcher: string | RegExp | ((entry: ScenarioErrorEntry) => boolean)) => {
    const predicate: (entry: ScenarioErrorEntry) => boolean =
      typeof matcher === 'function'
        ? matcher
        : (entry) => {
            const text = String(entry.error);
            return typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
          };

    const index = errors.findIndex(predicate);

    if (index === -1) {
      throw new Error(
        `Scenario: expectError() found no matching entry among ${errors.length} captured error(s):\n${errors
          .map((e) => `[${e.source}] ${String(e.error)}`)
          .join('\n')}`,
      );
    }

    errors.splice(index, 1);
  };

  const allowedReasons = new Map<InvariantName, string>();
  const allow = (invariant: InvariantName, reason: string) => {
    allowed.add(invariant);
    allowedReasons.set(invariant, reason);
  };

  const auth = <TFeatures extends readonly AnyAuthFeatureBuilder[] = [], TBearerData = unknown>(
    authConfig: ScenarioAuthConfig<TFeatures, TBearerData> = {},
  ) => {
    const {
      loginPath = '/auth/login',
      refreshPath = '/auth/refresh',
      autoRetryOn401 = false,
      accessTokenExpiresInMs = 15 * 60 * 1000,
      refreshTokenExpiresInMs = 60 * 60 * 1000,
      features,
      refreshStrategy,
      minRefreshInterval,
      refreshIfExpired,
      expiresInPropertyName,
      onRefreshFailure,
      bearerDecryptFn,
    } = authConfig;

    api.on('POST', loginPath, () => ({
      body: {
        accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
        refreshToken: mintToken({ expiresInMs: refreshTokenExpiresInMs }),
      },
    }));

    api.on('POST', refreshPath, () => ({
      body: {
        accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
        refreshToken: mintToken({ expiresInMs: refreshTokenExpiresInMs }),
      },
    }));

    const login = createPostQuery(clientRef)<ScenarioAuthTokenArgs>(loginPath);
    const refresh = createPostQuery(clientRef)<ScenarioAuthTokenArgs>(refreshPath);
    const extractTokens = (response: ScenarioAuthTokenArgs['response']) => ({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    const authProviderRef = createBearerAuthProvider({
      name: `scenario-auth-${authProviderCounter++}`,
      queryClientRef: clientRef,
      queries: [
        withAuthenticationQuery('login', { queryCreator: login, extractTokens }),
        withRefreshQuery('refresh', {
          queryCreator: refresh,
          extractTokens,
          autoRetryOn401,
          refreshStrategy,
          minRefreshInterval,
          refreshIfExpired,
          expiresInPropertyName,
          onRefreshFailure,
        }),
      ] as unknown as ScenarioAuthBuilders,
      features: (features ?? ([] as const)) as unknown as TFeatures,
      bearerDecryptFn,
    });

    const provider = run(() => authProviderRef.inject());

    if (!provider) throw new Error('Scenario: failed to create auth provider');

    return Object.assign(provider, { ref: authProviderRef });
  };

  const destroy = () => {
    for (const childInjector of Array.from(consumers)) {
      consumers.delete(childInjector);
      childInjector.destroy();
    }

    TestBed.resetTestingModule();
    console.error = originalConsoleError;

    // Angular's change detection scheduler arms a zero-delay timer after the last signal write. Let it
    // fire, so the timer invariant reports real leaks only.
    vi.advanceTimersByTime(1);

    checkInvariants({ api, client, errors, allowed });
  };

  return {
    api,
    client,
    clientRef,
    injector,
    get: createGetQuery(clientRef),
    post: createPostQuery(clientRef),
    put: createPutQuery(clientRef),
    patch: createPatchQuery(clientRef),
    delete: createDeleteQuery(clientRef),
    run,
    consumer,
    tick,
    settle,
    flush,
    errors,
    expectError,
    allow,
    auth: auth as Scenario['auth'],
    destroy,
  };
};

export const createScenario = (config: ScenarioConfig = {}): (() => Scenario) => {
  let current: Scenario | null = null;

  return () => {
    if (!current) current = buildScenario(config);
    return current;
  };
};

export const useScenario = (config: ScenarioConfig = {}): (() => Scenario) => {
  let current: Scenario | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    current = buildScenario(config);
  });

  afterEach(() => {
    current?.destroy();
    current = null;
    vi.useRealTimers();
  });

  return () => {
    if (!current) throw new Error('Scenario: accessed outside of a running test');
    return current;
  };
};
