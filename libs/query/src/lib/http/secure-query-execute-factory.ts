import { HttpHeaders } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, of, Subscription, switchMap, take, tap } from 'rxjs';
import { AnyBearerAuthProvider } from '../auth';
import { AnyQuerySnapshot, QueryArgs, RequestArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { InternalQueryExecute, QueryExecuteArgs } from './query-execute';
import { circularQueryDependencyChecker, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { QueryState } from './query-state';

const AUTH_HEADER = 'Authorization';

export type SecureExecuteFactoryOptions<TArgs extends QueryArgs> = {
  authProvider: AnyBearerAuthProvider;
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
  let tokenRefreshSubscription = Subscription.EMPTY;

  const reset = () => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    tokenRefreshSubscription.unsubscribe();
    tokenRefreshSubscription = Subscription.EMPTY;
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
    const args = executeArgs?.args;

    const headerProvider = () => {
      const accessToken = options.authProvider.accessToken();
      const baseHeaders = typeof args?.headers === 'function' ? args.headers() : args?.headers || new HttpHeaders();

      if (!accessToken) {
        throw new Error('Tokens are not available inside authAndExec');
      }

      if (!baseHeaders.has(AUTH_HEADER)) {
        return baseHeaders.set(AUTH_HEADER, `Bearer ${accessToken}`);
      }

      return baseHeaders;
    };

    const accessToken = options.authProvider.accessToken();
    if (!accessToken) {
      throw new Error('Tokens are not available inside authAndExec');
    }

    const tokens = { accessToken, refreshToken: options.authProvider.refreshToken() ?? '' };
    const headers = headerProvider();

    options.transformAuthAndExec(
      {
        ...executeArgs,
        args: {
          ...(args ?? {}),
          headers: headerProvider, // Pass header provider instead of static headers
        } as RequestArgs<TArgs>,
      },
      tokens,
      headers,
      executeState,
    );
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
    tokenRefreshSubscription.unsubscribe();
    tokenRefreshSubscription = Subscription.EMPTY;

    tokenRefreshSubscription = options.authProvider.afterTokenRefresh$
      .pipe(
        filter(() => {
          const currentError = options.state.error();
          return currentError?.code === 401;
        }),
        take(1),
        tap(() => exec(execArgsWithDefaults)),
      )
      .subscribe();

    const latestQuery = options.authProvider.latestExecutedQuery();
    const authQuery = latestQuery?.snapshot;

    // This might happen if a secure query gets executed while the auth query has just been created.
    // This is due to the fact that the query state is being synced with the state inside the http request using effect.
    const isAuthQueryFreshlyExecuted = authQuery?.lastTimeExecutedAt() === null;

    if (!authQuery || authQuery.loading() || isAuthQueryFreshlyExecuted) {
      options.state.loading.set({ executeTime: Date.now(), progress: null });

      authQuerySubscription = toObservable(options.authProvider.latestExecutedQuery, {
        injector: options.deps.injector,
      })
        .pipe(
          switchMap((latestQuery) => {
            if (!latestQuery) return of(null);
            const query = latestQuery.snapshot;

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
