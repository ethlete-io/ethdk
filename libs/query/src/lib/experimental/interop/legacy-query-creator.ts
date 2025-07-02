import { HttpHeaders } from '@angular/common/http';
import { effect, inject, Injector, runInInjectionContext, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import { EntityStore } from '../../entity';
import {
  BaseArguments,
  EmptyObject,
  QueryConfig,
  QueryEntityConfig,
  RouteType,
  WithHeaders,
  WithInjector,
} from '../../query';
import { addQueryContainerHandling, QueryContainerConfig } from '../../utils';
import { AnyNewQuery, Query, QueryArgs, QueryCreator, RequestArgs, ResponseType } from '../http';
import { LegacyQuery } from './legacy-query';

export type LegacyArgumentsOfQueryArgs<T extends QueryArgs> = Omit<T, 'response' | 'headers'> & WithHeaders;
export type QueryArgsOfLegacyArguments<T extends BaseArguments | undefined, J> = Omit<T, 'mock' | 'headers'> & {
  headers?: HttpHeaders;
  response?: J;
};

export type CreateLegacyQueryCreatorOptions<
  TArgs extends QueryArgs,
  Response,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> = {
  creator: QueryCreator<TArgs>;

  /**
   * Object containing the query's entity store information.
   */
  entity?: QueryEntityConfig<Store, Data, Response, LegacyArgumentsOfQueryArgs<TArgs>, Id>;
};

export interface WithLegacyConfig {
  /**
   * Additional configuration for this query.
   */
  config?: QueryConfig & {
    /**
     * If set to true, the query will be destroyed when it either succeeds or fails.
     */
    destroyOnResponse?: boolean;
  };
}

export type LegacyQueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
  TNewQuery extends AnyNewQuery,
> = Arguments extends BaseArguments
  ? (
      args: Arguments & WithHeaders & WithLegacyConfig & WithInjector,
    ) => LegacyQuery<Response, Arguments, Route, Store, Data, Id, TNewQuery>
  : (
      args?: (Arguments extends EmptyObject ? Arguments : EmptyObject) & WithHeaders & WithLegacyConfig & WithInjector,
    ) => LegacyQuery<Response, Arguments, Route, Store, Data, Id, TNewQuery>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQueryCreator = LegacyQueryCreator<any, any, any, any, any>;

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
export class LegacyQueryCreator<
  TArgs extends QueryArgs,
  Response extends ResponseType<TArgs>,
  Store extends EntityStore<unknown>,
  Id,
  Data = Response,
> {
  constructor(public options: CreateLegacyQueryCreatorOptions<TArgs, Response, Store, Data, Id>) {}

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  prepare: LegacyQueryPrepareFn<LegacyArgs, Response, Route, Store, Data, Id, Query<TArgs>> = (
    args?: LegacyArgumentsOfQueryArgs<TArgs> & WithHeaders & WithLegacyConfig & WithInjector,
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
      return untracked(() => {
        const newQuery = this.options.creator({
          onlyManualExecution: true,
          injector,
          silenceMissingWithArgsFeatureError: true,
        });

        const legacyQuery = new LegacyQuery<
          Response,
          LegacyArgumentsOfQueryArgs<TArgs>,
          RouteType<LegacyArgumentsOfQueryArgs<TArgs>>,
          Store,
          Data,
          Id,
          Query<TArgs>
        >(newQuery, queryArgs, this.options.entity);

        if (args?.config?.destroyOnResponse) {
          const destroyEffect = effect(() => {
            if (newQuery.executionState()?.type === 'success' || newQuery.executionState()?.type === 'failure') {
              legacyQuery.destroy();
              destroyEffect.destroy();
            }
          });
        }

        return legacyQuery;
      });
    });
  };
  createSubject = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    const subject = new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(subject, () => subject.getValue(), config);

    return subject;
  };
  createSignal = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    const _signal = signal<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(toObservable(_signal), () => _signal(), config);

    return _signal;
  };

  behaviorSubject = this.createSubject;
}

export const createLegacyQueryCreator = <
  TArgs extends QueryArgs,
  Response extends ResponseType<TArgs>,
  Store extends EntityStore<unknown>,
  Id,
  Data = Response,
>(
  options: CreateLegacyQueryCreatorOptions<TArgs, Response, Store, Data, Id>,
): LegacyQueryCreator<TArgs, Response, Store, Id, Data> => {
  return new LegacyQueryCreator<TArgs, Response, Store, Id, Data>(options);
};
