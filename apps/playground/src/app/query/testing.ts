import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import {
  CreateEffectOptions,
  DestroyRef,
  InjectionToken,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BuildQueryStringConfig, buildQueryCacheKey, buildRoute, shouldCacheQuery } from '@ethlete/query';
import { BehaviorSubject, Observable, Subject, shareReplay, switchMap, takeUntil, tap } from 'rxjs';

/**
 * Returning this inside e.g. a withComputedArgs feature will reset the query args to null.
 * This will also pause polling and auto refresh until new args are set.
 */
const QUERY_ARGS_RESET = Symbol('QUERY_ARGS_RESET');
type QueryArgsReset = typeof QUERY_ARGS_RESET;

const QUERY_EFFECT_ERROR_MESSAGE =
  'Effect triggered too often. This is probably due to a circular dependency inside the query.';

/** A angular effect that will throw an error in dev mode if it is called too often. This indicates a circular dependency inside the effect. */
const safeEffect = (fn: () => void, errorMessage: string, options?: CreateEffectOptions) => {
  let lastTriggerTs = 0;
  let illegalWrites = 0;

  effect(() => {
    if (isDevMode()) {
      const now = performance.now();

      if (now - lastTriggerTs < 100) {
        illegalWrites++;

        if (illegalWrites > 5) {
          throw new Error(errorMessage);
        }
      }

      lastTriggerTs = now;
    }

    fn();
  }, options);
};

export type QueryArgs = {
  response?: object;
  pathParams?: Record<string, string | number>;
  queryParams?: object;
  body?: object;
};

export type ResponseType<T extends QueryArgs> = T['response'];
export type PathParamsType<T extends QueryArgs> = T['pathParams'];
export type QueryParamsType<T extends QueryArgs> = T['queryParams'];
export type BodyType<T extends QueryArgs> = T['body'];

export type RequestArgs<T extends QueryArgs> = Omit<T, 'response'>;

export type CreateQueryClientConfigOptions = {
  baseUrl: string;
  queryString?: BuildQueryStringConfig;
  name: string;
};

export type QueryClientConfig = {
  baseUrl: string;
  queryString?: BuildQueryStringConfig;
  token: InjectionToken<QueryClient>;
  name: string;
};

export const createQueryClientConfig = (options: CreateQueryClientConfigOptions) => {
  const token = new InjectionToken<QueryClientConfig>(`QueryClient_${options.name}`);

  const clientConfig: QueryClientConfig = {
    baseUrl: options.baseUrl,
    token,
    name: options.name,
    queryString: options.queryString,
  };

  return clientConfig;
};

export type QueryRepositoryRequestOptions<TArgs extends QueryArgs> = {
  method: QueryMethod;
  route: RouteType<TArgs>;
  pathParams?: Record<string, string | number>;
  queryParams?: object;
  body?: object;
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?: boolean | { includeHeaders?: string[] };
  responseType?: 'json';
  key?: string;
  destroyRef: DestroyRef;
};

export type QueryRepository = {
  request: <TArgs extends QueryArgs>(
    options: QueryRepositoryRequestOptions<TArgs>,
  ) => { key: string | false; stream: Observable<HttpEvent<ResponseType<TArgs>>> };
  unbind: (key: string | false, destroyRef: DestroyRef) => void;
};

