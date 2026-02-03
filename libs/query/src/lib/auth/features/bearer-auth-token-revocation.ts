import { effect } from '@angular/core';
import { QueryArgs, RequestArgs } from '../../http';
import { AnyQueryBuilder, BearerAuthFeatureType, BearerAuthProviderFeatureContext } from '../bearer-auth-provider';

export type TokenRevocationConfig<TRevokeArgs extends QueryArgs> = {
  /**
   * The query key to use for token revocation (must reference a registered query)
   */
  queryKey: string;
  /**
   * Function to build the revocation request args from tokens
   */
  buildArgs: (tokens: { accessToken: string | null; refreshToken: string | null }) => RequestArgs<TRevokeArgs>;
  /**
   * Whether to revoke on logout
   * @default true
   */
  revokeOnLogout?: boolean;
  /**
   * Whether to wait for revocation to complete before clearing local tokens
   * @default false (fire and forget)
   */
  waitForRevocation?: boolean;
};

export type TokenRevocationFeature = {
  /**
   * Manually revoke the current tokens
   */
  revoke: () => null | Promise<void>;
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
  TRevokeArgs extends QueryArgs = QueryArgs,
>(
  config: NoInfer<TokenRevocationConfig<TRevokeArgs>>,
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

      // Nothing to revoke
      if (!accessToken && !refreshToken) {
        return null;
      }

      const args = config.buildArgs({ accessToken, refreshToken });

      isRevoking = true;

      try {
        const snapshot = context.executeQuery(config.queryKey, args, true);

        if (waitForRevocation) {
          // Return promise for awaitable revocation
          return new Promise<void>((resolve) => {
            const checkComplete = () => {
              if (!snapshot.loading()) {
                isRevoking = false;
                resolve();
              } else {
                setTimeout(checkComplete, 50);
              }
            };
            checkComplete();
          });
        } else {
          // Fire and forget
          isRevoking = false;
        }
      } catch (error) {
        isRevoking = false;
        console.error('Token revocation failed:', error);
      }

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
