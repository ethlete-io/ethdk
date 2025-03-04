import { HttpErrorResponse, HttpHeaders, HttpStatusCode } from '@angular/common/http';
import { computed, CreateEffectOptions, effect, isDevMode, Signal } from '@angular/core';
import { getActiveConsumer, setActiveConsumer } from '@angular/core/primitives/signals';
import { isSymfonyPagerfantaOutOfRangeError } from '../../symfony';
import { CreateGqlQueryOptions, isCreateGqlQueryOptions } from '../gql/gql-query';
import { CreateGqlQueryCreatorOptions, GqlQueryMethod } from '../gql/gql-query-creator';
import { CreateQueryOptions, Query, QueryArgs, ReadonlyQuery, RequestArgs, ResponseType } from './query';
import { InternalCreateQueryCreatorOptions, QueryMethod } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import {
  queryFeatureUsedMultipleTimes,
  silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent,
  withArgsQueryFeatureMissingButRouteIsFunction,
} from './query-errors';
import { InternalQueryExecute } from './query-execute';
import { QueryFeature, QueryFeatureContext, QueryFeatureType } from './query-features';
import { QueryKeyOrNone } from './query-repository';
import { createQuerySnapshotFn } from './query-snapshot';
import { QueryState } from './query-state';

/**
 * Returning this inside a withArgs feature will reset the query args to null.
 * This will also pause polling and auto refresh until new args are set.
 */
export const CLEAR_QUERY_ARGS = Symbol('CLEAR_QUERY_ARGS');
export type ClearQueryArgs = typeof CLEAR_QUERY_ARGS;

export const QUERY_EFFECT_ERROR_MESSAGE =
  'Effect triggered too often. This is probably due to a circular dependency inside the query.';

/** A angular effect that will throw an error in dev mode if it is called too often. This indicates a circular dependency inside the effect. */
export const queryEffect = (fn: (isFirstRun: boolean) => void, errorMessage: string, options?: CreateEffectOptions) => {
  let lastTriggerTs = 0;
  let illegalWrites = 0;

  let isFirstRun = true;

  const activeConsumer = getActiveConsumer();

  setActiveConsumer(null);

  const eff = effect(() => {
    if (isDevMode()) {
      const now = performance.now();

      if (now - lastTriggerTs < 100) {
        illegalWrites++;

        if (illegalWrites > 5) {
          throw new Error(errorMessage);
        }
      }

      lastTriggerTs = now;
    }

    fn(isFirstRun);

    if (isFirstRun) {
      isFirstRun = false;
    }
  }, options);

  setActiveConsumer(activeConsumer);

  return eff;
};

export const shouldAutoExecuteQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};

export const shouldAutoExecuteGqlQuery = (method: GqlQueryMethod) => {
  return method === 'QUERY';
};

export const extractExpiresInSeconds = (headers: HttpHeaders) => {
  const cacheControl = headers.get('cache-control');
  const age = headers.get('age');
  const expires = headers.get('expires');

  // In seconds
  let expiresIn: number | null = null;
  let maxAge: number | null = null;

  if (cacheControl?.includes('no-cache')) {
    return null;
  }

  if (cacheControl?.includes('max-age')) {
    const m = cacheControl.split('max-age=')[1];

    if (m) {
      maxAge = parseInt(m);
    }
  } else if (cacheControl?.includes('s-maxage')) {
    const m = cacheControl.split('s-maxage=')[1];

    if (m) {
      maxAge = parseInt(m);
    }
  }

  if (maxAge && age) {
    const ageSeconds = parseInt(age);

    expiresIn = maxAge - ageSeconds;
  } else if (maxAge) {
    expiresIn = maxAge / 2; // We assume the response is half way to its expiration
  } else if (expires) {
    // Used by some apis to tell the response will never expire
    // In this case we let the response expire after 1 hour
    if (expires === '-1') {
      expiresIn = 3600;
    } else {
      const expiresDate = new Date(expires);

      // check if the date is valid
      if (expiresDate.toString() !== 'Invalid Date') {
        expiresIn = Math.floor((expiresDate.getTime() - Date.now()) / 1000);
      }
    }
  }

  return expiresIn;
};

export type ShouldRetryRequestOptions = {
  retryCount: number;
  error: HttpErrorResponse;
};

export type ShouldRetryRequestResult =
  | {
      retry: false;
    }
  | {
      retry: true;
      delay: number;
    };

export type ShouldRetryRequestFn = (options: ShouldRetryRequestOptions) => ShouldRetryRequestResult;