export const createQueryRepository = (config: QueryClientConfig) => {
  const httpClient = inject(HttpClient);

  const cache = new Map<
    string,
    {
      consumers: Map<DestroyRef, () => void>;
      stream: Observable<HttpEvent<ResponseType<QueryArgs>>>;
      trigger: BehaviorSubject<number>;
    }
  >();

  const request = <TArgs extends QueryArgs>(options: QueryRepositoryRequestOptions<TArgs>) => {
    const shouldCache = shouldCacheQuery(options.method);

    const route = buildRoute({
      base: config.baseUrl,
      route: options.route,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
      queryParamConfig: config.queryString,
    });

    const key =
      shouldCache &&
      buildQueryCacheKey(`${options.key ? options.key + '_' : ''}${route}`, {
        body: options.body,
        queryParams: options.queryParams,
        pathParams: options.pathParams,
        // TODO: remaining props
      });

    if (shouldCache && key) {
      const cacheEntry = cache.get(key);

      if (cacheEntry) {
        bind(key, options.destroyRef, cacheEntry.stream, cacheEntry.trigger);

        // TODO: trigger the trigger if the cache item is stale & not in a loading state
        cacheEntry.trigger.next(1);

        return { key, stream: cacheEntry.stream };
      }
    }

    const trigger = new BehaviorSubject(1);

    // TODO: we should not use rxjs here. Instead we should build a wrapper around it using signals and effect functions with explicit lifecycle management.
    const stream = trigger.pipe(
      switchMap(() =>
        httpClient.request(options.method, route, {
          observe: 'events',
          body: options.body,
          reportProgress: options.reportProgress,
          withCredentials: options.withCredentials,
          transferCache: options.transferCache,
          responseType: options.responseType || 'json',
        }),
      ),
      shareReplay(1),
    );

    trigger.next(1);

    if (shouldCache && key) {
      bind(key, options.destroyRef, stream, trigger);
    }

    return { key, stream };
  };

  const unbind = (key: string | false, destroyRef: DestroyRef) => {
    if (!key) return;

    const cacheEntry = cache.get(key);

    if (!cacheEntry) return;

    cacheEntry.consumers.delete(destroyRef);

    if (cacheEntry.consumers.size === 0) {
      cache.delete(key);
    }
  };

  const bind = (
    key: string | false,
    destroyRef: DestroyRef,
    stream: Observable<HttpEvent<ResponseType<QueryArgs>>>,
    trigger: BehaviorSubject<number>,
  ) => {
    if (!key) return;

    const destroyListener = destroyRef.onDestroy(() => unbind(key, destroyRef));

    const cacheEntry = cache.get(key);

    if (cacheEntry) {
      cacheEntry.consumers.set(destroyRef, destroyListener);
    } else {
      const consumers: Map<DestroyRef, () => void> = new Map([]);

      consumers.set(destroyRef, destroyListener);

      cache.set(key, {
        consumers,
        stream,
        trigger,
      });
    }
  };

  const repository: QueryRepository = {
    request,
    unbind,
  };

  return repository;
};

export type QueryClient = {
  repository: QueryRepository;
};

export const createQueryClient = (config: QueryClientConfig) => {
  const repository = createQueryRepository(config);

  const client: QueryClient = {
    repository,
  };

  return client;
};

export const provideQueryClient = (config: QueryClientConfig) => {
  return {
    provide: config.token,
    useFactory: () => createQueryClient(config),
  };
};

export type CreateBearerAuthProviderOptions = {};

export type BearerAuthProvider = {};

export const createBearerAuthProvider = (options: CreateBearerAuthProviderOptions) => {};

export type CreateQueryExecuteOptions<TArgs extends QueryArgs> = {
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  queryConfig: QueryConfig;
};

export const createExecute = <TArgs extends QueryArgs>(options: CreateQueryExecuteOptions<TArgs>) => {
  const { deps, state, creator, creatorInternals, queryConfig } = options;

  const onExecute$ = new Subject<void>();
  let previousKey: string | false = false;

  return (args = state.args()) => {
    onExecute$.next();
    deps.client.repository.unbind(previousKey, deps.destroyRef);

    const { key, stream } = deps.client.repository.request({
      method: creatorInternals.method,
      route: creator.route,
      reportProgress: creator.reportProgress,
      withCredentials: creator.withCredentials,
      transferCache: creator.transferCache,
      responseType: creator.responseType || 'json',
      pathParams: args?.pathParams,
      queryParams: args?.queryParams,
      body: args?.body,
      destroyRef: deps.destroyRef,
      key: queryConfig.key,
    });

    previousKey = key;

    stream
      .pipe(
        takeUntilDestroyed(deps.destroyRef),
        takeUntil(onExecute$),
        tap((currentEvent) => {
          state.response.set(currentEvent);

          if (currentEvent.type === HttpEventType.Response) {
            state.response.set(currentEvent.body);
          }
        }),
      )
      .subscribe();
  };
};

export type CreateQueryOptions<TArgs extends QueryArgs> = {
  creator: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  features: QueryFeature<TArgs>[];
  queryConfig: QueryConfig;
};

