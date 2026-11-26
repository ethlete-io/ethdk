import { Signal, computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, of, switchMap, timer } from 'rxjs';
import { formatQueryDevtoolsDuration } from '../../devtools/query-devtools-features';
import { AnyQueryBuilder, BearerAuthFeatureType, BearerAuthProviderFeatureContext } from '../bearer-auth-provider';
import { readAccessTokenTimes, refreshBufferMs } from '../internal/token-times';

export type TokenExpirationWarningConfig = {
  /**
   * Time in milliseconds before token expiration to emit warning
   * @default 5 * 60 * 1000 (5 minutes)
   */
  warningThreshold?: number;
  /**
   * Interval in milliseconds to check for token expiration
   * @default 1000 (1 second)
   */
  checkInterval?: number;
  /**
   * Name of the claim in the decoded access token that carries the expiry, as seconds since the epoch.
   * @default the refresh query's `expiresInPropertyName`, otherwise `'exp'`
   */
  expiresInPropertyName?: string;
};

export type TokenExpirationWarningFeature = {
  /**
   * `true` while the access token is inside `warningThreshold` of its expiry and nothing is going to
   * renew it: there is no refresh query or refresh token, or the scheduled refresh is overdue by 10 s
   * (or half the refresh buffer, if that is shorter) - it failed, was throttled, or is still in flight. A routine refresh never turns it on.
   */
  isExpiringSoon: Signal<boolean>;
  /**
   * Time in milliseconds until token expires (null if no token or expired)
   */
  expiresIn: Signal<number | null>;
  /**
   * Timestamp when token expires (null if no token)
   */
  expiresAt: Signal<Date | null>;
};

const RENEWAL_GRACE_MS = 10_000;

export const withTokenExpirationWarning = <TBuilders extends readonly AnyQueryBuilder[]>(
  config: NoInfer<TokenExpirationWarningConfig> = {},
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const warningThreshold = config.warningThreshold ?? 5 * 60 * 1000;
    const checkInterval = config.checkInterval ?? 1000;
    const refreshBuilder = context.queryBuilders.find((builder) => builder._type === 'tokenRefreshQuery');
    const refreshConfig = refreshBuilder?._type === 'tokenRefreshQuery' ? refreshBuilder.config : null;
    const expiresInPropertyName = config.expiresInPropertyName ?? refreshConfig?.expiresInPropertyName ?? 'exp';

    let measuredLifetime: { token: string; lifetimeMs: number } | null = null;

    const tokenTimes = computed(() => {
      const token = context.accessToken();

      if (!token) return null;

      const times = readAccessTokenTimes({
        token,
        decoded: context.bearerData(),
        claim: expiresInPropertyName,
        providerName: context.name,
      });

      if (!times) return null;

      if (times.issuedAtMs !== null && times.expiresAtMs > times.issuedAtMs) {
        return { ...times, lifetimeMs: times.expiresAtMs - times.issuedAtMs };
      }

      if (measuredLifetime?.token !== token) {
        measuredLifetime = { token, lifetimeMs: times.expiresAtMs - Date.now() };
      }

      return { ...times, lifetimeMs: measuredLifetime.lifetimeMs };
    });

    const expiresAt = computed<Date | null>(() => {
      const times = tokenTimes();

      return times ? new Date(times.expiresAtMs) : null;
    });

    const expiresIn = toSignal(
      toObservable(tokenTimes).pipe(
        switchMap((times) =>
          times
            ? timer(0, checkInterval).pipe(
                map(() => {
                  const msUntilExpiry = times.expiresAtMs - Date.now();

                  return msUntilExpiry > 0 ? msUntilExpiry : null;
                }),
              )
            : of(null),
        ),
      ),
      { initialValue: null },
    );

    const isExpiringSoon = computed(() => {
      const msUntilExpiry = expiresIn();
      const times = tokenTimes();

      if (msUntilExpiry === null || !times || msUntilExpiry > warningThreshold) return false;
      if (!refreshConfig || !context.refreshToken()) return true;

      const bufferMs = refreshBufferMs(refreshConfig.refreshStrategy, times.lifetimeMs);
      const msOverdue = bufferMs - msUntilExpiry;

      return msOverdue >= Math.min(RENEWAL_GRACE_MS, bufferMs / 2);
    });

    const instance: TokenExpirationWarningFeature = {
      expiresAt,
      expiresIn,
      isExpiringSoon,
    };

    return {
      type: BearerAuthFeatureType.TOKEN_EXPIRATION_WARNING,
      instance,
      devtools: () => [
        { label: 'warn before', value: formatQueryDevtoolsDuration(warningThreshold) },
        { label: 'check every', value: formatQueryDevtoolsDuration(checkInterval) },
        { label: 'expiry claim', value: expiresInPropertyName },
      ],
    };
  };
};