export const shouldRetryRequest = (
  options: ShouldRetryRequestOptions | HttpErrorResponse,
): ShouldRetryRequestResult => {
  const normalizedOptions =
    options instanceof HttpErrorResponse ? { retryCount: 0, error: options } : (options as ShouldRetryRequestOptions);
  const { retryCount, error } = normalizedOptions;
  const defaultRetryDelay = 1000 + 1000 * retryCount;

  if (retryCount > 3) {
    return { retry: false };
  }

  if (!(error instanceof HttpErrorResponse)) {
    return { retry: false };
  }

  const { status, error: detail, headers } = error;

  // Retry on 5xx errors (except 500 internal server error since those are usually not recoverable)
  if (status >= 501) {
    // Don't retry if a requested page is out of range
    if (isSymfonyPagerfantaOutOfRangeError(detail)) {
      return { retry: false };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 408 or 425 errors
  if (status === HttpStatusCode.RequestTimeout || status === HttpStatusCode.TooEarly) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 429 errors
  if (status === HttpStatusCode.TooManyRequests) {
    const retryAfter = headers.get('retry-after') || headers.get('x-retry-after');

    if (retryAfter) {
      const delay = parseInt(retryAfter) * 1000;
      return { retry: true, delay: Number.isNaN(delay) ? defaultRetryDelay : delay };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  // Code 0 usually means the internet connection is down. We retry in this case.
  // It could also be a CORS issue but that should not be the case in production.
  if (status === 0) {
    return { retry: true, delay: defaultRetryDelay };
  }

  return { retry: false };
};

export type QueryFeatureFlags = {
  hasWithArgsFeature: boolean;
  shouldAutoExecuteMethod: boolean;
  shouldAutoExecute: boolean;
  hasRouteFunction: boolean;
  onlyManualExecution?: boolean;

  /** Human readable method name */
  method: string;
};

export const getQueryFeatureUsage = <TArgs extends QueryArgs>(
  options: CreateQueryOptions<TArgs> | CreateGqlQueryOptions<TArgs>,
) => {
  const { creator, features, queryConfig, creatorInternals } = options;

  const hasWithArgsFeature = features.some((f) => f.type == QueryFeatureType.WithArgs);
  const shouldAutoExecuteMethod = isCreateGqlQueryOptions(options)
    ? shouldAutoExecuteGqlQuery(options.creatorInternals.method)
    : shouldAutoExecuteQuery(options.creatorInternals.method);
  const hasRouteFunction =
    typeof (creatorInternals as InternalCreateQueryCreatorOptions<TArgs>)?.route === 'function' ||
    typeof (creator as CreateGqlQueryCreatorOptions<TArgs>)?.route === 'function';
  const shouldAutoExecute = shouldAutoExecuteMethod && !queryConfig.onlyManualExecution;

  if (hasRouteFunction && !hasWithArgsFeature && !queryConfig.silenceMissingWithArgsFeatureError) {
    throw withArgsQueryFeatureMissingButRouteIsFunction();
  }

  if (hasWithArgsFeature && queryConfig.silenceMissingWithArgsFeatureError) {
    throw silenceMissingWithArgsFeatureErrorUsedButWithArgsPresent();
  }

  const featureFnContext: QueryFeatureFlags = {
    hasWithArgsFeature,
    shouldAutoExecuteMethod,
    shouldAutoExecute,
    hasRouteFunction,
    onlyManualExecution: queryConfig.onlyManualExecution,
    method: isCreateGqlQueryOptions(options)
      ? `GQL ${options.creatorInternals.method}`
      : options.creatorInternals.method,
  };

  return featureFnContext;
};

export const applyQueryFeatures = <TArgs extends QueryArgs>(
  features: QueryFeature<TArgs>[],
  context: QueryFeatureContext<TArgs>,
) => {
  const featureTypes = new Set<QueryFeatureType>();

  for (const feature of features) {
    if (featureTypes.has(feature.type)) {
      throw queryFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    feature.fn(context);
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const maybeExecute = (options: { flags: QueryFeatureFlags; execute: InternalQueryExecute<any> }) => {
  if (options.flags.shouldAutoExecute && !options.flags.hasRouteFunction && !options.flags.hasWithArgsFeature) {
    options.execute();
  }
};

export type CreateQueryObjectOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  deps: QueryDependencies;
  execute: InternalQueryExecute<TArgs>;
};

export const createQueryObject = <TArgs extends QueryArgs>(options: CreateQueryObjectOptions<TArgs>) => {
  const { state, execute, deps } = options;

  const destroy = () => deps.injector.destroy();
  const setResponse = (response: ResponseType<TArgs>) => state.response.set(response);
  const createSnapshot = createQuerySnapshotFn({ state, deps, execute });

  const asReadonly = () => {
    const roQuery: ReadonlyQuery<TArgs> = {
      args: state.args.asReadonly(),
      response: state.response.asReadonly(),
      latestHttpEvent: state.latestHttpEvent.asReadonly(),
      loading: state.loading.asReadonly(),
      error: state.error.asReadonly(),
      lastTimeExecutedAt: state.lastTimeExecutedAt.asReadonly(),
      id: normalizeQueryRepositoryKey(execute.currentRepositoryKey),
      createSnapshot,
    };

    return roQuery;
  };

  const query: Query<TArgs> = {
    execute,
    args: state.args.asReadonly(),
    response: state.response.asReadonly(),
    latestHttpEvent: state.latestHttpEvent.asReadonly(),
    loading: state.loading.asReadonly(),
    error: state.error.asReadonly(),
    lastTimeExecutedAt: state.lastTimeExecutedAt.asReadonly(),
    id: normalizeQueryRepositoryKey(execute.currentRepositoryKey),
    createSnapshot,
    reset: execute.reset,
    asReadonly,
    subtle: {
      destroy,
      setResponse,
    },
  };

  return query;
};

export const normalizeQueryRepositoryKey = (key: Signal<QueryKeyOrNone>) =>
  computed(() => {
    const k = key();

    if (k === false) {
      // false means the query cannot be cached and thus it is not stored in the repository
      // We generate a random id in this case to avoid confusion
      return crypto.randomUUID();
    }

    return k;
  });

export const shouldCacheQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'OPTIONS' || method === 'HEAD';
};

export const buildQueryCacheKey = (route: string, args: RequestArgs<QueryArgs> | undefined) => {
  // We need to hash the body in case it's a gql query and the query get's transported in the body
  const body = JSON.stringify(args?.body || {})
    // replace all curly braces with empty string
    .replace(/{|}/g, '')
    // replace new lines and whitespaces with empty string
    .replace(/\s/g, '');

  const seed = `${route}_${body}`;

  let hash = 0;

  for (const char of seed) {
    hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
  }

  // Force positive number hash.
  // 2147483647 = equivalent of Integer.MAX_VALUE.
  hash += 2147483647 + 1;

  return hash.toString();
};