export type Query<TArgs extends QueryArgs> = {
  execute: () => void;
  args: Signal<RequestArgs<TArgs> | null>;
  response: Signal<ResponseType<TArgs> | null>;
  latestHttpEvent: Signal<HttpEvent<ResponseType<TArgs>> | null>;
};

export const createQuery = <TArgs extends QueryArgs>(options: CreateQueryOptions<TArgs>) => {
  const deps = setupQueryDependencies({ clientConfig: options.creatorInternals.client });
  const state = setupQueryState<TArgs>({});
  const { creator, creatorInternals, features, queryConfig } = options;

  const execute = createExecute<TArgs>({ deps, state, creator, creatorInternals, queryConfig: options.queryConfig });

  const featureFnContext: QueryFeatureContext<TArgs> = {
    state,
    execute,
  };

  for (const feature of features) {
    feature.fn(featureFnContext);
  }

  const query: Query<TArgs> = {
    execute,
    args: state.args.asReadonly(),
    response: state.response.asReadonly(),
    latestHttpEvent: state.latestHttpEvent.asReadonly(),
  };

  return query;
};

export type RouteType<TArgs extends QueryArgs> =
  PathParamsType<TArgs> extends { [key: string]: string } ? (args: TArgs['pathParams']) => RouteString : RouteString;

export type RouteString = `/${string}`;

export type CreateQueryCreatorOptions<TArgs extends QueryArgs> = {
  route: RouteType<TArgs>;
  reportProgress?: boolean;
  responseType?: 'json';
  withCredentials?: boolean;
  transferCache?:
    | {
        includeHeaders?: string[];
      }
    | boolean;
};

export type QueryMethod = 'GET' | 'OPTIONS' | 'HEAD';

export type InternalCreateQueryCreatorOptions = {
  method: QueryMethod;
  client: QueryClientConfig;
};

export type QueryConfig = {
  key?: string;
};

export const splitQueryConfig = <TArgs extends QueryArgs>(args: (QueryFeature<TArgs> | QueryConfig)[]) => {
  let queryConfig: QueryConfig = {};
  let features: QueryFeature<TArgs>[] = [];

  const first = args[0];

  if (first) {
    if ('type' in first) {
      features = args as QueryFeature<TArgs>[];
    } else {
      [queryConfig, ...features] = args as [QueryConfig, ...QueryFeature<TArgs>[]];
    }
  }
  return { features, queryConfig };
};

export const createQueryCreator = <TArgs extends QueryArgs>(
  options: CreateQueryCreatorOptions<TArgs>,
  internals: InternalCreateQueryCreatorOptions,
) => {
  function queryCreator(...features: QueryFeature<TArgs>[]): Query<TArgs>;
  function queryCreator(queryConfig: QueryConfig, ...features: QueryFeature<TArgs>[]): Query<TArgs>;

  function queryCreator(...args: (QueryFeature<TArgs> | QueryConfig)[]): Query<TArgs> {
    const { features, queryConfig } = splitQueryConfig<TArgs>(args);

    return createQuery<TArgs>({
      creator: options,
      creatorInternals: internals,
      features,
      queryConfig,
    });
  }

  return queryCreator;
};

export type CreateClientQueryOptions = {};

export const createGetQuery = (client: QueryClientConfig, options?: CreateClientQueryOptions) => {
  return <TArgs extends QueryArgs>(creatorOptions: CreateQueryCreatorOptions<TArgs>) =>
    createQueryCreator<TArgs>(creatorOptions, { method: 'GET', client });
};

export type CreateSecureQueryOptions = CreateClientQueryOptions & {
  authProvider: BearerAuthProvider;
};

export const createSecureGetQuery = (options: CreateSecureQueryOptions) => {};

export type SetupQueryStateOptions = {};

export type QueryState<TArgs extends QueryArgs> = {
  response: WritableSignal<ResponseType<TArgs> | null>;
  args: WritableSignal<RequestArgs<TArgs> | null>;
  latestHttpEvent: WritableSignal<HttpEvent<ResponseType<TArgs>> | null>;
  loading: Signal<boolean>;
  error: Signal<boolean>;
};

