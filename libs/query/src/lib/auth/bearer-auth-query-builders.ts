import { isDevMode } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, of, switchMap, tap, timer } from 'rxjs';
import { QueryArgs, QueryCreator, RequestArgs, ResponseType } from '../http';
import { ShouldRetryRequestFn } from '../http/query-utils';
import { decryptBearer } from '../legacy/auth';
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
   * Minimum interval between refresh attempts in milliseconds.
   * Prevents rapid refresh loops in case of issues.
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
};

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
  config,
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

  const setup = (context: BearerAuthProviderQueryContext) => {
    const expiresInPropertyName = config.expiresInPropertyName ?? 'exp';
    const minRefreshInterval = config.minRefreshInterval ?? 30000; // 30 seconds default
    const refreshIfExpired = config.refreshIfExpired ?? true;

    let lastRefreshTime = 0;

    const executeRefresh = (triggeredInternally = true) => {
      const currentRefreshToken = context.refreshToken();
      if (!currentRefreshToken || !context.isLeader()) return;

      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTime;

      // Prevent too-frequent refreshes
      if (timeSinceLastRefresh < minRefreshInterval) return;

      lastRefreshTime = now;
      const refreshArgs = { body: { token: currentRefreshToken } } as RequestArgs<QueryArgs>;
      context.executeQuery(key, refreshArgs, triggeredInternally);
    };

    const calculateRefreshBuffer = (tokenLifetimeMs: number): number => {
      if (typeof config.refreshStrategy === 'number') {
        return config.refreshStrategy;
      }

      const percentage = config.refreshStrategy?.percentage ?? 0.75;
      const minBufferMs = config.refreshStrategy?.minBufferMs ?? 60000; // 1 minute
      const maxBufferMs = config.refreshStrategy?.maxBufferMs ?? 600000; // 10 minutes

      const calculatedBuffer = tokenLifetimeMs * (1 - percentage);

      return Math.max(minBufferMs, Math.min(maxBufferMs, calculatedBuffer));
    };

    // Auto-refresh based on token expiration
    toObservable(context.accessToken)
      .pipe(
        switchMap((token) => {
          if (!token) return of(null);

          try {
            const bearerDataValue = context.bearerDecryptFn ? context.bearerDecryptFn(token) : decryptBearer(token);
            const expiresIn = (bearerDataValue as Record<string, unknown>)?.[expiresInPropertyName];

            if (typeof expiresIn !== 'number') {
              if (isDevMode()) {
                console.warn(`Token does not contain valid ${expiresInPropertyName} property for auto-refresh`);
              }
              return of(null);
            }

            const expiresAtMs = expiresIn * 1000;
            const now = Date.now();
            const tokenLifetimeMs = expiresAtMs - now;

            if (tokenLifetimeMs <= 0) {
              if (refreshIfExpired) {
                if (isDevMode()) {
                  console.warn('Token is already expired, triggering immediate refresh');
                }
                return of(true);
              }
              return of(null);
            }

            const refreshBufferMs = calculateRefreshBuffer(tokenLifetimeMs);
            const timeUntilRefresh = tokenLifetimeMs - refreshBufferMs;

            if (timeUntilRefresh <= 0) {
              return of(true);
            }

            return timer(timeUntilRefresh).pipe(tap(() => true));
          } catch {
            return of(null);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe((shouldRefresh) => {
        if (shouldRefresh) {
          executeRefresh(true);
        }
      });

    // Auto-retry on 401: Listen to repository events and trigger refresh on 401 errors
    const autoRetryOn401 = config.autoRetryOn401 ?? true;
    if (autoRetryOn401) {
      context.repository.events$
        .pipe(
          filter((event) => {
            // Only handle 401 errors for secure queries
            if (event.type !== 'request-error') return false;
            if (!event.isSecure) return false;
            if (event.error?.status !== 401) return false;

            return true;
          }),
          takeUntilDestroyed(),
        )
        .subscribe(() => {
          executeRefresh(true);
        });
    }
  };

  return {
    _type: 'tokenRefreshQuery',
    key,
    config: {
      ...config,
      queryCreator: config.queryCreator.clone({ retryFn: refreshRetryFn }),
    },
    setup,
  };
};
