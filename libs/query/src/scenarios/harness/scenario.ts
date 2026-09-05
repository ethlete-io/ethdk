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
  AnyNewQuery,
  AnyQueryClient,
  AuthQueryBuilder,
  BearerAuthProvider,
  BearerAuthProviderFeatureContext,
  createBearerAuthProvider,
  createDeleteQuery,
  createGetQuery,
  createHeadQuery,
  createOptionsQuery,
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
import { createFakeXhr } from './fake-xhr';
import { checkInvariants, InvariantName, ScenarioErrorEntry, ScenarioWarningEntry } from './invariants';
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
  /**
   * The query client the login and refresh queries run on, and the one the provider reads its
   * repository from.
   * @default the scenario's own client
   */
  clientRef?: QueryClientRef;
  /**
   * The provider's name. Two tabs of the same app share one, so that anything the provider namespaces
   * with it - its default sync channel, its storage keys - lines up between them.
   * @default a name of its own, `scenario-auth-<n>`
   */
  name?: string;
  /**
   * The injector the provider is created below, as a tab's own client injector is. The provider gets an
   * instance of its own there rather than the root one every other `s.auth()` shares, which is what
   * makes a second authenticated tab expressible. The caller owns the returned
   * {@link ScenarioAuthResult.injector} and destroys it.
   * @default the scenario's root injector
   */
  injector?: EnvironmentInjector;
};

/** What `auth()` adds to the provider it returns. */
export type ScenarioAuthResult = {
  /**
   * The provider's own root-provider definition - what `createSecureGetQuery` and friends need as
   * their second argument. `auth()` already resolves and returns the injected instance, which is
   * all a secure creator template cannot be built from.
   */
  ref: AnyCreateBearerAuthProviderResult;
  /**
   * The injector this provider instance lives in: the scenario's root injector, or the layer `auth()`
   * created below the `injector` it was given. Create the tab's consumers below it -
   * `s.consumer([], auth.injector)` - since one created anywhere else resolves the root instance instead.
   */
  injector: EnvironmentInjector;
};

export type Scenario = {
  api: FakeApi;
  client: AnyQueryClient;
  clientRef: QueryClientRef;
  injector: Injector;
  get: ReturnType<typeof createGetQuery>;
  head: ReturnType<typeof createHeadQuery>;
  options: ReturnType<typeof createOptionsQuery>;
  post: ReturnType<typeof createPostQuery>;
  put: ReturnType<typeof createPutQuery>;
  patch: ReturnType<typeof createPatchQuery>;
  delete: ReturnType<typeof createDeleteQuery>;
  run: <T>(fn: () => T) => T;
  /**
   * Creates a fake component with its own child injector and `DestroyRef`; `providers` are the ones
   * that component brings along, visible to everything created inside its `run`. `parent` puts the
   * component below another tab's injector instead of the scenario's root one.
   */
  consumer: (providers?: ScenarioProviders, parent?: EnvironmentInjector) => ScenarioConsumer;
  tick: (ms?: number) => void;
  settle: (ms?: number) => Promise<void>;
  flush: (maxMs?: number) => void;
  errors: ScenarioErrorEntry[];
  expectError: (matcher: string | RegExp | ((entry: ScenarioErrorEntry) => boolean)) => void;
  /**
   * Every `console.warn` the scenario captured, kept apart from `errors` so that a warning never fails
   * an invariant on its own. Empty while a suite of its own holds a `console.warn` spy.
   */
  warnings: ScenarioWarningEntry[];
  /** Consumes one captured warning, the way `expectError` consumes one captured error. */
  expectWarning: (matcher: string | RegExp | ((entry: ScenarioWarningEntry) => boolean)) => void;
  /**
   * Every query created through one of the scenario's own creators (`s.get`, `s.post`, ... - including
   * the ones a stack or a batch creates internally) that has not been destroyed yet, in creation order.
   */
  liveQueries: () => AnyNewQuery[];
  allow: (name: InvariantName, reason: string) => void;
  auth: <TFeatures extends readonly AnyAuthFeatureBuilder[] = [], TBearerData = unknown>(
    config?: ScenarioAuthConfig<TFeatures, TBearerData>,
  ) => BearerAuthProvider<ScenarioAuthBuilders, TFeatures, TBearerData> & ScenarioAuthResult;
  destroy: () => void;
};

let authProviderCounter = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScenarioCreatorFactory = (...args: any[]) => any;

const consumeEntry = <TEntry extends { source: string }>(options: {
  entries: TEntry[];
  matcher: string | RegExp | ((entry: TEntry) => boolean);
  read: (entry: TEntry) => unknown;
  method: string;
  noun: string;
}) => {
  const { entries, matcher, read, method, noun } = options;

  const predicate: (entry: TEntry) => boolean =
    typeof matcher === 'function'
      ? matcher
      : (entry) => {
          const text = String(read(entry));
          return typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
        };

  const index = entries.findIndex(predicate);

  if (index === -1) {
    throw new Error(
      `Scenario: ${method}() found no matching entry among ${entries.length} captured ${noun}(s):\n${entries
        .map((entry) => `[${entry.source}] ${String(read(entry))}`)
        .join('\n')}`,
    );
  }

  entries.splice(index, 1);
};

/**
 * Runs `fn` with Angular in production mode and restores the previous mode afterwards - `isDevMode()`
 * reads the `ngDevMode` global and `enableProdMode()` sets it without a way back, which would leave
 * every later test in the file running in production mode too.
 */
