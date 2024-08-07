import { HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, Subscription, switchMap, tap } from 'rxjs';
import { QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions, QueryExecute } from './query-execute';
import { cleanupPreviousExecute, queryExecute, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { InternalSecureCreateQueryCreatorOptions } from './secure-query-creator';

export type CreateSecureQueryExecuteOptions<TArgs extends QueryArgs> = Omit<
  CreateQueryExecuteOptions<TArgs>,
  'creatorInternals'
> & {
  creatorInternals: InternalSecureCreateQueryCreatorOptions;
};

export const createSecureExecuteFn = <TArgs extends QueryArgs>(
  options: CreateSecureQueryExecuteOptions<TArgs>,
): QueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const authProvider = inject(options.creatorInternals.authProvider.token);

  let authQuerySubscription = Subscription.EMPTY;

  const reset = () => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    resetExecuteState({ executeState, executeOptions: options });
  };

  const exec = (args = options.state.args()) => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    cleanupPreviousExecute({ executeOptions: options, executeState, args });

    const authQuery = authProvider.latestExecutedQuery();

    if (!authQuery || authQuery.loading()) {
      options.state.loading.set({ executeTime: Date.now(), progress: null });

      authQuerySubscription = toObservable(authProvider.latestExecutedQuery, { injector: options.deps.injector })
        .pipe(
          switchMap((query) => {
            if (!query) return of(null);

            return toObservable(query.isAlive, { injector: options.deps.injector }).pipe(
              tap((isAlive) => {
                if (isAlive) return;

                if (query.error()) {
                  // Put this query in a error state
                  const state = options.state;

                  state.error.set(query.error());
                  state.loading.set(null);
                  state.response.set(null);
                  state.latestHttpEvent.set(null);
                  state.args.set(null);
                } else if (query.response()) {
                  const tokens = authProvider.tokens();
                  const headers = args?.headers || new HttpHeaders();

                  if (!tokens) {
                    throw new Error('Tokens are not available in deferred secured query execution');
                  }

                  const newHeaders = headers.set('authorization', `Bearer ${tokens.accessToken}`);

                  const updatedArgs = { ...(args ?? ({} as RequestArgs<TArgs>)), headers: newHeaders };

                  queryExecute({
                    executeOptions: options,
                    executeState,
                    args: updatedArgs,
                  });
                }
              }),
            );
          }),
        )
        .subscribe();
    } else if (authQuery.response()) {
      const tokens = authProvider.tokens();
      const headers = args?.headers || new HttpHeaders();

      if (!tokens) {
        throw new Error('Tokens are not available in sync secured query execution');
      }

      const newHeaders = headers.set('authorization', `Bearer ${tokens.accessToken}`);

      const updatedArgs = { ...(args ?? ({} as RequestArgs<TArgs>)), headers: newHeaders };

      queryExecute({
        executeOptions: options,
        executeState,
        args: updatedArgs,
      });
    } else if (authQuery.error()) {
      // Put this query in a error state
      const state = options.state;

      state.error.set(authQuery.error());
      state.loading.set(null);
      state.response.set(null);
      state.latestHttpEvent.set(null);
      state.args.set(null);
    } else {
      throw new Error('Invalid state ocurred inside createSecureExecuteFn');
    }
  };

  exec['reset'] = reset;

  return exec;
};
