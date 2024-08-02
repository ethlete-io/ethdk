/* eslint-disable @typescript-eslint/no-empty-function */

import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { DestroyRef, Signal, computed, effect, inject, untracked } from '@angular/core';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { CreateQueryCreatorOptions, InternalCreateQueryCreatorOptions, QueryConfig } from './query-creator';
import { withAutoRefreshUsedOnUnsupportedHttpMethod, withPollingUsedOnUnsupportedHttpMethod } from './query-errors';
import { QueryState } from './query-state';
import { QUERY_ARGS_RESET, QUERY_EFFECT_ERROR_MESSAGE, QueryArgsReset, queryEffect } from './query-utils';

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
  execute: (args: RequestArgs<TArgs>) => void;
  shouldAutoExecute: boolean;
  shouldAutoExecuteMethod: boolean;
  hasWithArgsFeature: boolean;
  hasRouteFunction: boolean;
};

export type QueryFeatureFn<TArgs extends QueryArgs> = (context: QueryFeatureContext<TArgs>) => void;

export type QueryFeature<TArgs extends QueryArgs> = {
  type: QueryFeatureType;
  fn: (context: QueryFeatureContext<TArgs>) => void;
};

const createQueryFeature = <TArgs extends QueryArgs>(config: { type: QueryFeatureType; fn: QueryFeatureFn<TArgs> }) => {
  return config as QueryFeature<TArgs>;
};

export const withArgs = <TArgs extends QueryArgs>(args: () => NoInfer<RequestArgs<TArgs>> | QueryArgsReset | null) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithArgs,
    fn: (context) => {
      const currArgs = computed(() => args());

      queryEffect(() => {
        const currArgsNow = currArgs();

        if (currArgsNow === null) return;

        untracked(() => {
          if (currArgsNow === QUERY_ARGS_RESET) {
            context.state.args.set(null);
            return;
          }

          context.state.args.set(currArgsNow);

          if (context.shouldAutoExecute) context.execute(currArgsNow);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};

export const withPolling = <TArgs extends QueryArgs>(options: { interval: number; executeInitially?: boolean }) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithPolling,
    fn: (context) => {
      if (!context.shouldAutoExecuteMethod) {
        throw withPollingUsedOnUnsupportedHttpMethod(context.creatorInternals.method);
      }

      let intervalId: number | null = null;

      queryEffect(() => {
        const args = context.state.args();

        untracked(() => {
          if (intervalId !== null) clearInterval(intervalId);

          if (args === null) return;

          if (options.executeInitially) {
            context.execute(args);
          }

          intervalId = window.setInterval(() => {
            context.execute(args);
          }, options.interval);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);

      inject(DestroyRef).onDestroy(() => intervalId !== null && clearInterval(intervalId));
    },
  });
};

export const withLogging = <TArgs extends QueryArgs>(options: {
  logFn: (v: HttpEvent<ResponseType<TArgs>> | null) => void;
}) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithLogging,
    fn: (context) => {
      effect(() => {
        const event = context.state.latestHttpEvent();

        if (event === null) return;

        untracked(() => {
          options.logFn(event);
        });
      });
    },
  });
};

export const withErrorHandling = <TArgs extends QueryArgs>(options: { handler: (e: HttpErrorResponse) => void }) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithErrorHandling,
    fn: (context) => {
      effect(() => {
        const error = context.state.error();

        if (error === null) return;

        untracked(() => {
          options.handler(error);
        });
      });
    },
  });
};

export const withSuccessHandling = <TArgs extends QueryArgs>(options: {
  handler: (data: NonNullable<ResponseType<TArgs>>) => void;
}) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithSuccessHandling,
    fn: (context) => {
      effect(() => {
        const response = context.state.response();

        if (response === null) return;

        untracked(() => {
          options.handler(response as NonNullable<ResponseType<TArgs>>);
        });
      });
    },
  });
};

export const withAutoRefresh = <TArgs extends QueryArgs>(options: {
  signalChanges: Signal<unknown>[];
  ignoreOnlyManualExecution?: boolean;
}) => {
  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WithAutoRefresh,
    fn: (context) => {
      if (!context.shouldAutoExecuteMethod) {
        throw withAutoRefreshUsedOnUnsupportedHttpMethod(context.creatorInternals.method);
      }

      if (context.queryConfig.onlyManualExecution && !options.ignoreOnlyManualExecution) {
        throw withAutoRefreshUsedOnUnsupportedHttpMethod(context.creatorInternals.method);
      }

      queryEffect(() => {
        for (const signal of options.signalChanges) {
          signal();
        }

        untracked(() => {
          const args = context.state.args();

          if (args === null) return;

          context.execute(args);
        });
      }, QUERY_EFFECT_ERROR_MESSAGE);
    },
  });
};
