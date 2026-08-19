import { HttpHeaders } from '@angular/common/http';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, filter, map, merge, Subscription, switchMap, take, takeWhile, tap } from 'rxjs';
import { AnyBearerAuthProvider } from '../auth';
import { AnyQuerySnapshot, QueryArgs, RequestArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { invalidStateInsideSecureExecuteFactory, tokensNotAvailableInsideAuthAndExec } from './query-errors';
import { InternalQueryExecute, QueryExecuteArgs } from './query-execute';
import { circularQueryDependencyChecker, resetExecuteState, setupQueryExecuteState } from './query-execute-utils';
import { QueryState } from './query-state';

const AUTH_HEADER = 'Authorization';

export type SecureExecuteFactoryOptions<TArgs extends QueryArgs> = {
  authProvider: AnyBearerAuthProvider;
  deps: QueryDependencies;
  state: QueryState<TArgs>;
  /**
   * Whether the query runs itself rather than only on an explicit `execute()` - the same condition
   * `maybeExecute` and the `withArgs` feature use. Only those are re-run once a new session starts;
   * re-firing a mutation on the next login would repeat it behind the user's back.
   */
  autoExecutes: boolean;

  /**
   * Hands the execution over to the concrete query implementation. `executeArgs.args.headers` is a
   * provider function, not resolved headers - it must be passed through to the repository as-is, or
   * the request freezes the access token it was first built with.
   */
  transformAuthAndExec: (
    executeArgs: QueryExecuteArgs<TArgs> | undefined,
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
  let tokenWaitSubscription = Subscription.EMPTY;
  let sessionRestartSubscription = Subscription.EMPTY;

  let hasExecuted = false;
  let lastExecuteArgs: QueryExecuteArgs<TArgs> | undefined;

  /** The access token the last request went out with - what the 401 retry below compares against. */
  let lastRequestedWithToken: string | null = null;

  const error$ = toObservable(options.state.error, { injector: options.deps.injector });

  const reset = () => {
    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    tokenRefreshSubscription.unsubscribe();
    tokenRefreshSubscription = Subscription.EMPTY;
    tokenWaitSubscription.unsubscribe();
    tokenWaitSubscription = Subscription.EMPTY;
    sessionRestartSubscription.unsubscribe();
    sessionRestartSubscription = Subscription.EMPTY;
    resetExecuteState({
      executeState,
      executeOptions: { deps: options.deps, state: options.state },
    });
  };

  // A logout tears down the secure entries in the repository, but the query object holding one keeps
  // its own `response`/`error` signals - so without this a component still mounted after logout goes
  // on rendering the previous user's data until something calls `reset()` by hand.
  //
  // Resetting alone leaves it idle for good though: a self-executing query runs once, at creation,
  // and nothing runs it again - so anything still mounted across a logout has to be re-armed for
  // the next session. That re-arm waits on the token instead of re-running here: `logout()` clears
  // `latestExecutedQuery` and `executionState` only *after* emitting this event, so everything read
  // synchronously still describes the session that just ended.
  options.deps.client.repository.events$
    .pipe(
      filter((event) => event.type === 'unbind-all-secure'),
      takeUntilDestroyed(options.deps.destroyRef),
    )
    .subscribe(() => {
      const shouldRestart = hasExecuted && options.autoExecutes;
      const restartArgs = lastExecuteArgs;

      reset();

      if (!shouldRestart) return;

      sessionRestartSubscription = toObservable(options.authProvider.accessToken, {
        injector: options.deps.injector,
      })
        .pipe(
          filter(Boolean),
          take(1),
          tap(() => exec(restartArgs)),
        )
        .subscribe();
    });

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
        throw tokensNotAvailableInsideAuthAndExec();
      }

      if (!baseHeaders.has(AUTH_HEADER)) {
        return baseHeaders.set(AUTH_HEADER, `Bearer ${accessToken}`);
      }

      return baseHeaders;
    };

    const accessToken = options.authProvider.accessToken();
    if (!accessToken) {
      throw tokensNotAvailableInsideAuthAndExec();
    }

    lastRequestedWithToken = accessToken;

    options.transformAuthAndExec(
      {
        ...executeArgs,
        args: {
          ...(args ?? {}),
          headers: headerProvider,
        } as RequestArgs<TArgs>,
      },
      executeState,
    );
  };

  // The auth query completing and the access token being populated happen on two
  // different reactive timelines: the token is set by a separate token-extraction
  // effect (see `setupBearerQueryRegistry`), and for cross-client / secure auth
  // queries the completion is delivered through several nested `toObservable` hops.
  // Calling `authAndExec` purely because the auth query is "done" therefore races
  // the token and can run while it is still null. Gate on the token signal instead:
  // execute immediately if it is already available, otherwise wait for it.
  const authAndExecWhenTokenReady = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    if (options.authProvider.accessToken()) {
      authAndExec(executeArgs);

      return;
    }

    tokenWaitSubscription.unsubscribe();
    tokenWaitSubscription = toObservable(options.authProvider.accessToken, {
      injector: options.deps.injector,
    })
      .pipe(
        filter(Boolean),
        take(1),
        tap(() => authAndExec(executeArgs)),
      )
      .subscribe();
  };

  const exec = (executeArgs?: QueryExecuteArgs<TArgs>) => {
    circularChecker.check();

    const execArgsWithDefaults: QueryExecuteArgs<TArgs> = {
      args: executeArgs?.args ?? options.state.args(),
      options: executeArgs?.options,
    };

    hasExecuted = true;
    lastExecuteArgs = execArgsWithDefaults;

    authQuerySubscription.unsubscribe();
    authQuerySubscription = Subscription.EMPTY;
    tokenRefreshSubscription.unsubscribe();
    tokenRefreshSubscription = Subscription.EMPTY;
    tokenWaitSubscription.unsubscribe();
    tokenWaitSubscription = Subscription.EMPTY;
    sessionRestartSubscription.unsubscribe();
    sessionRestartSubscription = Subscription.EMPTY;

    // Retrying with the token that just produced the 401 would 401 again, and that 401 asks for
    // another refresh - an endless refresh/retry loop for as long as the server keeps handing out
    // tokens it rejects. A refresh that did not change the access token is therefore not a reason to
    // retry; the subscription stays open, so a later one that does change it still is.
    //
    // The error landing is a trigger of its own: a refresh can complete before this query's 401 has
    // even come back (which is also why that 401 must not start another refresh - see
    // withRefreshQuery's 401 handling), and the refresh emission alone would find no error to act
    // on. Emissions of the error this execution armed with are not landings, only replays.
    const errorAtArm = options.state.error();

    tokenRefreshSubscription = merge(
      options.authProvider.afterTokenRefresh$,
      error$.pipe(filter((landedError) => landedError !== errorAtArm)),
    )
      .pipe(
        filter(() => {
          const currentError = options.state.error();
          return currentError?.code === 401 && options.authProvider.accessToken() !== lastRequestedWithToken;
        }),
        take(1),
        tap(() => exec(execArgsWithDefaults)),
        takeUntilDestroyed(options.deps.destroyRef),
      )
      .subscribe();

    // `setTokens()` seeds an auth session from outside the query registry (an SSO/OIDC callback, a
    // native shell) - no query ever runs for `latestExecutedQuery` to report, so a successful token
    // seed is treated as an auth query that already resolved.
    if (options.authProvider.executionState()?.type === 'tokenSeed') {
      authAndExecWhenTokenReady(execArgsWithDefaults);

      return;
    }

    const latestQuery = options.authProvider.latestExecutedQuery();
    const authQuery = latestQuery?.snapshot;

    // This might happen if a secure query gets executed while the auth query has just been created.
    // This is due to the fact that the query state is being synced with the state inside the http request using effect.
    const isAuthQueryFreshlyExecuted = authQuery?.lastTimeExecutedAt() === null;

    if (!authQuery || authQuery.loading() || isAuthQueryFreshlyExecuted) {
      options.state.loading.set({ executeTime: Date.now(), progress: null });

      const latestExecutedQuery$ = toObservable(options.authProvider.latestExecutedQuery, {
        injector: options.deps.injector,
      }).pipe(
        switchMap((latestQuery) => {
          if (!latestQuery) return EMPTY;
          const query = latestQuery.snapshot;

          return toObservable(query.isAlive, { injector: options.deps.injector }).pipe(
            filter((isAlive) => !isAlive),
            filter(() => !!query.error() || !!query.response()),
            map(() => query),
          );
        }),
        tap((query) => {
          if (query.error()) {
            error(query);
          } else {
            authAndExecWhenTokenReady(execArgsWithDefaults);
          }
        }),
        // Stop at the first auth query that hands a session over. Every later one is a token refresh,
        // which settles before its tokens are applied - re-running here would send the token that just
        // expired; `afterTokenRefresh$` above is what re-runs a query after a refresh. A *failed* auth
        // query keeps the wait open, so a query that mounted during a failed auto-login still runs
        // once the user logs in for real.
        takeWhile((query) => !!query.error()),
      );

      // A `setTokens()` call that lands while this is already waiting (e.g. the SSO redirect
      // resolves after this secure query mounted) never touches `latestExecutedQuery` either -
      // wake up on `executionState` becoming a token seed too.
      const tokenSeed$ = toObservable(options.authProvider.executionState, {
        injector: options.deps.injector,
      }).pipe(
        filter((state) => state?.type === 'tokenSeed'),
        take(1),
        tap(() => authAndExecWhenTokenReady(execArgsWithDefaults)),
      );

      authQuerySubscription = merge(latestExecutedQuery$, tokenSeed$).subscribe();
    } else if (authQuery.response()) {
      authAndExecWhenTokenReady(execArgsWithDefaults);
    } else if (authQuery.error()) {
      error(authQuery);
    } else {
      throw invalidStateInsideSecureExecuteFactory();
    }
  };

  exec['reset'] = reset;
  exec['currentRepositoryKey'] = executeState.previousKey.asReadonly();

  return exec;
};
