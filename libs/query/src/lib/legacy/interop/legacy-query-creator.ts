import { HttpHeaders } from '@angular/common/http';
import {
  DestroyRef,
  effect,
  inject,
  Injector,
  isDevMode,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject } from 'rxjs';
import {
  AnyNewQuery,
  legacyPrepareWithoutInjectionContext,
  Query,
  QueryArgs,
  QueryCreator,
  RequestArgs,
  ResponseType,
} from '../../http';
import { EntityStore } from '../entity';
import { BaseArguments, QueryEntityConfig, V2QueryConfig, V2RouteType, WithHeaders, WithInjector } from '../query';
import { addQueryContainerHandling, QueryContainerConfig } from '../utils';
import { createInertQuery } from './inert-query';
import { LegacyQuery } from './legacy-query';

/**
 * Whether an injector can still be used. A destroyed `R3Injector` throws on `get()` rather than
 * answering, so the throw itself is the answer; a node injector hands back a `DestroyRef` that
 * reports its own state.
 */
const isInjectorUsable = (injector: Injector) => {
  try {
    return injector.get(DestroyRef, null, { optional: true })?.destroyed !== true;
  } catch {
    return false;
  }
};

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

  /**
   * The name this creator is exported under, used to name it in error messages. Emitted by the
   * `migrate-to-query-v3` generator; worth passing by hand too, since without it a `prepare()`
   * called outside an injection context can only be located by bisection.
   */
  name?: string;
};

export type WithLegacyConfig = {
  /**
   * Additional configuration for this query.
   */
  config?: V2QueryConfig & {
    /**
     * If set to true, the query will be destroyed when it either succeeds or fails.
     */
    destroyOnResponse?: boolean;
  };
};

export type LegacyQueryPrepareFn<
  Arguments extends BaseArguments | undefined,
  Response,
  Route extends V2RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
  TNewQuery extends AnyNewQuery,
> = (
  args: Arguments & WithHeaders & WithLegacyConfig & WithInjector,
) => LegacyQuery<Response, Arguments, Route, Store, Data, Id, TNewQuery>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQueryCreator = LegacyQueryCreator<any, any, any, any, any>;

export class LegacyQueryCreator<
  TArgs extends QueryArgs,
  Response extends ResponseType<TArgs>,
  Store extends EntityStore<unknown>,
  Id,
  Data = Response,
> {
  constructor(public options: CreateLegacyQueryCreatorOptions<TArgs, Response, Store, Data, Id>) {}

  prepare: LegacyQueryPrepareFn<
    LegacyArgumentsOfQueryArgs<TArgs>,
    Response,
    V2RouteType<LegacyArgumentsOfQueryArgs<TArgs>>,
    Store,
    Data,
    Id,
    Query<TArgs>
  > = (args: LegacyArgumentsOfQueryArgs<TArgs> & WithHeaders & WithLegacyConfig & WithInjector) => {
    // v2's `prepare()` needed no injection context, so plenty of call sites are plain callbacks.
    // Angular's raw NG0203 names neither the query nor the call site, which makes those a bisection
    // exercise - replace it with an error that does.
    const injector =
      args?.injector ??
      (() => {
        try {
          return inject(Injector);
        } catch {
          throw legacyPrepareWithoutInjectionContext(this.options.name);
        }
      })();

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

    // A captured component injector routinely outlives its component here: a debounced search
    // resolving after navigation, an RxJS callback on a stream torn down a tick later. That is not
    // a programming error the way it would be in new code - v2 had no injector to destroy - so it
    // yields a query that does nothing instead of an NG0205 raised from the view's cleanup phase.
    if (!isInjectorUsable(injector)) {
      if (isDevMode()) {
        console.warn(
          `${this.options.name ? `"${this.options.name}"` : 'A legacy query'}.prepare() was called with a destroyed injector, so an inert query was returned. ` +
            `This usually means a callback outlived the component whose injector it captured - guard the call site with DestroyRef.onDestroy, or pass an injector that outlives it.`,
        );
      }

      return new LegacyQuery<
        Response,
        LegacyArgumentsOfQueryArgs<TArgs>,
        V2RouteType<LegacyArgumentsOfQueryArgs<TArgs>>,
        Store,
        Data,
        Id,
        Query<TArgs>
      >(createInertQuery<TArgs>(), queryArgs, this.options.entity, true);
    }

    return runInInjectionContext(injector, () => {
      return untracked(() => {
        const newQuery = this.options.creator({
          onlyManualExecution: true,
          injector,
          silenceMissingWithArgsFeatureError: true,
          // `LegacyQuery.execute()` forwards v2's `skipCache` as `allowCache` for every method, cacheable or not.
          silenceUncacheableAllowCacheError: true,
        });

        const legacyQuery = new LegacyQuery<
          Response,
          LegacyArgumentsOfQueryArgs<TArgs>,
          V2RouteType<LegacyArgumentsOfQueryArgs<TArgs>>,
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

/**
 * Creates a legacy query creator.
 *
 * **NOTE**: This is a temporary solution to support legacy queries. It will be removed in the future.
 *
 * **DO NOT TURN NEW QUERY CREATORS INTO LEGACY ONES MANUALLY. THIS IS ONLY NEEDED FOR MIGRATION PURPOSES.**
 */
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
