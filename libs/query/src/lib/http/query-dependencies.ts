import { HttpClient } from '@angular/common/http';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  ErrorHandler,
  inject,
  Injector,
  ɵEffectScheduler,
} from '@angular/core';
import { AnyQueryClient, QueryClient } from './query-client';
import { createQueryContext, QueryContext } from './query-context';
import { QueryConfig } from './query-creator';

export type SetupQueryDependenciesOptions = {
  /** The query client tuple from createQueryClient */
  client: AnyQueryClient;
  queryConfig: QueryConfig | undefined;
};

export type QueryDependencies = {
  /** The destroy ref of the query. */
  destroyRef: DestroyRef;

  /** The destroy ref of the scope the query is in (e.g. a component) */
  scopeDestroyRef: DestroyRef;

  /** The query client */
  client: QueryClient;

  /** The injector of the query */
  injector: EnvironmentInjector;

  /** The effect scheduler */
  effectScheduler: ɵEffectScheduler;

  /** The error handler */
  ngErrorHandler: ErrorHandler;

  /** The http client */
  httpClient: HttpClient;
};

export const setupQueryDependencies = (options: SetupQueryDependenciesOptions) => {
  const hostInjector = options.queryConfig?.injector ?? inject(Injector);
  const environmentInjector =
    options.queryConfig?.injector?.get(EnvironmentInjector) ?? hostInjector.get(EnvironmentInjector);

  // Support both old clientConfig and new client tuple
  const [, injectClient] = options.client;

  // Create dependencies object first (will be populated after injector creation)
  const dependencies: QueryDependencies = {
    destroyRef: undefined as unknown as DestroyRef, // Will be set after injector creation
    scopeDestroyRef: hostInjector.get(DestroyRef),
    client: injectClient(),
    injector: undefined as unknown as EnvironmentInjector, // Will be set after injector creation
    effectScheduler: hostInjector.get(ɵEffectScheduler),
    ngErrorHandler: hostInjector.get(ErrorHandler),
    httpClient: hostInjector.get(HttpClient),
  };

  // Create query context that will be provided via DI
  const queryContext: QueryContext = {
    deps: dependencies,
  };

  // Create provider for the query context
  const [provideQueryContext] = createQueryContext(queryContext);

  // Create environment injector with QUERY_CONTEXT provider
  const queryEnvironmentInjector = createEnvironmentInjector([provideQueryContext()], environmentInjector);

  // Now set the injector-dependent properties
  dependencies.destroyRef = queryEnvironmentInjector.get(DestroyRef);
  dependencies.injector = queryEnvironmentInjector;

  // cleanup the environment injector when the scope (e.g. the component the query is in) is destroyed
  const scopeDestroyListener = dependencies.scopeDestroyRef.onDestroy(() => {
    try {
      queryEnvironmentInjector.destroy();
    } catch {
      // ignore
    }
  });

  dependencies.destroyRef.onDestroy(() => {
    // cleanup the scope destroy listener
    try {
      scopeDestroyListener();
    } catch {
      // ignore
    }
  });

  return dependencies;
};
