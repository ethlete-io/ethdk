import { computed, Signal, untracked } from '@angular/core';
import { RequestHttpEvent } from './http-request';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryDependencies } from './query-dependencies';
import { QueryErrorResponse } from './query-error-response';
import {
  withAutoRefreshUsedInManualQuery,
  withAutoRefreshUsedOnUnsupportedHttpMethod,
  withPollingUsedOnUnsupportedHttpMethod,
} from './query-errors';
import { InternalQueryExecute } from './query-execute';
import { QueryState } from './query-state';
import { CLEAR_QUERY_ARGS, ClearQueryArgs, nestedEffect, QueryFeatureFlags } from './query-utils';

export const QueryFeatureType = {
  WITH_ARGS: 'WITH_ARGS',
  WITH_LOGGING: 'WITH_LOGGING',
  WITH_ERROR_HANDLING: 'WITH_ERROR_HANDLING',
  WITH_SUCCESS_HANDLING: 'WITH_SUCCESS_HANDLING',
  WITH_POLLING: 'WITH_POLLING',
  WITH_AUTO_REFRESH: 'WITH_AUTO_REFRESH',
  WITH_RESPONSE_UPDATE: 'WITH_RESPONSE_UPDATE',
} as const;
export type QueryFeatureType = (typeof QueryFeatureType)[keyof typeof QueryFeatureType];

export type QueryFeatureContext<TArgs extends QueryArgs> = {
  state: QueryState<TArgs>;
  execute: InternalQueryExecute<TArgs>;
  deps: QueryDependencies;
  flags: QueryFeatureFlags;
};

export type QueryFeatureFn<TArgs extends QueryArgs> = (context: QueryFeatureContext<TArgs>) => void;

export type QueryFeature<TArgs extends QueryArgs> = {
  type: QueryFeatureType;
  fn: (context: QueryFeatureContext<TArgs>) => void;
};

export const createQueryFeature = <TArgs extends QueryArgs>(config: {
  type: QueryFeatureType;
  fn: QueryFeatureFn<TArgs>;
}) => {
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
    type: QueryFeatureType.WITH_ARGS,
    fn: (context) => {
      const currArgs = computed(() => args());

      nestedEffect(
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
    type: QueryFeatureType.WITH_POLLING,
    fn: (context) => {
      if (!context.flags.shouldAutoExecuteMethod) {
        throw withPollingUsedOnUnsupportedHttpMethod(context.flags.method);
      }

      let intervalId: number | null = null;

      nestedEffect(
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
        { injector: context.deps.injector },
      );

      context.deps.destroyRef.onDestroy(() => intervalId !== null && clearInterval(intervalId));
    },
  });
};

export type WithLoggingFeatureOptions<TArgs extends QueryArgs> = {
  /** A function that will be called with the latest http event */
  logFn: (v: RequestHttpEvent<TArgs> | null) => void;
};

/** A query feature that can be used to log the latest http event */
export const withLogging = <TArgs extends QueryArgs>(options: WithLoggingFeatureOptions<TArgs>) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WITH_LOGGING,
    fn: (context) => {
      nestedEffect(
        () => {
          const event = context.state.latestHttpEvent();

          if (event === null) return;

          untracked(() => {
            options.logFn(event);
          });
        },
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithErrorHandlingFeatureOptions = {
  /** A function that will be called with the latest error */
  handler: (e: QueryErrorResponse) => void;
};

/** A query feature that can be used to handle errors */
export const withErrorHandling = <TArgs extends QueryArgs>(options: WithErrorHandlingFeatureOptions) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WITH_ERROR_HANDLING,
    fn: (context) => {
      nestedEffect(
        () => {
          const error = context.state.error();

          if (error === null) return;

          untracked(() => {
            options.handler(error);
          });
        },
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithSuccessHandlingFeatureOptions<TArgs extends QueryArgs> = {
  /** A function that will be called with the latest response */
  handler: (data: NonNullable<ResponseType<TArgs>>) => void;
};

/** A query feature that can be used to handle successful responses */
export const withSuccessHandling = <TArgs extends QueryArgs>(options: WithSuccessHandlingFeatureOptions<TArgs>) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WITH_SUCCESS_HANDLING,
    fn: (context) => {
      nestedEffect(
        () => {
          const response = context.state.response();

          if (response === null) return;

          untracked(() => {
            options.handler(response as NonNullable<ResponseType<TArgs>>);
          });
        },
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
    type: QueryFeatureType.WITH_AUTO_REFRESH,
    fn: (context) => {
      if (!context.flags.shouldAutoExecuteMethod) {
        throw withAutoRefreshUsedOnUnsupportedHttpMethod(context.flags.method);
      }

      if (context.flags.onlyManualExecution && !options.ignoreOnlyManualExecution) {
        throw withAutoRefreshUsedInManualQuery();
      }

      nestedEffect(
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
        { injector: context.deps.injector },
      );
    },
  });
};

export type WithResponseUpdateFeatureFnData<TArgs extends QueryArgs> = {
  /** The current response of the query */
  currentResponse: ResponseType<TArgs> | null;
};

export type WithResponseUpdateFeatureOptions<TArgs extends QueryArgs> = {
  /**
   * A function that will be called with the latest response
   * If the function returns `null`, the response will not be updated.
   * Otherwise, the response will be updated with the returned value.
   * The function will be called in a reactive signal context.
   * If the query get's executed after the response was updated, the response will be set the the fresh data received from the server.
   *
   * This feature is most useful in combination with web sockets where the data received from the socket might be more up-to-date than the data received previously.
   *
   * @example
   * const matchEvents = mySocket.joinRoom('match-events');
   *
   * const myMatchQuery = getMatch(
   *  withArgs(() => ({ matchId: 1 })),
   *  withResponseUpdate(({ currentResponse }) => {
   *   const matchEvent = matchEvents();
   *
   *   if (!matchEvent) return null;
   *
   *   // Do some checks here. This is just a very simple example.
   *   // To apply partial updates, you can use the spread operator in combination with the current response.
   *
   *   return matchEvent;
   *  })
   * )
   */
  updater: (data: WithResponseUpdateFeatureFnData<TArgs>) => ResponseType<TArgs> | null;
};

export const withResponseUpdate = <TArgs extends QueryArgs>(options: WithResponseUpdateFeatureOptions<TArgs>) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WITH_RESPONSE_UPDATE,
    fn: (context) => {
      nestedEffect(
        () => {
          const currentResponse = untracked(() => context.state.response());
          const response = options.updater({ currentResponse });

          if (response === null) return;

          untracked(() => {
            context.state.response.set(response);
          });
        },
        { injector: context.deps.injector },
      );
    },
  });
};
