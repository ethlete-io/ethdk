import { DestroyRef, DOCUMENT, effect, inject, Signal, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, fromEvent, interval, merge, switchMap, throttleTime, timer } from 'rxjs';
import { formatQueryDevtoolsDuration } from '../../devtools/query-devtools-features';
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
   * Mark the user as active: postpones the logout and, with multi-tab sync on, postpones it in the
   * session's other tabs too.
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

/**
 * Ends the session once the user has been inactive for {@link InactivityLogoutConfig.inactivityTimeout},
 * with `sessionEndCause` reporting `'inactivity'`.
 *
 * Idleness is a property of the session, not of a tab: with `withBearerAuthMultiTabSync` on, tabs tell
 * each other about activity, so the tab the user is typing in keeps the forgotten one from logging
 * everybody out. Without it - or with `syncLogout: false`, where a logout stays in the tab that
 * decided it - each tab times out on its own.
 *
 * @example
 * export const AUTH_PROVIDER = createBearerAuthProvider({
 *   name: 'my-auth',
 *   queryClientRef: MY_CLIENT,
 *   queries: [loginQuery, refreshQuery],
 *   features: [withBearerAuthMultiTabSync(), withInactivityLogout({ inactivityTimeout: 5 * 60 * 1000 })],
 * });
 */
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
    const activityCoordination = context.activityCoordination;

    // Announcing every throttled event would wake every other tab once a second for as long as the
    // user scrolls. A quarter of the timeout is far more than the other tabs need to never expire,
    // and it is one message per several minutes at the default.
    const announceInterval = inactivityTimeout / 4;
    let lastAnnouncedAt = 0;

    const markActive = () => lastActivityTime.set(Date.now());

    const announceActivity = () => {
      if (!activityCoordination) return;

      const now = Date.now();

      if (now - lastAnnouncedAt < announceInterval) return;

      lastAnnouncedAt = now;
      activityCoordination.announce();
    };

    const resetTimer = () => {
      markActive();
      announceActivity();
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

    // Activity from another tab is never announced onwards - two tabs would echo one keystroke back
    // and forth for as long as they are both open.
    const remoteActivitySubscription = activityCoordination?.activity$.subscribe(() => {
      if (enabled() && context.accessToken()) {
        markActive();
      }
    });

    const isIdle = () => Date.now() - lastActivityTime() >= inactivityTimeout;

    // Driven off `lastActivityTime` rather than off the activity stream, so the countdown this feature
    // reports and the logout it performs cannot disagree: a tab that has seen no event still has a
    // deadline, and `resetTimer()` postpones the logout it says it resets.
    //
    // `isIdle` re-checks at the moment the deadline fires, because the re-arm goes through an effect:
    // activity recorded in the same tick as the old deadline has not moved it yet. The write that was
    // missed is what schedules that re-arm, so nothing is dropped by waiting for it.
    const inactivityLogout$ = toObservable(lastActivityTime).pipe(
      switchMap((last) => timer(last + inactivityTimeout - Date.now())),
      filter(() => enabled() && !!context.accessToken() && isIdle()),
    );

    const logoutSubscription = inactivityLogout$.subscribe(() => {
      context.logout('inactivity');
    });

    let hadToken = false;

    // Only the start of a session counts as activity. A token _refresh_ is the app working, not the
    // user, and resetting on one would mean an app that refreshes faster than this timeout never logs
    // an idle user out at all.
    effect(() => {
      const hasToken = !!context.accessToken();

      if (hasToken && !hadToken) {
        markActive();
      }

      hadToken = hasToken;
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

    destroyRef.onDestroy(() => {
      activitySubscription.unsubscribe();
      remoteActivitySubscription?.unsubscribe();
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
      devtools: () => [
        { label: 'timeout', value: formatQueryDevtoolsDuration(inactivityTimeout) },
        { label: 'activity events', value: activityEvents.join(', ') },
        { label: 'idleness', value: activityCoordination ? 'shared across tabs' : 'this tab only' },
        ...(config.customActivityCheck ? [{ label: 'custom activity check', value: 'yes' }] : []),
      ],
    };
  };
};
