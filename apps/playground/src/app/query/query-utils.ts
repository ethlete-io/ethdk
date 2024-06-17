/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-empty-function */

import { CreateEffectOptions, effect, isDevMode } from '@angular/core';
import { QueryMethod } from './query-creator';

/**
 * Returning this inside e.g. a withComputedArgs feature will reset the query args to null.
 * This will also pause polling and auto refresh until new args are set.
 */
export const QUERY_ARGS_RESET = Symbol('QUERY_ARGS_RESET');
export type QueryArgsReset = typeof QUERY_ARGS_RESET;

export const QUERY_EFFECT_ERROR_MESSAGE =
  'Effect triggered too often. This is probably due to a circular dependency inside the query.';

/** A angular effect that will throw an error in dev mode if it is called too often. This indicates a circular dependency inside the effect. */
export const queryEffect = (fn: () => void, errorMessage: string, options?: CreateEffectOptions) => {
  let lastTriggerTs = 0;
  let illegalWrites = 0;

  effect(() => {
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

    fn();
  }, options);
};

export const shouldAutoExecuteQuery = (method: QueryMethod) => {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};
