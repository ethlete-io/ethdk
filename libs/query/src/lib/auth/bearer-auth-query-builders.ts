import { computed, effect, isDevMode } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { concatMap, EMPTY, Observable, of, switchMap, timer } from 'rxjs';
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
type RefreshAttempt = 'executed' | 'noToken' | 'delegated' | 'busy' | 'throttled';

/** How long a scheduled refresh waits before retrying an attempt that could not run yet. */
const rescheduleDelayMs = 5000;

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
   * @internal
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
    queryCreator: config.queryCreator.clone({ keepUnusedFor: 0, subtle: { useQueryRepositoryCache: true } }),
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

    let lastRefreshTime = 0;
    let lastUnauthorizedRefreshTime = 0;
    let unauthorizedRefreshStreak = 0;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const refreshQuery = () => context.queries[key]!;

    const executeRefresh = (reason: 'scheduled' | 'unauthorized'): RefreshAttempt => {
      const currentRefreshToken = context.refreshToken();
      if (!currentRefreshToken) return 'noToken';

      if (!context.isLeader()) {
        // Only the leader may spend a single-use refresh token, but the event is still real - hand it
        // over instead of dropping it, or this tab waits out the leader's timer with a dead token.
        context.refreshCoordination?.request();

        return 'delegated';
      }

      // Any token-issuing execution, not just another refresh: a login already in flight is about to
      // issue a token pair of its own, and the refresh token this would spend belongs to the session
      // that login is replacing.
      if (context.hasTokenIssuingExecutionInFlight()) return 'busy';

      if (reason === 'scheduled') {
        const now = Date.now();

        if (now - lastRefreshTime < minRefreshInterval) return 'throttled';

        lastRefreshTime = now;
      } else {
        const now = Date.now();

        if (
          unauthorizedRefreshStreak >= maxUnauthorizedRefreshStreak &&
          now - lastUnauthorizedRefreshTime < minRefreshInterval
        ) {
          return 'throttled';
        }

        unauthorizedRefreshStreak++;
        lastUnauthorizedRefreshTime = now;
      }

      refreshQuery().execute(buildArgs(currentRefreshToken), { triggeredBy: 'token-refresh' });

      return 'executed';
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
      }
    };

    const calculateRefreshBuffer = (tokenLifetimeMs: number) => {
      if (typeof config.refreshStrategy === 'number') {
        return config.refreshStrategy;
      }

      const percentage = config.refreshStrategy?.percentage ?? 0.75;
      const minBufferMs = config.refreshStrategy?.minBufferMs ?? 60000; // 1 minute
      const maxBufferMs = config.refreshStrategy?.maxBufferMs ?? 600000; // 10 minutes

      const calculatedBuffer = tokenLifetimeMs * (1 - percentage);

      return Math.max(minBufferMs, Math.min(maxBufferMs, calculatedBuffer));
    };

    /** When this access token is due to be refreshed, or `null` if it cannot be scheduled at all. */
    const scheduledRefreshDelay = (token: string) => {
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

        const tokenLifetimeMs = expiresIn * 1000 - Date.now();

        if (tokenLifetimeMs <= 0) {
          if (!refreshIfExpired) return null;

          if (isDevMode()) {
            console.warn('Token is already expired, triggering immediate refresh');
          }

          return 0;
        }

        return Math.max(tokenLifetimeMs - calculateRefreshBuffer(tokenLifetimeMs), 0);
      } catch {
        return null;
      }
    };

    /**
     * The scheduled refresh, re-armed for as long as it keeps declining to spend the refresh token.
     * Without the re-arm a single declined attempt strands the session on a token nothing renews until
     * a request fails with a 401 - by which time the refresh token may be gone too.
     */
    const scheduledRefresh = (dueInMs: number, attemptsLeft: number): Observable<unknown> =>
      (dueInMs <= 0 ? of(0) : timer(dueInMs)).pipe(
        concatMap(() => {
          const retryInMs = retryScheduledIn(executeRefresh('scheduled'));

          return retryInMs === null || attemptsLeft <= 0 ? EMPTY : scheduledRefresh(retryInMs, attemptsLeft - 1);
        }),
      );

    // The delay is read in a computed rather than in the `switchMap` so that a devtools-armed token
    // lifetime re-arms the schedule: the override is a signal, and only a reactive read of it moves the
    // timer before the next token arrives. The wrapper object keeps every recomputation an emission, so
    // two tokens that happen to be due at the same moment still restart the timer.
    const nextScheduledRefresh = computed(() => {
      const token = context.accessToken();

      return { dueInMs: token ? scheduledRefreshDelay(token) : null };
    });

    toObservable(nextScheduledRefresh)
      .pipe(
        switchMap(({ dueInMs }) => (dueInMs === null ? EMPTY : scheduledRefresh(dueInMs, maxRescheduleAttempts))),
        takeUntilDestroyed(),
      )
      .subscribe();

    context.refreshCoordination?.requests$.pipe(takeUntilDestroyed()).subscribe(() => executeRefresh('unauthorized'));

    const onRefreshFailure =
      config.onRefreshFailure ??
      (({ error, logout }: RefreshFailure) => {
        if (!retryableStatusCodes.includes(error.code)) logout();
      });

    effect(() => {
      const snapshot = refreshQuery().snapshot();

      if (!snapshot || snapshot.loading()) return;

      const error = snapshot.error();

      if (!error) return;

      onRefreshFailure({ error, logout: () => context.logout('expired') });
    });

    // Auto-retry on 401: Listen to repository events and trigger refresh on 401 errors
    const autoRetryOn401 = config.autoRetryOn401 ?? true;
    if (autoRetryOn401) {
      context.repository.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
        if (event.type === 'request-success' && event.isSecure) {
          unauthorizedRefreshStreak = 0;

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
        retryFn: refreshRetryFn,
        keepUnusedFor: 0,
        subtle: { useQueryRepositoryCache: true },
      }),
    },
    setup,
    buildArgs,
  };
};
