import { Signal, computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, interval, map } from 'rxjs';
import { AnyQueryBuilder, BearerAuthFeatureType, BearerAuthProviderFeatureContext } from '../bearer-auth-provider';

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
};

export type TokenExpirationWarningFeature = {
  /**
   * Signal that emits true when token is about to expire
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

export const withTokenExpirationWarning = <TBuilders extends readonly AnyQueryBuilder[]>(
  config: NoInfer<TokenExpirationWarningConfig> = {},
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const warningThreshold = config.warningThreshold ?? 5 * 60 * 1000;
    const checkInterval = config.checkInterval ?? 1000;
    const expiresAt = computed<Date | null>(() => {
      const decoded = context.bearerData() as { exp?: number; [key: string]: unknown } | null;
      if (!decoded) return null;

      const exp = decoded.exp;

      if (typeof exp !== 'number') return null;

      return new Date(exp * 1000);
    });

    const expiresIn$ = combineLatest([interval(checkInterval), toObservable(context.bearerData)]).pipe(
      map(() => {
        const expiry = expiresAt();
        if (!expiry) return null;

        const now = Date.now();
        const msUntilExpiry = expiry.getTime() - now;

        return msUntilExpiry > 0 ? msUntilExpiry : null;
      }),
    );

    const isExpiringSoon$ = expiresIn$.pipe(
      map((msUntilExpiry) => {
        if (msUntilExpiry === null) return false;
        return msUntilExpiry <= warningThreshold && msUntilExpiry > 0;
      }),
    );

    const expiresIn = toSignal(expiresIn$, { initialValue: null });
    const isExpiringSoon = toSignal(isExpiringSoon$, { initialValue: false });

    const instance: TokenExpirationWarningFeature = {
      expiresAt,
      expiresIn,
      isExpiringSoon,
    };

    return {
      type: BearerAuthFeatureType.TOKEN_EXPIRATION_WARNING,
      instance,
    };
  };
};
