import { DestroyRef, DOCUMENT, effect, inject, Signal, signal } from '@angular/core';
import { filter, fromEvent, interval, merge, switchMap, throttleTime, timer } from 'rxjs';
import { AnyQueryBuilder, BearerAuthFeatureType, BearerAuthProviderFeatureContext } from '../bearer-auth-provider';

export type InactivityLogoutConfig = {
  /**
   * Time in milliseconds of inactivity before auto-logout
   * @default 15 * 60 * 1000 (15 minutes)
   */
  inactivityTimeout?: number;
  /**
   * Events to track for activity detection
   * @default ['mousedown', 'keydown', 'scroll', 'touchstart']
   */
  activityEvents?: string[];
  /**
   * Custom activity check function (called periodically)
   * Return true if user is active
   */
  customActivityCheck?: () => boolean;
};

export type InactivityLogoutFeature = {
  /**
   * Enable inactivity tracking
   */
  enable: () => void;
  /**
   * Disable inactivity tracking
   */
  disable: () => void;
  /**
   * Reset the inactivity timer (mark user as active)
   */
  resetTimer: () => void;
  /**
   * Whether inactivity tracking is enabled
   */
  enabled: Signal<boolean>;
  /**
   * Milliseconds until auto-logout (null if disabled or no token)
   */
  calculateTimeUntilLogout: () => number | null;
};

export const withInactivityLogout = <TBuilders extends readonly AnyQueryBuilder[]>(
  config: InactivityLogoutConfig = {},
) => {
  return (context: BearerAuthProviderFeatureContext<unknown, TBuilders>) => {
    const inactivityTimeout = config.inactivityTimeout ?? 15 * 60 * 1000;
    const activityEvents = config.activityEvents ?? ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const enabled = signal(true);
    const lastActivityTime = signal(Date.now());

    const resetTimer = () => {
      lastActivityTime.set(Date.now());
    };

    const activityFromEvents$ = merge(...activityEvents.map((event) => fromEvent(document, event))).pipe(
      throttleTime(1000),
    );

    const activityFromCustomCheck$ = config.customActivityCheck
      ? interval(1000).pipe(filter(() => config.customActivityCheck?.() ?? false))
      : merge();

    const activity$ = merge(activityFromEvents$, activityFromCustomCheck$);

    const activitySubscription = activity$.subscribe(() => {
      if (enabled() && context.accessToken()) {
        resetTimer();
      }
    });

    const inactivityLogout$ = activity$.pipe(
      switchMap(() => timer(inactivityTimeout)),
      filter(() => enabled() && !!context.accessToken()),
    );

    const logoutSubscription = inactivityLogout$.subscribe(() => {
      context.logout();
    });

    effect(() => {
      const token = context.accessToken();
      if (token && enabled()) {
        resetTimer();
      }
    });

    const enable = () => {
      enabled.set(true);
      resetTimer();
    };

    const disable = () => {
      enabled.set(false);
    };

    const calculateTimeUntilLogout = () => {
      if (!enabled() || !context.accessToken()) {
        return null;
      }

      const elapsed = Date.now() - lastActivityTime();
      const remaining = inactivityTimeout - elapsed;

      return remaining > 0 ? remaining : 0;
    };

    resetTimer();

    destroyRef.onDestroy(() => {
      activitySubscription.unsubscribe();
      logoutSubscription.unsubscribe();
    });

    const instance: InactivityLogoutFeature = {
      enable,
      disable,
      resetTimer,
      enabled: enabled.asReadonly(),
      calculateTimeUntilLogout,
    };

    return {
      type: BearerAuthFeatureType.INACTIVITY_LOGOUT,
      instance,
    };
  };
};
