import { HttpHeaders } from '@angular/common/http';
import { inject, Injector, runInInjectionContext, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { EntityStore } from '../../entity';
import { BaseArguments, RouteType, WithConfig, WithHeaders, WithInjector, WithMock } from '../../query';
import { QueryPrepareFn } from '../../query-creator';
import { addQueryContainerHandling, QueryContainerConfig } from '../../utils';
import { Query, QueryArgs, QueryCreator, RequestArgs, ResponseType } from '../http';
import { LegacyQuery } from './legacy-query';

export type LegacyArgumentsOfQueryArgs<T extends QueryArgs> = Omit<T, 'response' | 'headers'> & WithHeaders;
export type QueryArgsOfLegacyArguments<T extends BaseArguments | undefined, J> = Omit<T, 'mock' | 'headers'> & {
  headers?: HttpHeaders;
  response?: J;
};

export type CreateLegacyQueryCreatorOptions<TArgs extends QueryArgs> = {
  creator: QueryCreator<TArgs>;
};

// TODO: Copy QueryPrepareFn type and add the injector to the args
// TODO: Add config option to the prepare function to destroy the query when it either succeeds or fails

// TODO: Migrate to the new query creator
// TODO: Create legacy query creator that uses the new query creator
// TODO: In every component replace the new query creator with the legacy query creator
// TODO: Inject the injector in every component that uses the legacy query creator
// TODO: In every query add the injector to the prepare function args
// TODO: If the created query is not pushed into a signal or subject set the self destroy on response prepare arg to true

// TODO: Test with infinity query
// TODO: Test with GQL. variables are currently not used

/**
 * Creates a legacy query creator.
 * @deprecated This is a temporary solution to support legacy queries. It will be removed in the future.
 */
export const createLegacyQueryCreator = <TArgs extends QueryArgs>(options: CreateLegacyQueryCreatorOptions<TArgs>) => {
  type LegacyArgs = LegacyArgumentsOfQueryArgs<TArgs>;
  type Response = ResponseType<TArgs>;
  type Route = RouteType<LegacyArgs>;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const prepare: QueryPrepareFn<LegacyArgs, Response, Route, EntityStore<Response>, Response, string> = (
    args?: LegacyArgs & WithHeaders & WithConfig & WithMock<Response> & WithInjector,
  ) => {
    const injector = args?.injector ?? inject(Injector);

    let headers = new HttpHeaders();

    if (args?.headers) {
      Object.entries(args.headers).forEach(([key, value]) => {
        if (value) {
          headers = headers.set(key, value);
        }
      });
    }

    const queryArgs = {
      ...(args?.body ? { body: args.body } : {}),
      ...(args?.pathParams ? { pathParams: args.pathParams } : {}),
      ...(args?.queryParams ? { queryParams: args.queryParams } : {}),
      headers,
    } as RequestArgs<TArgs>;

    return runInInjectionContext(injector, () => {
      const newQuery = options.creator({
        onlyManualExecution: true,
        injector,
        silenceMissingWithArgsFeatureError: true,
      });

      const legacyQuery = new LegacyQuery<
        Response,
        LegacyArgs,
        Route,
        EntityStore<Response>,
        Response,
        string,
        Query<TArgs>
      >(newQuery, queryArgs);

      return legacyQuery;
    });
  };
  const createSubject = (initialValue?: ReturnType<typeof prepare> | null, config?: QueryContainerConfig) => {
    const subject = new BehaviorSubject<ReturnType<typeof prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(subject, () => subject.getValue(), config);

    return subject;
  };
  const createSignal = (initialValue?: ReturnType<typeof prepare> | null, config?: QueryContainerConfig) => {
    const _signal = signal<ReturnType<typeof prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(toObservable(_signal), () => _signal(), config);

    return _signal;
  };

  const legacyCreator = {
    prepare,
    createSubject,
    createSignal,
    /** @deprecated Use `myQuery.createSubject()` or `myQuery.createSignal()` instead. Will be removed in v6. */
    behaviorSubject: createSubject,
  };

  return legacyCreator;
};
