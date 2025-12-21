import { inject, InjectionToken } from '@angular/core';
import { createStaticProvider } from '@ethlete/core';
import { QueryDependencies } from './query-dependencies';

export type QueryContext = {
  /** All query dependencies (client, injector, destroy refs, etc.) */
  deps: QueryDependencies;
};

const QUERY_CONTEXT_TOKEN = new InjectionToken<QueryContext>('QUERY_CONTEXT');

export const createQueryContext = (context: QueryContext) =>
  createStaticProvider(context, {
    name: 'Query Context',
    extraInjectionToken: QUERY_CONTEXT_TOKEN,
  });

export const injectQueryContext = () => inject(QUERY_CONTEXT_TOKEN);
