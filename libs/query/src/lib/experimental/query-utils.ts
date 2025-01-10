import { HttpErrorResponse, HttpHeaders, HttpStatusCode } from '@angular/common/http';
import { computed, CreateEffectOptions, effect, isDevMode, Signal } from '@angular/core';
import { getActiveConsumer, setActiveConsumer } from '@angular/core/primitives/signals';
import { isSymfonyPagerfantaOutOfRangeError } from '../symfony';
import { CreateQueryOptions, Query, QueryArgs, QuerySnapshot } from './query';
import { QueryMethod } from './query-creator';
import { queryFeatureUsedMultipleTimes, withArgsQueryFeatureMissingButRouteIsFunction } from './query-errors';
import { QueryExecute } from './query-execute';
import { QueryFeatureContext, QueryFeatureType } from './query-features';
import { QueryKeyOrNone } from './query-repository';
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
  const normalizedOptions = options instanceof HttpErrorResponse ? { retryCount: 0, error: options } : options;
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
};

export const getQueryFeatureUsage = <TArgs extends QueryArgs>(options: CreateQueryOptions<TArgs>) => {
  const { creator, creatorInternals, features, queryConfig } = options;

  const hasWithArgsFeature = features.some((f) => f.type == QueryFeatureType.WithArgs);
  const shouldAutoExecuteMethod = shouldAutoExecuteQuery(creatorInternals.method);
  const shouldAutoExecute = shouldAutoExecuteMethod && !queryConfig.onlyManualExecution;
  const hasRouteFunction = typeof creator.route === 'function';

  if (hasRouteFunction && !hasWithArgsFeature) {
    throw withArgsQueryFeatureMissingButRouteIsFunction();
  }

  const featureFnContext: QueryFeatureFlags = {
    hasWithArgsFeature,
    shouldAutoExecuteMethod,
    shouldAutoExecute,
    hasRouteFunction,
  };

  return featureFnContext;
};

export const applyQueryFeatures = <TArgs extends QueryArgs>(
  options: CreateQueryOptions<TArgs>,
  context: QueryFeatureContext<TArgs>,
) => {
  const featureTypes = new Set<QueryFeatureType>();

  for (const feature of options.features) {
    if (featureTypes.has(feature.type)) {
      throw queryFeatureUsedMultipleTimes(feature.type);
    }

    featureTypes.add(feature.type);
    feature.fn(context);
  }
};

export const maybeExecute = <TArgs extends QueryArgs>(options: {
  flags: QueryFeatureFlags;
  execute: QueryExecute<TArgs>;
}) => {
  if (options.flags.shouldAutoExecute && !options.flags.hasRouteFunction && !options.flags.hasWithArgsFeature) {
    options.execute();
  }
};

export type CreateQueryObjectOptions<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  execute: QueryExecute<TArgs>;
  createSnapshot: () => QuerySnapshot<TArgs>;
  destroy: () => void;
};

export const createQueryObject = <TArgs extends QueryArgs>(options: CreateQueryObjectOptions<TArgs>) => {
  const { state, execute, createSnapshot, destroy } = options;

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
    internals: {
      destroy,
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
