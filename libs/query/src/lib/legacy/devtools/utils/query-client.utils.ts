import { InjectionToken, isDevMode } from '@angular/core';
import { QueryClient } from '../../query-client';

export interface QueryClientDevtoolsOptions {
  displayName?: string;
  client: QueryClient;
}

export const QUERY_CLIENT_DEVTOOLS_TOKEN = new InjectionToken<QueryClientDevtoolsOptions[]>(
  'QUERY_CLIENT_DEVTOOLS_TOKEN',
);

export const provideQueryClientForDevtools = (queryClient: QueryClientDevtoolsOptions) => {
  if (!isDevMode()) {
    console.warn(
      'You are using the Query Devtools in production mode. This increases the size of your bundle and should only be used for development purposes.',
    );
  }

  return {
    provide: QUERY_CLIENT_DEVTOOLS_TOKEN,
    useValue: queryClient,
    multi: true,
  };
};
