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
  AnyQueryCreator,
  CreateQueryCreatorOptions,
  legacyPrepareWithoutInjectionContext,
  Query,
  QueryArgs,
  QueryCreator,
  QueryMethod,
  RequestArgs,
  ResponseType,
  shouldCacheQuery,
} from '../../http';
import { EntityStore } from '../entity';
import { BaseArguments, QueryEntityConfig, V2QueryConfig, V2RouteType, WithHeaders, WithInjector } from '../query';
import { addQueryContainerHandling, QueryContainerConfig } from '../utils';
import { createInertQuery } from './inert-query';
import { legacyPrepareFallbackInjector } from './legacy-prepare-fallback';
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

/**
 * Angular's NG0203, thrown by `inject()` outside an injection context. Matched on the code rather than
 * the message: production builds strip the message, and NG0205 ("Injector has already been destroyed")
 * comes out of the same `inject()` call for a different reason entirely.
 */
const isMissingInjectionContextError = (error: unknown) =>
  typeof error === 'object' && error !== null && Math.abs(Number((error as { code?: unknown }).code)) === 203;

/**
 * What the creator was built with, for diagnostics - `GET /person`. Lets an unnamed wrapper still point
 * at an endpoint instead of "a legacy query creator". A route function cannot be described this way, but
 * those wrappers come from the generator, which always emits a `name`.
 */
const describeCreator = (creator: AnyQueryCreator) => {
  const { method, route } = creator.subtle.creatorInternals;

  if (typeof route !== 'string') return undefined;

  return typeof method === 'string' ? `${method} ${route}` : route;
};

/**
 * Mirrors the cacheability decision the query repository makes per request: cacheable HTTP methods and
 * GraphQL queries, unless the creator opted in or out explicitly. The legacy container helpers branch on
 * `canBeCached` for their default cleanup, so a wrapper has to answer before the first execution.
 */
const canCreatorBeCached = (creator: AnyQueryCreator) => {
  const { method } = creator.subtle.creatorInternals;
  const explicit = (creator.subtle.creatorOptions as CreateQueryCreatorOptions | undefined)?.subtle
    ?.useQueryRepositoryCache;

  if (explicit !== undefined) return explicit;
  if (method === 'QUERY') return true;
  if (method === 'MUTATE') return false;

  return typeof method === 'string' && shouldCacheQuery(method as QueryMethod);
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type LegacyArgumentsOfQueryArgs<T extends QueryArgs> = Omit<T, 'response' | 'headers'> & WithHeaders;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryArgsOfLegacyArguments<T extends BaseArguments | undefined, J> = Omit<T, 'mock' | 'headers'> & {
  headers?: HttpHeaders;
  response?: J;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQueryCreator = LegacyQueryCreator<any, any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export class LegacyQueryCreator<
  TArgs extends QueryArgs,
  Response extends ResponseType<TArgs>,
  Store extends EntityStore<unknown>,
  Id,
  Data = Response,
> {
  prepare: LegacyQueryPrepareFn<
    LegacyArgumentsOfQueryArgs<TArgs>,
    Response,
    V2RouteType<LegacyArgumentsOfQueryArgs<TArgs>>,
    Store,
    Data,
    Id,
    Query<TArgs>
  > = (args: LegacyArgumentsOfQueryArgs<TArgs> & WithHeaders & WithLegacyConfig & WithInjector) => {
    const injector = args?.injector ?? this.resolveAmbientInjector('prepare');

    let headers = new HttpHeaders();

    if (args?.headers) {
      for (const [key, value] of Object.entries<string | undefined>(args.headers)) {
        // Only an absent value is skipped - an empty string is a header the caller asked to send.
        if (value === undefined || value === null) continue;

        headers = headers.set(key, value);
      }
    }

    const queryArgs = {
      // Presence, not truthiness: `0`, `''` and `false` are bodies, and dropping them silently sends a
      // different request than the call site asked for.
      ...(args?.body !== undefined ? { body: args.body } : {}),
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
          `${this.label ? `"${this.label}"` : 'A legacy query'}.prepare() was called with a destroyed injector, so an inert query was returned. ` +
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
      >(createInertQuery<TArgs>(), queryArgs, this.options.entity, true, this.canBeCached);
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
        >(newQuery, queryArgs, this.options.entity, false, this.canBeCached);

        if (args?.config?.destroyOnResponse) {
          // Owned by the query's own injector, not the caller's. Call sites are told to pass an injector
          // that outlives them, so they hand over a root or environment one - and an effect that only
          // tears itself down on a terminal state then outlives an aborted or never-executed query for
          // the lifetime of the app. Tied to the query, it dies with the thing it exists to destroy.
          effect(
            () => {
              const type = newQuery.executionState()?.type;

              if (type === 'success' || type === 'failure') {
                legacyQuery.destroy();
              }
            },
            { injector: newQuery.subtle.injector },
          );
        }

        return legacyQuery;
      });
    });
  };
  createSubject = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    const injector = config?.injector ?? this.resolveAmbientInjector('createSubject');
    const subject = new BehaviorSubject<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(subject, () => subject.getValue(), { ...config, injector });

    return subject;
  };
  createSignal = (initialValue?: ReturnType<typeof this.prepare> | null, config?: QueryContainerConfig) => {
    const injector = config?.injector ?? this.resolveAmbientInjector('createSignal');
    const _signal = signal<ReturnType<typeof this.prepare> | null>(initialValue ?? null);

    addQueryContainerHandling(toObservable(_signal, { injector }), () => _signal(), { ...config, injector });

    return _signal;
  };

  behaviorSubject = this.createSubject;
  constructor(public options: CreateLegacyQueryCreatorOptions<TArgs, Response, Store, Data, Id>) {}

  /**
   * Whether the underlying request is cacheable, which is what the legacy container helpers use to decide
   * their default cleanup. Resolved from the creator, so it answers before the first execution.
   */
  get canBeCached() {
    return canCreatorBeCached(this.options.creator);
  }

  private get label() {
    return this.options.name ?? describeCreator(this.options.creator);
  }

  /**
   * v2 needed no injection context, so plenty of call sites are plain callbacks. Angular's raw NG0203
   * names neither the query nor the call site, which makes those a bisection exercise - replace it with
   * an error that does, and let every other DI failure (NG0205 from an injector mid-teardown, a missing
   * provider) through untouched.
   */
  private resolveAmbientInjector(method: 'prepare' | 'createSubject' | 'createSignal') {
    try {
      return inject(Injector);
    } catch (error) {
      if (!isMissingInjectionContextError(error)) {
        throw error;
      }

      const fallback = legacyPrepareFallbackInjector();

      // A stale stash (the app injector is gone) is no injector at all - handing it over would build a
      // query that silently never runs.
      if (fallback && isInjectorUsable(fallback)) {
        return fallback;
      }

      throw legacyPrepareWithoutInjectionContext(this.label, method);
    }
  }
}

/**
 * Creates a legacy query creator.
 *
 * **NOTE**: This is a temporary solution to support legacy queries. It will be removed in the future.
 *
 * **DO NOT TURN NEW QUERY CREATORS INTO LEGACY ONES MANUALLY. THIS IS ONLY NEEDED FOR MIGRATION PURPOSES.**
 *
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
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