const setupQueryState = <TArgs extends QueryArgs>(options: SetupQueryStateOptions) => {
  const response = signal<ResponseType<TArgs> | null>(null);
  const args = signal<RequestArgs<TArgs> | null>(null);
  const latestHttpEvent = signal<HttpEvent<ResponseType<TArgs>> | null>(null);

  const loading = computed(() => latestHttpEvent()?.type !== HttpEventType.Response);
  const error = computed(() => latestHttpEvent() instanceof HttpErrorResponse);

  const state: QueryState<TArgs> = {
    response,
    args,
    latestHttpEvent,
    loading,
    error,
  };

  return state;
};

export type SetupQueryDependenciesOptions = {
  clientConfig: QueryClientConfig;
};

export type QueryDependencies = {
  destroyRef: DestroyRef;
  client: QueryClient;
};

export const setupQueryDependencies = (options: SetupQueryDependenciesOptions) => {
  const destroyRef = inject(DestroyRef);
  const client = inject(options.clientConfig.token);

  const dependencies: QueryDependencies = {
    destroyRef,
    client,
  };

  return dependencies;
};

const enum QueryFeatureType {
  WithArgs,
  WithLogging,
  WithErrorHandling,
  WithSuccessHandling,
  WithPolling,
  WithAutoRefresh,
}

type QueryFeatureContext<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  execute: (args: RequestArgs<TArgs>) => void;
};

type QueryFeatureFn<TArgs extends QueryArgs> = (context: QueryFeatureContext<TArgs>) => void;

export type QueryFeature<TArgs extends QueryArgs> = {
  type: QueryFeatureType;
  fn: (context: QueryFeatureContext<TArgs>) => void;
};

const createQueryFeature = <TArgs extends QueryArgs>(config: { type: QueryFeatureType; fn: QueryFeatureFn<TArgs> }) => {
  return config as QueryFeature<TArgs>;
};

export const withArgs = <TArgs extends QueryArgs>(args: () => NoInfer<RequestArgs<TArgs>> | QueryArgsReset | null) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithArgs,
    fn: (context) => {
      const currArgs = computed(() => args());

      safeEffect(() => {
        const currArgsNow = currArgs();

        if (currArgsNow === null) return;

        untracked(() => {
          if (currArgsNow === QUERY_ARGS_RESET) {
            context.state.args.set(null);
            return;
          }

          context.state.args.set(currArgsNow);
          context.execute(currArgsNow);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};

export const withPolling = <TArgs extends QueryArgs>(options: { interval: number; executeInitially?: boolean }) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithPolling,
    fn: (context) => {
      let intervalId: number | null = null;

      safeEffect(() => {
        const args = context.state.args();

        untracked(() => {
          if (intervalId !== null) clearInterval(intervalId);

          if (args === null) return;

          if (options.executeInitially) {
            context.execute(args);
          }

          intervalId = window.setInterval(() => {
            context.execute(args);
          }, options.interval);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);

      inject(DestroyRef).onDestroy(() => intervalId !== null && clearInterval(intervalId));
    },
  });
};

export const withLogging = <TArgs extends QueryArgs>(options: {
  logFn: (v: HttpEvent<ResponseType<TArgs>> | null) => void;
}) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithLogging,
    fn: (context) => {
      effect(() => {
        const event = context.state.latestHttpEvent();

        if (event === null) return;

        untracked(() => {
          options.logFn(event);
        });
      });
    },
  });
};

export const withErrorHandling = <TArgs extends QueryArgs>(options: { handler: (e: boolean) => void }) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithErrorHandling,
    fn: (context) => {
      effect(() => {
        const error = context.state.error();

        if (error === null) return;

        untracked(() => {
          options.handler(error);
        });
      });
    },
  });
};

export const withSuccessHandling = <TArgs extends QueryArgs>(options: {
  handler: (data: NonNullable<ResponseType<TArgs>>) => void;
}) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithSuccessHandling,
    fn: (context) => {
      effect(() => {
        const response = context.state.response();

        if (response === null) return;

        untracked(() => {
          options.handler(response as NonNullable<ResponseType<TArgs>>);
        });
      });
    },
  });
};
