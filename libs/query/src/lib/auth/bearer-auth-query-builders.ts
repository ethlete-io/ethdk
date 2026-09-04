import { computed, DestroyRef, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { concatMap, EMPTY, fromEvent, Observable, of, race, switchMap, take, timer } from 'rxjs';
import { patchQueryDevtoolsTokenPayload } from '../devtools/query-devtools-hook';
import { QueryArgs, QueryCreator, QueryErrorResponse, RequestArgs, ResponseType } from '../http';
import { ShouldRetryRequestFn } from '../http/query-retry-utils';
import { decryptBearer } from '../http/internal/request-route';
import { BearerAuthProviderQueryContext } from './bearer-auth-provider';

export type BearerAuthProviderTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthQueryConfig<TArgs extends QueryArgs> = {
  queryCreator: QueryCreator<TArgs>;
  /**
   * Extracts tokens from the response.
   * @default (response) => response (assumes response has accessToken and refreshToken properties)
   */
  extractTokens?: (response: ResponseType<TArgs>) => BearerAuthProviderTokens;
  /**
   * Custom retry function for HTTP requests.
   * @internal Used internally by token refresh queries
   */
  retryFn?: ShouldRetryRequestFn;
};

export type TokenRefreshQueryConfig<TArgs extends QueryArgs> = AuthQueryConfig<TArgs> & {
  /**
   * Builds the request the refresh query sends for the current refresh token. Set it whenever the
   * API names that field anything other than `token`.
   *
   * @default (refreshToken) => ({ body: { token: refreshToken } })
   *
   * @example
   * withRefreshQuery('refresh', {
   *   queryCreator: refresh,
   *   buildArgs: (refreshToken) => ({ body: { refresh_token: refreshToken } }),
   * });
   */
  buildArgs?: (refreshToken: string) => RequestArgs<TArgs>;

  /**
   * The property name in the decoded JWT that contains the expiration time (in seconds).
   * @default 'exp'
   */
  expiresInPropertyName?: string;

  /**
   * Strategy for determining when to refresh the token.
   * Can be either:
   * - A percentage (0-1) of the token's lifetime (e.g., 0.75 = refresh at 75% of lifetime)
   * - A fixed time in milliseconds before expiration
   * - An object with both percentage and min/max constraints
   * @default { percentage: 0.75, minBufferMs: 60000, maxBufferMs: 600000 }
   */
  refreshStrategy?:
    | number
    | {
        /**
         * Percentage of token lifetime before refresh (0-1)
         * @default 0.75
         */
        percentage?: number;
        /**
         * Minimum buffer time in ms (prevents too-early refresh for short-lived tokens)
         * @default 60000 (1 minute)
         */
        minBufferMs?: number;
        /**
         * Maximum buffer time in ms (prevents too-late refresh for long-lived tokens)
         * @default 600000 (10 minutes)
         */
        maxBufferMs?: number;
      };

  /**
   * Minimum interval between the *proactive* refreshes the expiry timer schedules, in milliseconds.
   * Prevents rapid refresh loops in case of issues.
   *
   * A refresh a 401 asked for is not throttled by this - a token revoked seconds after a proactive
   * refresh is exactly when the request must go out. Those are kept in check differently: one
   * refresh is in flight at a time, a 401 from a request that went out with an older access token
   * refreshes nothing (the refresh it is asking for already happened), and once a whole streak of
   * them runs back to back - every fresh token 401ing again, with no secure request succeeding in
   * between - further ones fall back to this interval.
   *
   * @default 30000 (30 seconds)
   */
  minRefreshInterval?: number;

  /**
   * Whether to immediately refresh if token is already expired on startup.
   * @default true
   */
  refreshIfExpired?: boolean;

  /**
   * Configuration for retry behavior on failed refresh attempts.
   * @default { retryableStatusCodes: [0, 408, 425, 429, 500, 502, 503, 504], maxRetryDelayMs: 30000 }
   */
  retryConfig?: {
    /**
     * HTTP status codes that should trigger a retry.
     * Code 0 means network error (no internet).
     * @default [0, 408, 425, 429, 500, 502, 503, 504]
     */
    retryableStatusCodes?: number[];
    /**
     * Maximum delay between retries in milliseconds.
     * Uses exponential backoff up to this limit, then stays constant.
     * @default 30000 (30 seconds)
     */
    maxRetryDelayMs?: number;
    /**
     * Maximum number of retry attempts.
     * Set to 0 for unlimited retries.
     * @default 0 (unlimited)
     */
    maxAttempts?: number;
  };

  /**
   * Whether to automatically retry failed requests with 401 status after refreshing tokens.
   * @default true
   */
  autoRetryOn401?: boolean;

  /**
   * What to do once the refresh query has failed for good - `retryConfig` decides what is retried,
   * this decides what a failure that survived it means.
   *
   * Defaults to ending the session for any status `retryConfig.retryableStatusCodes` does not list:
   * those are the failures that could still succeed later, everything else leaves the tab holding a
   * token the server will not renew. Without this the session would look valid while every secure
   * query 401s.
   *
   * Also runs for a `withPersistentAuth` cookie auto-login that goes through this query: the cookie
   * holds a refresh token, so a rejected one is a refresh that failed for good.
   *
   * @example
   * withRefreshQuery('refresh', {
   *   queryCreator: refresh,
   *   onRefreshFailure: ({ error, logout }) => {
   *     if (error.code !== 503) logout();
   *   },
   * });
   */
  onRefreshFailure?: (failure: RefreshFailure) => void;
};

/** What {@link TokenRefreshQueryConfig.onRefreshFailure} is handed when a refresh gives up. */
export type RefreshFailure = {
  /** The error the refresh query ended on. */
  error: QueryErrorResponse;

  /**
   * Ends the session, exactly as the provider's own `logout()` does, reporting `sessionEndCause`
   * as `'expired'`.
   */
  logout: () => void;
};

/**
 * What came of a refresh attempt. Everything but `executed` left the refresh token unspent, so a
 * scheduled attempt that ends on one has to come back for it.
 */
type RefreshAttempt = 'executed' | 'noToken' | 'delegated' | 'notLeader' | 'busy' | 'throttled';

/**
 * Why a refresh is being attempted. `takeover` is a follower spending the refresh token because the
 * leader did not, so it is the one reason that ignores the leadership.
 */
type RefreshReason = 'scheduled' | 'unauthorized' | 'takeover';

/** How long a scheduled refresh waits before retrying an attempt that could not run yet. */
const rescheduleDelayMs = 5000;

/**
 * How long a follower waits for the leader to answer a delegated refresh before asking again. The
 * request is a `BroadcastChannel` message with no ack, so a leader that was frozen or handed the
 * leadership over mid-flight simply never acts on it.
 */
const delegatedRefreshRetryMs = 3000;

/** How often a delegated refresh is re-asked for before this tab refreshes the tokens itself. */
const maxDelegatedRefreshAttempts = 3;

/**
 * The same budget for a leader that answered with "a refresh started here". It is working on the
 * refresh, so it gets longer than a silent one - but not forever, because the answer says a refresh
 * started, not that it will ever finish.
 */
const maxDelegatedRefreshWindows = 6;

/**
 * How long before its expiry an access token counts as stale, which is the point a follower stops
 * waiting for the leader. Long enough to run the delegation ladder before the token is worthless,
 * short enough that a leader whose timer is merely throttled still gets to act first.
 */
const followerTakeoverGraceMs = 30000;

/**
 * How long a tab that took a refresh over holds the refresh lock at most. It is released as soon as
 * the refresh reports back; this only bounds the wait for one that never does.
 */
const takeoverRefreshMaxLockHoldMs = 15000;

/**
 * The longest delay `setTimeout` can hold. Anything above it fires straight away, which would turn a
 * long wait into a busy loop that spends every re-arm at once.
 */
const maxTimerDelayMs = 2147483647;

/**
 * The lock a tab must hold to spend the refresh token outside the leadership. Two followers go stale
 * at the same instant - their access token is the same one - so the takeover needs a mutex of its own.
 */
const refreshLockName = (providerName: string) => `ethlete-auth:refresh:${providerName}`;

/**
 * How often a scheduled refresh may re-arm before it waits for a new token pair. A tab that keeps
 * declining is either not the leader or busy issuing tokens; either way a 401 still forces a refresh.
 */
const maxRescheduleAttempts = 5;

/**
 * How many 401-driven refreshes may run back to back before they fall back to `minRefreshInterval`.
 * Every refresh in such a streak means the token the previous one issued was rejected too, so an
 * unbounded streak is a refresh loop, not recovery. A secure request succeeding ends the streak.
 */
const maxUnauthorizedRefreshStreak = 3;

export type AuthQueryBuilder<TKey extends string, TArgs extends QueryArgs> = {
  _type: 'authQuery';
  key: TKey;
  config: AuthQueryConfig<TArgs>;
  setup?: (context: BearerAuthProviderQueryContext) => void;
};

export type TokenRefreshQueryBuilder<TKey extends string, TArgs extends QueryArgs> = {
  _type: 'tokenRefreshQuery';
  key: TKey;
  config: TokenRefreshQueryConfig<TArgs>;
  setup?: (context: BearerAuthProviderQueryContext) => void;

  /**
   * The args a refresh sends for a given refresh token, so the devtools can describe the request
   * without running it.
   */
  buildArgs: (refreshToken: string) => RequestArgs<QueryArgs>;
};

export type AnyQueryBuilder =
  | AuthQueryBuilder<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  | TokenRefreshQueryBuilder<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const withAuthenticationQuery = <TKey extends string, TArgs extends QueryArgs>(
  key: TKey,
  config: AuthQueryConfig<TArgs>,
  setup?: (context: BearerAuthProviderQueryContext) => void,
): AuthQueryBuilder<TKey, TArgs> => ({
  _type: 'authQuery',
  key,
  config: {
    ...config,
    // A spent credential entry must not sit out a retention window: the request body holds the
    // username and password, the response the tokens it was exchanged for.
    queryCreator: config.queryCreator.clone({
      ...(config.retryFn ? { retryFn: config.retryFn } : {}),
      keepUnusedFor: 0,
      subtle: { useQueryRepositoryCache: true },
    }),
  },
  setup,
});

export const withRefreshQuery = <TKey extends string, TArgs extends QueryArgs>(
  key: TKey,
  config: TokenRefreshQueryConfig<TArgs>,
): TokenRefreshQueryBuilder<TKey, TArgs> => {
  const retryableStatusCodes = config.retryConfig?.retryableStatusCodes ?? [0, 408, 425, 429, 500, 502, 503, 504];
  const maxRetryDelayMs = config.retryConfig?.maxRetryDelayMs ?? 30000; // 30 seconds
  const maxAttempts = config.retryConfig?.maxAttempts ?? 0; // 0 = unlimited

  const refreshRetryFn: ShouldRetryRequestFn = ({ error, retryCount }) => {
    const { status } = error;

    if (maxAttempts > 0 && retryCount >= maxAttempts) {
      return { retry: false };
    }

    if (!retryableStatusCodes.includes(status)) {
      return { retry: false };
    }

    if (status === 429) {
      const retryAfter = error.headers.get('retry-after') || error.headers.get('x-retry-after');
      if (retryAfter) {
        const delay = parseInt(retryAfter) * 1000;
        if (!Number.isNaN(delay)) {
          return { retry: true, delay: Math.min(delay, maxRetryDelayMs) };
        }
      }
    }

    const exponentialDelay = 1000 * Math.pow(2, retryCount);
    const delay = Math.min(exponentialDelay, maxRetryDelayMs);

    return { retry: true, delay };
  };

  const buildArgs = (refreshToken: string) =>
    (config.buildArgs?.(refreshToken) ?? { body: { token: refreshToken } }) as RequestArgs<QueryArgs>;

  const setup = (context: BearerAuthProviderQueryContext) => {
    const expiresInPropertyName = config.expiresInPropertyName ?? 'exp';
    const minRefreshInterval = config.minRefreshInterval ?? 30000; // 30 seconds default
    const refreshIfExpired = config.refreshIfExpired ?? true;

    const destroyRef = inject(DestroyRef);

    let lastRefreshTime = 0;
    let lastUnauthorizedRefreshTime = 0;
    let unauthorizedRefreshStreak = 0;
    let delegatedRefreshAttempts = 0;
    let isWatchingDelegatedRefresh = false;
    let hasLeaderAnsweredDelegation = false;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const refreshQuery = () => context.queries[key]!;

    const executeRefresh = (reason: RefreshReason): RefreshAttempt => {
      const currentRefreshToken = context.refreshToken();
      if (!currentRefreshToken) return 'noToken';

      if (reason !== 'takeover' && !context.isLeader()) {
        // A scheduled tick on a follower is pure duplicate while the token still has life left: multi-tab
        // sync keeps the access token identical across tabs, so the leader's own timer is due at the same
        // instant and it is the only tab allowed to act. Once the token is stale that reasoning is spent -
        // the leader had its moment and let it pass - so the tab delegates and, if that goes unanswered,
        // takes the refresh over.
        if (reason === 'scheduled' && !isAccessTokenStale()) return 'notLeader';

        context.refreshCoordination?.request();
        watchDelegatedRefresh(context.accessToken());

        return 'delegated';
      }

      // Any token-issuing execution, not just another refresh: a login already in flight is about to
      // issue a token pair of its own, and the refresh token this would spend belongs to the session
      // that login is replacing.
      if (context.hasTokenIssuingExecutionInFlight()) return 'busy';

      const now = Date.now();

      if (reason === 'scheduled') {
        if (now - lastRefreshTime < minRefreshInterval) return 'throttled';
      } else {
        if (
          unauthorizedRefreshStreak >= maxUnauthorizedRefreshStreak &&
          now - lastUnauthorizedRefreshTime < minRefreshInterval
        ) {
          return 'throttled';
        }

        unauthorizedRefreshStreak++;
        lastUnauthorizedRefreshTime = now;
      }

      // Stamped whatever the reason, so the scheduled floor covers a 401-driven rotation too - a
      // scheduled tick right behind one would otherwise spend a second refresh token. The 401 path
      // deliberately does not *gate* on it: a token revoked seconds after a refresh is exactly when
      // the request has to go out.
      lastRefreshTime = now;

      refreshQuery().execute(buildArgs(currentRefreshToken), { triggeredBy: 'token-refresh' });

      // Answers every follower waiting on a delegated refresh, not just the one that asked: they all
      // hold the same access token, so they all go stale at the same moment.
      context.refreshCoordination?.announceStart();

      return 'executed';
    };

    /**
     * Asks the leader again if a delegated refresh went unanswered, and refreshes the tokens in this tab
     * once the leader has run out of chances. A frozen leader keeps the lock that makes it the leader
     * while it runs no timer and reads no message, so waiting for it is waiting for nothing.
     *
     * One watch at a time, and by the time it re-asks this tab may be the leader itself; `executeRefresh`
     * re-decides that on every attempt.
     */
    function watchDelegatedRefresh(tokenAtRequest: string | null) {
      if (isWatchingDelegatedRefresh) return;

      // A new ladder judges the leader by what it answers this time round, not by an answer from an hour
      // ago - the tab that gave it may not even be open any more.
      if (delegatedRefreshAttempts === 0) hasLeaderAnsweredDelegation = false;

      const budget = hasLeaderAnsweredDelegation ? maxDelegatedRefreshWindows : maxDelegatedRefreshAttempts;

      if (delegatedRefreshAttempts >= budget) return;

      delegatedRefreshAttempts++;
      isWatchingDelegatedRefresh = true;

      timer(delegatedRefreshRetryMs)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => {
          isWatchingDelegatedRefresh = false;

          // A new access token is the leader's answer - nothing to re-ask for.
          if (context.accessToken() !== tokenAtRequest) {
            delegatedRefreshAttempts = 0;
            hasLeaderAnsweredDelegation = false;

            return;
          }

          const spentBudget = hasLeaderAnsweredDelegation ? maxDelegatedRefreshWindows : maxDelegatedRefreshAttempts;

          if (delegatedRefreshAttempts >= spentBudget) {
            void takeOverRefresh(tokenAtRequest);

            return;
          }

          executeRefresh('unauthorized');
        });
    }

    /** Runs the refresh and keeps the refresh lock until it reports back, or until the bound runs out. */
    const runTakenOverRefresh = async () => {
      const attempt = executeRefresh('takeover');

      // The ladder starts over whatever came of it, including a takeover that could not run yet - a
      // refresh already in flight, or the floor under the 401-driven ones. Leaving the budget spent
      // would retire the only path a follower has to a token the leader is not going to issue.
      delegatedRefreshAttempts = 0;
      hasLeaderAnsweredDelegation = false;

      if (attempt !== 'executed') return;

      await new Promise<void>((resolve) => {
        race(context.afterTokenRefresh$, timer(takeoverRefreshMaxLockHoldMs))
          .pipe(take(1), takeUntilDestroyed(destroyRef))
          .subscribe({ next: () => resolve(), complete: () => resolve() });
      });
    };

    /**
     * Spends the refresh token in this tab, after the leader failed to. Guarded by a lock of its own
     * rather than by the leadership, which the unresponsive tab still holds: every follower runs out of
     * patience at the same instant, and a single-use refresh token must not be spent twice.
     *
     * `ifAvailable` makes it a try-lock, so the tab that does not get the lock stands down instead of
     * queueing for a turn it must no longer take - the winner's new token pair arrives over the sync
     * channel long before then.
     */
    const takeOverRefresh = async (tokenAtRequest: string | null) => {
      if (context.accessToken() !== tokenAtRequest) return;

      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;

      if (!locks) {
        await runTakenOverRefresh();

        return;
      }

      await locks.request(refreshLockName(context.name), { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Another tab is spending the refresh token right now. Start the ladder over rather than race
          // it: this tab hears about the pair it issues, and needs a way back if it never issues one.
          delegatedRefreshAttempts = 0;

          return;
        }

        if (context.accessToken() !== tokenAtRequest) return;

        await runTakenOverRefresh();
      });
    };

    /**
     * How long a scheduled refresh that did not spend the refresh token waits before trying again.
     * `null` re-arms nothing, because only a new token pair can change the outcome - and that restarts
     * the schedule anyway.
     */
    const retryScheduledIn = (attempt: RefreshAttempt): number | null => {
      switch (attempt) {
        case 'executed':
        case 'noToken':
          return null;
        case 'throttled':
          return Math.max(minRefreshInterval - (Date.now() - lastRefreshTime), rescheduleDelayMs);
        case 'busy':
          return rescheduleDelayMs;
        case 'delegated':
          return minRefreshInterval;
        // Left to the leader's own timer, which is due at the same instant as this one. Coming back at
        // the staleness deadline instead of on a fixed interval is what makes the wait bounded: a fixed
        // interval spends `maxRescheduleAttempts` within minutes of a token that can live for hours, and
        // the tab is then left with no armed timer at all.
        case 'notLeader':
          return Math.min(
            Math.max(msUntilAccessTokenIsStale() ?? minRefreshInterval, rescheduleDelayMs),
            maxTimerDelayMs,
          );
      }
    };

    const calculateRefreshBuffer = (tokenLifetimeMs: number) => {
      if (typeof config.refreshStrategy === 'number') {
        return config.refreshStrategy >= 0 && config.refreshStrategy <= 1
          ? tokenLifetimeMs * (1 - config.refreshStrategy)
          : config.refreshStrategy;
      }

      const percentage = config.refreshStrategy?.percentage ?? 0.75;
      const minBufferMs = config.refreshStrategy?.minBufferMs ?? 60000; // 1 minute
      const maxBufferMs = config.refreshStrategy?.maxBufferMs ?? 600000; // 10 minutes

      const calculatedBuffer = tokenLifetimeMs * (1 - percentage);

      return Math.max(minBufferMs, Math.min(maxBufferMs, calculatedBuffer));
    };

    /** When this token expires, as a timestamp, or `null` if the expiry cannot be read off it. */
    const tokenExpiresAt = (token: string) => {
      try {
        const decoded = context.bearerDecryptFn ? context.bearerDecryptFn(token) : decryptBearer(token);
        const bearerDataValue = patchQueryDevtoolsTokenPayload({
          payload: decoded,
          providerName: context.name,
          expiresInPropertyName,
        });
        const expiresIn = (bearerDataValue as Record<string, unknown>)?.[expiresInPropertyName];

        if (typeof expiresIn !== 'number') {
          if (isDevMode()) {
            console.warn(`Token does not contain valid ${expiresInPropertyName} property for auto-refresh`);
          }

          return null;
        }

        return expiresIn * 1000;
      } catch {
        return null;
      }
    };

    /** When this access token is due to be refreshed, or `null` if it cannot be scheduled at all. */
    const scheduledRefreshDelay = (token: string) => {
      const expiresAt = tokenExpiresAt(token);

      if (expiresAt === null) return null;

      const tokenLifetimeMs = expiresAt - Date.now();

      if (tokenLifetimeMs <= 0) {
        if (!refreshIfExpired) return null;

        if (isDevMode()) {
          console.warn('Token is already expired, triggering immediate refresh');
        }

        return 0;
      }

      return Math.max(tokenLifetimeMs - calculateRefreshBuffer(tokenLifetimeMs), 0);
    };

    /**
     * How long this tab can still work with the access token it holds, or `null` without a readable
     * expiry. Zero or less means a refresh has to happen now, whichever tab does it.
     */
    const msUntilAccessTokenIsStale = () => {
      const token = context.accessToken();

      if (!token) return null;

      const expiresAt = tokenExpiresAt(token);

      return expiresAt === null ? null : expiresAt - followerTakeoverGraceMs - Date.now();
    };

    const isAccessTokenStale = () => {
      const remainingMs = msUntilAccessTokenIsStale();

      return remainingMs !== null && remainingMs <= 0;
    };

    /**
     * Whether the access token this tab holds is already past its expiry, so sending it can only earn
     * a 401. Unlike {@link isAccessTokenStale} this has no grace period: a token with seconds of life
     * left is still worth sending.
     */
    const isAccessTokenExpired = () => {
      const token = context.accessToken();

      if (!token) return false;

      const expiresAt = tokenExpiresAt(token);

      return expiresAt !== null && expiresAt <= Date.now();
    };

    // Only reported when an expired token actually gets refreshed. With `refreshIfExpired: false` the
    // application asked for the request to go out and fail, so a secure query must not wait for a
    // refresh that never comes.
    if (refreshIfExpired) {
      context.reportAccessTokenExpiry(isAccessTokenExpired);
    }

    /**
     * The scheduled refresh, re-armed for as long as it keeps declining to spend the refresh token.
     * Without the re-arm a single declined attempt strands the session on a token nothing renews until
     * a request fails with a 401 - by which time the refresh token may be gone too.
     */
    const scheduledRefresh = (dueInMs: number, attemptsLeft: number): Observable<unknown> =>
      (dueInMs <= 0 ? of(0) : timer(Math.min(dueInMs, maxTimerDelayMs))).pipe(
        concatMap(() => {
          const attempt = executeRefresh('scheduled');
          const retryInMs = retryScheduledIn(attempt);

          if (retryInMs === null) return EMPTY;

          // Waiting on another tab does not spend the budget. Both outcomes come back at a deadline
          // rather than on a fixed interval, and both end the moment a token pair arrives, because a
          // new token restarts the schedule. Spending the budget on them leaves a follower whose
          // leader never acts with no armed timer at all, which is the one state nothing recovers
          // from: the tab then holds a dead token and cannot even ask for a new one.
          if (attempt === 'notLeader' || attempt === 'delegated') return scheduledRefresh(retryInMs, attemptsLeft);

          return attemptsLeft <= 0 ? EMPTY : scheduledRefresh(retryInMs, attemptsLeft - 1);
        }),
      );

    // A backgrounded tab's `timer()` does not fire on time - the browser throttles it, and a frozen
    // page stops running it altogether while keeping the Web Lock that makes it the leader. So the
    // schedule is recomputed whenever the page becomes visible again: an overdue token resolves to a
    // delay of 0 and refreshes immediately, instead of waiting for a secure query to 401.
    const foregroundEpoch = signal(0);

    if (typeof document !== 'undefined') {
      fromEvent(document, 'visibilitychange')
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => {
          if (document.visibilityState !== 'visible') return;

          foregroundEpoch.update((epoch) => epoch + 1);
        });
    }

    // The delay is read in a computed rather than in the `switchMap` so that a devtools-armed token
    // lifetime re-arms the schedule: the override is a signal, and only a reactive read of it moves the
    // timer before the next token arrives. The wrapper object keeps every recomputation an emission, so
    // two tokens that happen to be due at the same moment still restart the timer.
    const nextScheduledRefresh = computed(() => {
      const token = context.accessToken();

      foregroundEpoch();

      return { dueInMs: token ? scheduledRefreshDelay(token) : null };
    });

    toObservable(nextScheduledRefresh)
      .pipe(
        switchMap(({ dueInMs }) => (dueInMs === null ? EMPTY : scheduledRefresh(dueInMs, maxRescheduleAttempts))),
        takeUntilDestroyed(),
      )
      .subscribe();

    context.refreshCoordination?.requests$.pipe(takeUntilDestroyed()).subscribe(() => executeRefresh('unauthorized'));

    context.refreshCoordination?.starts$.pipe(takeUntilDestroyed()).subscribe(() => {
      hasLeaderAnsweredDelegation = true;
    });

    effect(() => {
      const state = context.executionState();

      if (state?.state !== 'error') return;

      const latestQuery = untracked(context.latestExecutedQuery);

      // `withPersistentAuth` spends the cookie's refresh token through this very query, and that
      // execution reports as `autoLogin` rather than as `tokenRefresh`. Judged by its type alone it
      // would end nothing: the tab keeps a rejected cookie's error state for good, `sessionEndCause`
      // never says `expired`, and an app gated on either never leaves its startup screen. The token
      // check keeps a session another tab handed over mid-request out of it - that session is not
      // this restore's to end.
      const isRejectedRestore =
        state.type === 'autoLogin' && latestQuery?.key === key && !untracked(context.accessToken);

      if (state.type !== 'tokenRefresh' && !isRejectedRestore) return;

      // `retryableStatusCodes` judges the request's status. A 2xx whose body `extractTokens` rejected
      // has none to judge - the server answered, and the answer holds no session - yet the error it is
      // reported as carries status 0, which the list reads as a network failure worth waiting out.
      const isExtractionFailure = latestQuery?.key === key && !latestQuery.snapshot.error();

      const failure: RefreshFailure = { error: state.error, logout: () => context.logout('expired') };

      // `logout` tears down every secure cache entry and emits on `events$`, so a consumer that reacts
      // to a session ending runs inside this effect. Angular refuses `effect()` from a reactive context,
      // so a listener that creates a query would throw NG0602 instead of handling the logout.
      untracked(() => {
        if (config.onRefreshFailure) {
          config.onRefreshFailure(failure);
        } else if (isExtractionFailure || !retryableStatusCodes.includes(state.error.code)) {
          failure.logout();
        }
      });
    });

    // Auto-retry on 401: Listen to repository events and trigger refresh on 401 errors
    const autoRetryOn401 = config.autoRetryOn401 ?? true;
    if (autoRetryOn401) {
      context.repository.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
        if (event.type === 'request-success' && event.isSecure) {
          unauthorizedRefreshStreak = 0;
          delegatedRefreshAttempts = 0;
          hasLeaderAnsweredDelegation = false;

          return;
        }

        if (event.type !== 'request-error' || !event.isSecure || event.error?.status !== 401) return;

        // A 401 from a request that went out with an older access token asks for a refresh that
        // already happened - the query re-runs itself with the current token (see
        // createSecureExecuteFactory). Refreshing again here would spend the refresh token that
        // pair came with, invalidating the tokens every other in-flight request is using; their
        // 401s would each do the same, keeping the loop alive for as long as queries are in flight.
        const sentAuthorization = event.request.subtle.lastSentHeaders()?.get('Authorization');
        const currentToken = context.accessToken();

        if (sentAuthorization && currentToken && sentAuthorization !== `Bearer ${currentToken}`) return;

        executeRefresh('unauthorized');
      });
    }
  };

  return {
    _type: 'tokenRefreshQuery',
    key,
    config: {
      ...config,
      queryCreator: config.queryCreator.clone({
        retryFn: config.retryFn ?? refreshRetryFn,
        keepUnusedFor: 0,
        subtle: { useQueryRepositoryCache: true },
      }),
    },
    setup,
    buildArgs,
  };
};
