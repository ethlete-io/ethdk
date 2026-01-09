import { Injector, inject, isDevMode } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, map, of, switchMap, take, tap, timer } from 'rxjs';
import { QueryArgs, QueryCreator, QueryRepositoryEvent, RequestArgs, ResponseType } from '../http';
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
};

export type TokenRefreshQueryConfig<TArgs extends QueryArgs> = AuthQueryConfig<TArgs> & {
  /**
   * The property name in the decoded JWT that contains the expiration time (in seconds).
   * @default 'exp'
   */
  expiresInPropertyName?: string;

  /**
   * Buffer time in milliseconds before the token expires to trigger a refresh.
   * @default 300000 (5 minutes)
   */
  refreshBuffer?: number;

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
  const setup = (context: BearerAuthProviderQueryContext) => {
    const injector = inject(Injector);

    const expiresInPropertyName = config.expiresInPropertyName ?? 'exp';
    const refreshBufferMs = config.refreshBuffer ?? 300000; // 5 minutes default
    const autoRetryOn401 = config.autoRetryOn401 ?? true;

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

            const expiresInMs = expiresIn * 1000;
            const now = Date.now();
            const timeUntilRefresh = expiresInMs - now - refreshBufferMs;

            if (timeUntilRefresh <= 0) {
              return of(true);
            }

            return timer(timeUntilRefresh).pipe(tap(() => true));
          } catch (error) {
            if (isDevMode()) {
              console.error('Failed to set up auto-refresh:', error);
            }
            return of(null);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe((shouldRefresh) => {
        const currentRefreshToken = context.refreshToken();
        if (shouldRefresh && currentRefreshToken) {
          const refreshArgs = { body: { token: currentRefreshToken } } as RequestArgs<QueryArgs>;
          context.executeQuery(key, refreshArgs, true);
        }
      });

    // Auto-retry on 401: Listen for 401 errors and retry after refresh succeeds
    if (autoRetryOn401) {
      const retriedRequests = new Set<string>();

      context.queryClient.repository.events$
        .pipe(
          filter(
            (event) =>
              event.type === 'request-error' &&
              event.isSecure &&
              event.error.status === 401 &&
              !retriedRequests.has(event.key),
          ),
          tap((event) => retriedRequests.add(event.key)),
          switchMap((failedRequestEvent) => {
            const currentRefreshToken = context.refreshToken();
            if (!currentRefreshToken) {
              retriedRequests.delete(failedRequestEvent.key);
              return of(null);
            }

            const refreshArgs = { body: { token: currentRefreshToken } } as RequestArgs<QueryArgs>;
            const refreshSnapshot = context.executeQuery(key, refreshArgs, true);

            return toObservable(refreshSnapshot.executionState, { injector }).pipe(
              filter((state) => state?.type === 'success'),
              take(1),
              map(() => failedRequestEvent),
            );
          }),
          filter((event): event is Extract<QueryRepositoryEvent, { type: 'request-error' }> => event !== null),
          tap((event) => event.request.execute({ allowCache: false })),
          switchMap((event) => timer(5000).pipe(tap(() => retriedRequests.delete(event.key)))),
          takeUntilDestroyed(),
        )
        .subscribe();
    }
  };

  return {
    _type: 'tokenRefreshQuery',
    key,
    config,
    setup,
  };
};
