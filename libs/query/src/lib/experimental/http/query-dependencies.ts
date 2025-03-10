import { DestroyRef, EnvironmentInjector, createEnvironmentInjector, inject, ɵEffectScheduler } from '@angular/core';
import { QueryClient } from './query-client';
import { QueryClientConfig } from './query-client-config';

export type SetupQueryDependenciesOptions = {
  clientConfig: QueryClientConfig;
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
  const environmentInjector = inject(EnvironmentInjector);
  const queryEnvironmentInjector = createEnvironmentInjector([], environmentInjector);
  const destroyRef = queryEnvironmentInjector.get(DestroyRef);
  const scopeDestroyRef = inject(DestroyRef);
  const client = inject(options.clientConfig.token);
  const effectScheduler = inject(ɵEffectScheduler);

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
