import { InjectionToken, isDevMode } from '@angular/core';
import { V2QueryClient } from '../../query-client';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryClientDevtoolsOptions = {
  displayName?: string;
  client: V2QueryClient;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const QUERY_CLIENT_DEVTOOLS_TOKEN = new InjectionToken<QueryClientDevtoolsOptions[]>(
  'QUERY_CLIENT_DEVTOOLS_TOKEN',
);

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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
