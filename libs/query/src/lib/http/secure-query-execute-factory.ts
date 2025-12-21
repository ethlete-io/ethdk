import { HttpHeaders } from '@angular/common/http';
import { Signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { of, Subscription, switchMap, tap } from 'rxjs';
import { AnyQuerySnapshot, QueryArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { InternalQueryExecute, QueryExecuteArgs } from './query-execute';
import { resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { QueryState } from './query-state';
import { circularQueryDependencyChecker } from './query-utils';

const AUTH_HEADER = 'Authorization';

export type BearerAuthProvider = {
  tokens: () => { accessToken: string } | null;
  latestExecutedQuery: Signal<AnyQuerySnapshot | null>;
};

export type SecureExecuteFactoryOptions<TArgs extends QueryArgs> = {
  authProvider: BearerAuthProvider;
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  transformAuthAndExec: (
    executeArgs: QueryExecuteArgs<TArgs> | undefined,
    tokens: { accessToken: string },
    headers: HttpHeaders,
    executeState: ReturnType<typeof setupQueryExecuteState>,
  ) => void;
};

export const createSecureExecuteFactory = <TArgs extends QueryArgs>(
  options: SecureExecuteFactoryOptions<TArgs>,
): InternalQueryExecute<TArgs> => {
  const executeState = setupQueryExecuteState();
  const circularChecker = circularQueryDependencyChecker();

  let authQuerySubscription = Subscription.EMPTY;

  const reset = () => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    resetExecuteState({
      executeState,
      executeOptions: { deps: options.deps, state: options.state },
    });
  };

  const error = (query: AnyQuerySnapshot) => {
    const state = options.state;

    state.error.set(query.error());
    state.loading.set(null);
    state.rawResponse.set(null);
    state.latestHttpEvent.set(null);
    state.args.set(null);
  };

  const authAndExec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    const { args } = executeArgs ?? {};

    const tokens = options.authProvider.tokens();
    let headers = args?.headers || new HttpHeaders();

    if (!tokens) {
      throw new Error('Tokens are not available inside authAndExec');
    }

    if (!headers.has(AUTH_HEADER)) {
      headers = headers.set(AUTH_HEADER, `Bearer ${tokens.accessToken}`);
    }

    options.transformAuthAndExec(executeArgs, tokens, headers, executeState);
  };

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    circularChecker.check();

    // Make sure all effects are flushed before reading the args.
    // A withArgs feature effect might still be pending otherwise resulting in the wrong args being read.
    options.deps.effectScheduler.flush();

    const execArgsWithDefaults: QueryExecuteArgs<TArgs> = {
      args: executeArgs?.args ?? options.state.args(),
      options: executeArgs?.options,
    };

    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;

    const authQuery = options.authProvider.latestExecutedQuery();

    // This might happen if a secure query gets executed while the auth query has just been created.
    // This is due to the fact that the query state is being synced with the state inside the http request using effect.
    const isAuthQueryFreshlyExecuted = authQuery?.lastTimeExecutedAt() === null;

    if (!authQuery || authQuery.loading() || isAuthQueryFreshlyExecuted) {
      options.state.loading.set({ executeTime: Date.now(), progress: null });

      authQuerySubscription = toObservable(options.authProvider.latestExecutedQuery, {
        injector: options.deps.injector,
      })
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
      throw new Error('Invalid state occurred inside secure execute factory');
    }
  };

  exec['reset'] = reset;
  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
