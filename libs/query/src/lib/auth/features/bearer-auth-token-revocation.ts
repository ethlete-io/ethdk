import { effect, Signal, signal, untracked } from '@angular/core';
import { AnyQuerySnapshot, QuerySnapshot, RequestArgs } from '../../http';
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
};

export type TokenRevocationFeature<TQuerySnapshot extends AnyQuerySnapshot> = {
  /**
   * Manually revoke the current tokens.
   * Returns `null` if there are no tokens to revoke
   * Returns the revocation query snapshot if revocation was attempted
   */
  revoke: () => TQuerySnapshot | null;
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
  enabled: Signal<boolean>;
};

export const withTokenRevocation = <
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
>(
  config: TokenRevocationConfig<TBuilders, TKey>,
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    type RevocationSnapshot = QuerySnapshot<ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>>;

    const revokeOnLogout = config.revokeOnLogout ?? true;

    const enabled = signal(true);
    let previousAccessToken: string | null = null;
    let currentRevocationSnapshot: RevocationSnapshot | null = null;

    const revoke = () => {
      if (currentRevocationSnapshot?.isAlive()) return currentRevocationSnapshot;

      const accessToken = context.accessToken();
      const refreshToken = context.refreshToken();

      if (!accessToken && !refreshToken) {
        return null;
      }

      const args = config.buildArgs({ accessToken, refreshToken });

      currentRevocationSnapshot = context.queries[config.queryKey].execute(args, {
        triggeredBy: 'token-revocation',
      });

      return currentRevocationSnapshot;
    };

    const enable = () => {
      enabled.set(true);
    };

    const disable = () => {
      enabled.set(false);
    };

    if (revokeOnLogout) {
      effect(
        () => {
          const currentToken = context.accessToken();

          if (previousAccessToken && !currentToken && enabled()) {
            untracked(() => revoke());
          }

          previousAccessToken = currentToken;
        },
        { injector: context.injector },
      );
    }

    const instance: TokenRevocationFeature<RevocationSnapshot> = {
      revoke,
      enable,
      disable,
      enabled: enabled.asReadonly(),
    };

    return {
      type: BearerAuthFeatureType.TOKEN_REVOCATION,
      instance,
    };
  };
};
