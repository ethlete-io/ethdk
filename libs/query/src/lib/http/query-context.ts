import { inject, InjectionToken } from '@angular/core';
import { defineStaticProvider } from '@ethlete/core';
import { QueryDependencies } from './query-dependencies';

/** @internal */
export type QueryContext = {
  /** All query dependencies (client, injector, destroy refs, etc.) */
  deps: QueryDependencies;
};

const QUERY_CONTEXT_TOKEN = new InjectionToken<QueryContext>('QUERY_CONTEXT');

/** @internal */
export const createQueryContext = (context: QueryContext) =>
  defineStaticProvider(context, {
    name: 'Query Context',
    extraInjectionToken: QUERY_CONTEXT_TOKEN,
  });

/** @internal */
export const injectQueryContext = () => inject(QUERY_CONTEXT_TOKEN);
