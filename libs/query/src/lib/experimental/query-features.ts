import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { computed, Signal, untracked } from '@angular/core';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import {
  withAutoRefreshUsedInManualQuery,
  withAutoRefreshUsedOnUnsupportedHttpMethod,
  withPollingUsedOnUnsupportedHttpMethod,
} from './query-errors';
import { QueryExecute } from './query-execute';
import { QueryState } from './query-state';
import {
  CLEAR_QUERY_ARGS,
  ClearQueryArgs,
  QUERY_EFFECT_ERROR_MESSAGE,
  queryEffect,
  QueryFeatureFlags,
} from './query-utils';

export const enum QueryFeatureType {
  WithArgs = 'withArgs',
  WithLogging = 'withLogging',
  WithErrorHandling = 'withErrorHandling',
  WithSuccessHandling = 'withSuccessHandling',
  WithPolling = 'withPolling',
  WithAutoRefresh = 'withAutoRefresh',
}

export type QueryFeatureContext<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  queryConfig: QueryConfig;
  creatorConfig: CreateQueryCreatorOptions<TArgs>;
  creatorInternals: InternalCreateQueryCreatorOptions;
  execute: QueryExecute<TArgs>;
  deps: QueryDependencies;
  flags: QueryFeatureFlags;
};

export type QueryFeatureFn<TArgs extends QueryArgs> = (context: QueryFeatureContext<TArgs>) => void;

export type QueryFeature<TArgs extends QueryArgs> = {
  type: QueryFeatureType;
  fn: (context: QueryFeatureContext<TArgs>) => void;
};

const createQueryFeature = <TArgs extends QueryArgs>(config: { type: QueryFeatureType; fn: QueryFeatureFn<TArgs> }) => {
  return config as QueryFeature<TArgs>;
};

/**
 * A query feature that allows you to set the arguments of the query.
 * The arguments are read within a computed function, so you can use reactive values.
 *
 * To set the arguments to `null`, return the symbol `CLEAR_QUERY_ARGS`.
 * If you instead return `null`, the arguments won't change.
 *
 * Changing arguments will automatically trigger a new execution of the query if it is eligible for auto execution (e.g. a GET request).
 */
export const withArgs = <TArgs extends QueryArgs>(args: () => NoInfer<RequestArgs<TArgs>> | ClearQueryArgs | null) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithArgs,
    fn: (context) => {
      const currArgs = computed(() => args());

      queryEffect(
        () => {
          const currArgsNow = currArgs();

          if (currArgsNow === null) return;

          untracked(() => {
            if (currArgsNow === CLEAR_QUERY_ARGS) {
              context.state.args.set(null);
              return;
            }

            context.state.args.set(currArgsNow);

            if (context.flags.shouldAutoExecute) context.execute({ args: currArgsNow });
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithPollingFeatureOptions = {
  /** The interval in milliseconds at which the query should be executed */
  interval: number;

  /**
   * Whether the query should be executed initially.
   * By default, the query will be executed after the first interval.
   * @default false
   */
  executeInitially?: boolean;
};

/**
 * A query feature that will automatically execute the query at a given interval.
 * The interval will be cleared when the query is destroyed.
 * The interval will be reset when the arguments of the query change.
 *
 * @throws If the query is not eligible for auto execution (e.g. a POST request)
 */
export const withPolling = <TArgs extends QueryArgs>(options: WithPollingFeatureOptions) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithPolling,
    fn: (context) => {
      if (!context.flags.shouldAutoExecuteMethod) {
        throw withPollingUsedOnUnsupportedHttpMethod(context.creatorInternals.method);
      }

      let intervalId: number | null = null;

      queryEffect(
        () => {
          const args = context.state.args();

          untracked(() => {
            if (intervalId !== null) clearInterval(intervalId);

            // Don't start polling if the query doesn't have args.
            // It should have args because a withArgs feature is present.
            if (args === null && context.flags.hasWithArgsFeature) return;

            if (options.executeInitially) {
              context.execute({ args });
            }

            intervalId = window.setInterval(() => {
              context.execute({ args });
            }, options.interval);
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );

      context.deps.destroyRef.onDestroy(() => intervalId !== null && clearInterval(intervalId));
    },
  });
};

export type WithLoggingFeatureOptions<TArgs extends QueryArgs> = {
  /** A function that will be called with the latest http event */
  logFn: (v: HttpEvent<ResponseType<TArgs>> | null) => void;
};

/** A query feature that can be used to log the latest http event */
export const withLogging = <TArgs extends QueryArgs>(options: WithLoggingFeatureOptions<TArgs>) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithLogging,
    fn: (context) => {
      queryEffect(
        () => {
          const event = context.state.latestHttpEvent();

          if (event === null) return;

          untracked(() => {
            options.logFn(event);
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithErrorHandlingFeatureOptions = {
  /** A function that will be called with the latest error */
  handler: (e: HttpErrorResponse) => void;
};

/** A query feature that can be used to handle errors */
export const withErrorHandling = <TArgs extends QueryArgs>(options: WithErrorHandlingFeatureOptions) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithErrorHandling,
    fn: (context) => {
      queryEffect(
        () => {
          const error = context.state.error();

          if (error === null) return;

          untracked(() => {
            options.handler(error);
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );
    },
  });
};

type WithSuccessHandlingFeatureOptions<TArgs extends QueryArgs> = {
  /** A function that will be called with the latest response */
  handler: (data: NonNullable<ResponseType<TArgs>>) => void;
};

/** A query feature that can be used to handle successful responses */
export const withSuccessHandling = <TArgs extends QueryArgs>(options: WithSuccessHandlingFeatureOptions<TArgs>) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithSuccessHandling,
    fn: (context) => {
      queryEffect(
        () => {
          const response = context.state.response();

          if (response === null) return;

          untracked(() => {
            options.handler(response as NonNullable<ResponseType<TArgs>>);
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithAutoRefreshFeatureOptions = {
  /** The signals that should trigger a refresh of the query */
  onSignalChanges: Signal<unknown>[];

  /** Whether to ignore the `onlyManualExecution` query config flag */
  ignoreOnlyManualExecution?: boolean;
};

/**
 * A query feature that will automatically execute the query when any of the provided signals change
 * @throws If the query is not eligible for auto execution (e.g. a POST request)
 * @throws If the query has the `onlyManualExecution` query config flag set and `ignoreOnlyManualExecution` is not set
 */
export const withAutoRefresh = <TArgs extends QueryArgs>(options: WithAutoRefreshFeatureOptions) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithAutoRefresh,
    fn: (context) => {
      if (!context.flags.shouldAutoExecuteMethod) {
        throw withAutoRefreshUsedOnUnsupportedHttpMethod(context.creatorInternals.method);
      }

      if (context.queryConfig.onlyManualExecution && !options.ignoreOnlyManualExecution) {
        throw withAutoRefreshUsedInManualQuery();
      }

      queryEffect(
        () => {
          for (const signal of options.onSignalChanges) {
            signal();
          }

          untracked(() => {
            const args = context.state.args();

            // Don't start polling if the query doesn't have args.
            // It should have args because a withArgs feature is present.
            if (args === null && context.flags.hasWithArgsFeature) return;

            context.execute({ args });
          });
        },
        QUERY_EFFECT_ERROR_MESSAGE,
        { injector: context.deps.injector },
      );
    },
  });
};
