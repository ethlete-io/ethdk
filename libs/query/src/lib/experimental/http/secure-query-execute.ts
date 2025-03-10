import { HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, Subscription, switchMap, tap } from 'rxjs';
import { AnyQuerySnapshot, QueryArgs, RequestArgs } from './query';
import { CreateQueryExecuteOptions, InternalQueryExecute, QueryExecuteArgs } from './query-execute';
import { cleanupPreviousExecute, queryExecute, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { circularQueryDependencyChecker, pendingEffectsAwaiter } from './query-utils';
import { InternalSecureCreateQueryCreatorOptions } from './secure-query-creator';

const AUTH_HEADER = 'Authorization';

export type CreateSecureQueryExecuteOptions<TArgs extends QueryArgs> = Omit<
  CreateQueryExecuteOptions<TArgs>,
  'creatorInternals'
> & {
  creatorInternals: InternalSecureCreateQueryCreatorOptions<TArgs>;
};

export const createSecureExecuteFn = <TArgs extends QueryArgs>(
  options: CreateSecureQueryExecuteOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const authProvider = inject(options.creatorInternals.authProvider.token);
  const circularChecker = circularQueryDependencyChecker();
  const effectAwaiter = pendingEffectsAwaiter();

  let authQuerySubscription = Subscription.EMPTY;

  const reset = () => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    resetExecuteState({ executeState, executeOptions: options });
  };

  const error = (query: AnyQuerySnapshot) => {
    const state = options.state;

    state.error.set(query.error());
    state.loading.set(null);
    state.response.set(null);
    state.latestHttpEvent.set(null);
    state.args.set(null);
  };

  const authAndExec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    const { args, options: runOptions } = executeArgs ?? {};

    console.log('authAndExec', { executeArgs, args, runOptions });

    const tokens = authProvider.tokens();
    let headers = args?.headers || new HttpHeaders();

    if (!tokens) {
      throw new Error('Tokens are not available inside authAndExec');
    }

    if (!headers.has(AUTH_HEADER)) {
      headers = headers.set(AUTH_HEADER, `Bearer ${tokens.accessToken}`);
    }

    const updatedArgs = { ...(args ?? ({} as RequestArgs<TArgs>)), headers };

    queryExecute({
      executeOptions: options,
      executeState,
      args: updatedArgs,
      options: runOptions,
    });
  };

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    circularChecker.check();

    effectAwaiter(() => {
      const execArgsWithDefaults: QueryExecuteArgs<TArgs> = {
        args: executeArgs?.args ?? options.state.args(),
        options: executeArgs?.options,
      };

      authQuerySubscription.unsubscribe();
      authQuerySubscription = Subscription.EMPTY;
      cleanupPreviousExecute({ executeOptions: options, executeState });

      const authQuery = authProvider.latestExecutedQuery();

      // This might happen if a secure query gets executed while the auth query has just been created.
      // This is due to the fact that the query state is being synced with the state inside the http request using effect.
      const isAuthQueryFreshlyExecuted = authQuery?.lastTimeExecutedAt() === null;

      if (!authQuery || authQuery.loading() || isAuthQueryFreshlyExecuted) {
        options.state.loading.set({ executeTime: Date.now(), progress: null });

        authQuerySubscription = toObservable(authProvider.latestExecutedQuery, { injector: options.deps.injector })
          .pipe(
            switchMap((query) => {
              if (!query) return of(null);

              return toObservable(query.isAlive, { injector: options.deps.injector }).pipe(
                tap((isAlive) => {
                  if (isAlive) return;

                  if (query.error()) {
                    error(query);
                  } else if (query.response()) {
                    authAndExec(execArgsWithDefaults);
                  }
                }),
              );
            }),
          )
          .subscribe();
      } else if (authQuery.response()) {
        authAndExec(execArgsWithDefaults);
      } else if (authQuery.error()) {
        error(authQuery);
      } else {
        throw new Error('Invalid state ocurred inside createSecureExecuteFn');
      }
    });
  };

  exec['reset'] = reset;

  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
