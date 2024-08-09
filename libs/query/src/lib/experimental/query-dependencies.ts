/* eslint-disable @typescript-eslint/no-empty-function */

import { DestroyRef, Injector, inject } from '@angular/core';
import { QueryClient } from './query-client';
import { QueryClientConfig } from './query-client-config';

export type SetupQueryDependenciesOptions = {
  clientConfig: QueryClientConfig;
};

export type QueryDependencies = {
  destroyRef: DestroyRef;
  client: QueryClient;
  injector: Injector;
};

export const setupQueryDependencies = (options: SetupQueryDependenciesOptions) => {
  const destroyRef = inject(DestroyRef);
  const client = inject(options.clientConfig.token);
  const injector = inject(Injector);

  const dependencies: QueryDependencies = {
    destroyRef,
    client,
    injector,
  };

  return dependencies;
};
