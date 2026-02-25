import { effect } from '@angular/core';
import { filter, map, Observable, take, tap } from 'rxjs';
import { RequestArgs } from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthProviderFeatureContext,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';

export type TokenRevocationConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
> = {
  /**
   * The query key to use for token revocation (must reference a registered query)
   */
  queryKey: TKey;
  /**
   * Function to build the revocation request args from tokens
   */
  buildArgs: (tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  }) => RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>>;
  /**
   * Whether to revoke on logout
   * @default true
   */
  revokeOnLogout?: boolean;
  /**
   * Whether to wait for revocation to complete before clearing local tokens.
   * When `true`, `revoke()` returns an `Observable<void>` that emits once and completes
   * when the revocation request finishes (success or failure).
   * @default false (fire and forget)
   */
  waitForRevocation?: boolean;
};

export type TokenRevocationFeature = {
  /**
   * Manually revoke the current tokens.
   * Returns `null` if there are no tokens to revoke or if a revocation is already in progress.
   * Returns an `Observable<void>` if `waitForRevocation` is `true` — subscribe to be notified
   * when the request completes (success or failure).
   */
  revoke: () => null | Observable<void>;
  /**
   * Enable automatic revocation on logout
   */
  enable: () => void;
  /**
   * Disable automatic revocation on logout
   */
  disable: () => void;
  /**
   * Whether automatic revocation is enabled
   */
  enabled: () => boolean;
};

export const withTokenRevocation = <
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
>(
  config: TokenRevocationConfig<TBuilders, TKey>,
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const revokeOnLogout = config.revokeOnLogout ?? true;
    const waitForRevocation = config.waitForRevocation ?? false;
    let enabled = true;
    let isRevoking = false;
    let previousAccessToken: string | null = null;

    const revoke = () => {
      if (isRevoking) return null;

      const accessToken = context.accessToken();
      const refreshToken = context.refreshToken();

      if (!accessToken && !refreshToken) {
        return null;
      }

      const args = config.buildArgs({ accessToken, refreshToken });

      isRevoking = true;

      const snapshot = context.queries[config.queryKey].execute(args, {
        triggeredBy: 'token-revocation',
      });

      if (waitForRevocation) {
        return snapshot.executionState.asObservable().pipe(
          filter((s) => s !== null && s.type !== 'loading'),
          take(1),
          tap(() => {
            isRevoking = false;
          }),
          map(() => void 0 as void),
        );
      }

      isRevoking = false;
      return null;
    };

    const enable = () => {
      enabled = true;
    };

    const disable = () => {
      enabled = false;
    };

    // Track token changes to detect logout
    if (revokeOnLogout) {
      effect(
        () => {
          const currentToken = context.accessToken();

          // Logout detected: had token before, now null
          if (previousAccessToken && !currentToken && enabled) {
            revoke();
          }

          previousAccessToken = currentToken;
        },
        { injector: context.injector },
      );
    }

    const instance: TokenRevocationFeature = {
      revoke,
      enable,
      disable,
      enabled: () => enabled,
    };

    return {
      type: BearerAuthFeatureType.TOKEN_REVOCATION,
      instance,
    };
  };
};