export const inProductionMode = <T>(fn: () => T): T => {
  const globals = globalThis as { ngDevMode?: unknown };
  const previous = globals.ngDevMode;

  globals.ngDevMode = false;

  try {
    return fn();
  } finally {
    globals.ngDevMode = previous;
  }
};

const buildScenario = (config: ScenarioConfig): Scenario => {
  const baseUrl = config.baseUrl ?? 'https://api.test';
  const name = config.name ?? `scenario-${Math.random().toString(36).slice(2)}`;
  const api = createFakeApi({ baseUrl });
  const errors: ScenarioErrorEntry[] = [];
  const warnings: ScenarioWarningEntry[] = [];
  const allowed = new Set<InvariantName>();
  const consumers = new Set<EnvironmentInjector>();
  const live = new Set<AnyNewQuery>();

  const originalXhr = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = createFakeXhr(api);

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push({ source: 'console.error', error: args[0] });
  };

  const originalConsoleWarn = console.warn;
  const captureWarning = (...args: unknown[]) => {
    warnings.push({ source: 'console.warn', warning: args[0] });
  };

  // A suite that installed its own `console.warn` spy before the scenario was built keeps it: taking the
  // global away from a mock leaves that suite's `mockRestore()` with nothing to restore.
  if (!vi.isMockFunction(console.warn)) console.warn = captureWarning;

  const restoreGlobals = () => {
    console.error = originalConsoleError;
    if (console.warn === captureWarning) console.warn = originalConsoleWarn;
    globalThis.XMLHttpRequest = originalXhr;
  };

  // A failure below has to hand the patched globals back: `useScenario`'s `afterEach` has no scenario to
  // destroy when the build throws, so every later test in the file would report into these arrays.
  try {
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

    const consumer = (providers: ScenarioProviders = [], parent: EnvironmentInjector = injector): ScenarioConsumer => {
      const childInjector = createEnvironmentInjector(providers, parent);

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

    const trackQuery = (created: unknown) => {
      if (typeof created !== 'object' || created === null) return;

      const queryInjector = (created as { subtle?: { injector?: EnvironmentInjector } }).subtle?.injector;

      if (!queryInjector) return;

      const query = created as AnyNewQuery;

      live.add(query);
      queryInjector.get(DestroyRef).onDestroy(() => live.delete(query));
    };

    const trackCreatedQueries = <TFactory extends ScenarioCreatorFactory>(factory: TFactory): TFactory =>
      new Proxy(factory, {
        apply: (target, thisArg, args) => {
          const creator = Reflect.apply(target, thisArg, args);

          if (typeof creator !== 'function') return creator;

          return new Proxy(creator as ScenarioCreatorFactory, {
            apply: (creatorTarget, creatorThisArg, creatorArgs) => {
              const created = Reflect.apply(creatorTarget, creatorThisArg, creatorArgs);

              trackQuery(created);

              return created;
            },
          });
        },
      });

    const expectError = (matcher: string | RegExp | ((entry: ScenarioErrorEntry) => boolean)) => {
      consumeEntry({ entries: errors, matcher, read: (entry) => entry.error, method: 'expectError', noun: 'error' });
    };

    const expectWarning = (matcher: string | RegExp | ((entry: ScenarioWarningEntry) => boolean)) => {
      consumeEntry({
        entries: warnings,
        matcher,
        read: (entry) => entry.warning,
        method: 'expectWarning',
        noun: 'warning',
      });
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
        clientRef: authClientRef = clientRef,
        name: providerName = `scenario-auth-${authProviderCounter++}`,
        injector: parentInjector,
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

      const login = createPostQuery(authClientRef)<ScenarioAuthTokenArgs>(loginPath);
      const refresh = createPostQuery(authClientRef)<ScenarioAuthTokenArgs>(refreshPath);
      const extractTokens = (response: ScenarioAuthTokenArgs['response']) => ({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      const authProviderRef = createBearerAuthProvider({
        name: providerName,
        queryClientRef: authClientRef,
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

      const providerInjector = parentInjector
        ? createEnvironmentInjector(authProviderRef.provide(), parentInjector)
        : null;

      const provider = providerInjector
        ? providerInjector.runInContext(() => authProviderRef.inject())
        : run(() => authProviderRef.inject());

      if (!provider) throw new Error('Scenario: failed to create auth provider');

      return Object.assign(provider, { ref: authProviderRef, injector: providerInjector ?? injector });
    };

    const destroy = () => {
      for (const childInjector of Array.from(consumers)) {
        consumers.delete(childInjector);
        childInjector.destroy();
      }

      TestBed.resetTestingModule();
      restoreGlobals();

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
      get: trackCreatedQueries(createGetQuery(clientRef)),
      head: trackCreatedQueries(createHeadQuery(clientRef)),
      options: trackCreatedQueries(createOptionsQuery(clientRef)),
      post: trackCreatedQueries(createPostQuery(clientRef)),
      put: trackCreatedQueries(createPutQuery(clientRef)),
      patch: trackCreatedQueries(createPatchQuery(clientRef)),
      delete: trackCreatedQueries(createDeleteQuery(clientRef)),
      run,
      consumer,
      tick,
      settle,
      flush,
      errors,
      expectError,
      warnings,
      expectWarning,
      liveQueries: () => Array.from(live),
      allow,
      auth: auth as Scenario['auth'],
      destroy,
    };
  } catch (error) {
    restoreGlobals();
    throw error;
  }
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
