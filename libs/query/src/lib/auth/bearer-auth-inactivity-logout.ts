import { DestroyRef, effect, inject, signal } from '@angular/core';
import { filter, fromEvent, interval, merge, switchMap, throttleTime, timer } from 'rxjs';
import { BearerAuthProviderFeatureContext } from './bearer-auth-provider';

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
  enabled: () => boolean;
  /**
   * Milliseconds until auto-logout (null if disabled or no token)
   */
  timeUntilLogout: () => number | null;
};

export type InactivityLogoutFeatureBuilder = {
  _type: 'inactivityLogout';
  config: InactivityLogoutConfig;
  setup: (context: BearerAuthProviderFeatureContext) => InactivityLogoutFeature;
};

export const withInactivityLogout = (config: InactivityLogoutConfig = {}): InactivityLogoutFeatureBuilder => {
  const inactivityTimeout = config.inactivityTimeout ?? 15 * 60 * 1000;
  const activityEvents = config.activityEvents ?? ['mousedown', 'keydown', 'scroll', 'touchstart'];

  return {
    _type: 'inactivityLogout',
    config,
    setup: (context) => {
      const destroyRef = inject(DestroyRef);
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

      // Reset timer when token changes
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

      const timeUntilLogout = () => {
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

      return {
        enable,
        disable,
        resetTimer,
        enabled,
        timeUntilLogout,
      };
    },
  };
};
