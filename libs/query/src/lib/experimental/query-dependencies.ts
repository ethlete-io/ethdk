import { DestroyRef, EnvironmentInjector, createEnvironmentInjector, inject } from '@angular/core';
import { QueryClient } from './query-client';
import { QueryClientConfig } from './query-client-config';

export type SetupQueryDependenciesOptions = {
  clientConfig: QueryClientConfig;
};

export type QueryDependencies = {
  destroyRef: DestroyRef;
  client: QueryClient;
  injector: EnvironmentInjector;
};

export const setupQueryDependencies = (options: SetupQueryDependenciesOptions) => {
  const environmentInjector = inject(EnvironmentInjector);
  const queryEnvironmentInjector = createEnvironmentInjector([], environmentInjector);
  const destroyRef = queryEnvironmentInjector.get(DestroyRef);
  const client = inject(options.clientConfig.token);

  const dependencies: QueryDependencies = {
    destroyRef,
    client,
    injector: queryEnvironmentInjector,
  };

  return dependencies;
};
