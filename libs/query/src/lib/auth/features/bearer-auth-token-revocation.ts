import { HttpHeaders } from '@angular/common/http';
import { effect, Signal, signal, untracked } from '@angular/core';
import { AnyQuerySnapshot, QueryArgs, QuerySnapshot, RequestArgs } from '../../http';
import {
  AnyQueryBuilder,
  BearerAuthFeatureType,
  BearerAuthSessionEndCause,
  BearerAuthProviderFeatureContext,
  ExtractQueryArgs,
  ExtractQueryKey,
} from '../bearer-auth-provider';

const AUTH_HEADER = 'Authorization';

export type TokenRevocationConfig<
  TBuilders extends readonly AnyQueryBuilder[],
  TKey extends ExtractQueryKey<TBuilders[number]> = ExtractQueryKey<TBuilders[number]>,
> = {
  /**
   * The query key to use for token revocation (must reference a registered query)
   */
  queryKey: TKey;
  /**
   * Function to build the revocation request args from tokens. Leave it out for a query that takes no args.
   */
  buildArgs?: (tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  }) => RequestArgs<ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>>;
  /**
   * Whether to revoke on logout
   * @default true
   */
  revokeOnLogout?: boolean;
  /**
   * The session end causes that revoke automatically. Leave it out to revoke on every cause.
   * @example revokeOn: ['user'] // for an API whose revocation ends the sessions on all devices
   */
  revokeOn?: readonly BearerAuthSessionEndCause[];
  /**
   * Send the revoked access token as `Authorization: Bearer <token>`, unless the built args already set that header.
   * @default false
   */
  bearer?: boolean;
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
    type RevocationArgs = ExtractQueryArgs<Extract<TBuilders[number], { key: TKey }>>;
    type RevocationSnapshot = QuerySnapshot<RevocationArgs>;

    const revokeOnLogout = config.revokeOnLogout ?? true;

    const withBearerHeader = (args: RequestArgs<RevocationArgs>, accessToken: string | null) => {
      if (!config.bearer || !accessToken) return args;

      const argHeaders = (args as Pick<QueryArgs, 'headers'>).headers;
      const headers = () => {
        const base = (typeof argHeaders === 'function' ? argHeaders() : argHeaders) ?? new HttpHeaders();

        return base.has(AUTH_HEADER) ? base : base.set(AUTH_HEADER, `Bearer ${accessToken}`);
      };

      return { ...args, headers };
    };

    const shouldRevokeFor = (cause: BearerAuthSessionEndCause | null) =>
      !config.revokeOn || (cause !== null && config.revokeOn.includes(cause));

    const enabled = signal(true);
    let previousAccessToken: string | null = null;
    let previousRefreshToken: string | null = null;
    let currentRevocationSnapshot: RevocationSnapshot | null = null;

    const revokeWithTokens = (accessToken: string | null, refreshToken: string | null) => {
      if (currentRevocationSnapshot?.isAlive()) return currentRevocationSnapshot;

      if (!accessToken && !refreshToken) {
        return null;
      }

      const args = withBearerHeader(
        config.buildArgs?.({ accessToken, refreshToken }) ?? ({} as RequestArgs<RevocationArgs>),
        accessToken,
      );

      context.executionState.set({ type: 'revocation', state: 'loading' });

      currentRevocationSnapshot = context.queries[config.queryKey].execute(args, {
        triggeredBy: 'token-revocation',
      });

      return currentRevocationSnapshot;
    };

    const revoke = () => {
      return revokeWithTokens(context.accessToken(), context.refreshToken());
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
          const currentRefreshToken = context.refreshToken();

          if (
            previousAccessToken &&
            !currentToken &&
            enabled() &&
            shouldRevokeFor(untracked(context.sessionEndCause))
          ) {
            untracked(() => revokeWithTokens(previousAccessToken, previousRefreshToken));
          }

          previousAccessToken = currentToken;
          previousRefreshToken = currentRefreshToken;
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
      devtools: () => [
        { label: 'query', value: config.queryKey },
        { label: 'on logout', value: revokeOnLogout ? (config.revokeOn?.join(', ') ?? 'yes') : 'no' },
        { label: 'bearer', value: config.bearer ? 'yes' : 'no' },
      ],
    };
  };
};
