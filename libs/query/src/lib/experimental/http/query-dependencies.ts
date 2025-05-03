import {
  DestroyRef,
  EnvironmentInjector,
  Injector,
  createEnvironmentInjector,
  inject,
  ɵEffectScheduler,
} from '@angular/core';
import { QueryClient } from './query-client';
import { QueryClientConfig } from './query-client-config';
import { QueryConfig } from './query-creator';

export type SetupQueryDependenciesOptions = {
  clientConfig: QueryClientConfig;
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
};

export const setupQueryDependencies = (options: SetupQueryDependenciesOptions) => {
  const hostInjector = options.queryConfig?.injector ?? inject(Injector);
  const environmentInjector =
    options.queryConfig?.injector?.get(EnvironmentInjector) ?? hostInjector.get(EnvironmentInjector);
  const queryEnvironmentInjector = createEnvironmentInjector([], environmentInjector);
  const destroyRef = queryEnvironmentInjector.get(DestroyRef);
  const scopeDestroyRef = hostInjector.get(DestroyRef);
  const client = hostInjector.get(options.clientConfig.token);
  const effectScheduler = hostInjector.get(ɵEffectScheduler);

  const dependencies: QueryDependencies = {
    destroyRef,
    scopeDestroyRef,
    client,
    injector: queryEnvironmentInjector,
    effectScheduler,
  };

  // cleanup the environment injector when the scope (e.g. the component the query is in) is destroyed
  const scopeDestroyListener = scopeDestroyRef.onDestroy(() => {
    try {
      queryEnvironmentInjector.destroy();
    } catch {
      // ignore
    }
  });

  destroyRef.onDestroy(() => {
    // cleanup the scope destroy listener
    try {
      scopeDestroyListener();
    } catch {
      // ignore
    }
  });

  return dependencies;
};
