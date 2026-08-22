import { signal } from '@angular/core';
import { Subject, Subscription, tap, timer } from 'rxjs';
import { NotificationConfig, NotificationManagerConfig, NotificationStatus } from './notification-config';

export type NotificationEntry = {
  id: string;
  config: NotificationConfig;
  isDismissing: boolean;
  isDismissed: boolean;
};

/**
 * Why a notification's auto-dismiss timer is held. The built-in ones are the pointer over the toast
 * (`'hover'`), focus inside it (`'focus'`), a swipe in progress (`'gesture'`) and a bare
 * `pauseTimer()` call (`'api'`); a consumer may use any other string as its own key.
 */
export type NotificationPauseReason = 'hover' | 'focus' | 'gesture' | 'api' | (string & {});

const ID_PREFIX = 'et-notification-';
let uniqueId = 0;

export const createNotificationRef = (
  config: NotificationConfig,
  { managerConfig, beforeChange }: { managerConfig: NotificationManagerConfig; beforeChange?: () => void },
) => {
  const id = config.id ?? `${ID_PREFIX}${uniqueId++}`;

  const entryState = signal<NotificationEntry>({
    id,
    config,
    isDismissing: false,
    isDismissed: false,
  });

  const afterDismissedSubject$ = new Subject<void>();
  const pauseReasons = new Set<NotificationPauseReason>();
  let timerSubscription: Subscription | null = null;
  let timerStartedAt = 0;
  let remainingDuration = 0;

  const getEffectiveDuration = (cfg: NotificationConfig) => {
    if (cfg.duration !== undefined) return cfg.duration;
    return managerConfig.defaultDuration[cfg.status as NotificationStatus] ?? 0;
  };

  const startTimer = (cfg: NotificationConfig) => {
    timerSubscription?.unsubscribe();
    timerSubscription = null;

    const duration = getEffectiveDuration(cfg);
    if (!duration) return;

    remainingDuration = duration;
    timerStartedAt = Date.now();

    // A config change while the toast is held (a progress update under the pointer) re-arms the
    // countdown but must not un-hold it - the reasons for the hold have not gone anywhere.
    if (pauseReasons.size > 0) return;

    timerSubscription = timer(duration)
      .pipe(tap(() => dismiss()))
      .subscribe();
  };

  /**
   * Holds the auto-dismiss countdown until every reason that asked for it has released it, so a
   * toast the pointer left but the keyboard is still in does not dismiss itself. Pass the same
   * `reason` to {@link resumeTimer}.
   */
  const pauseTimer = (reason: NotificationPauseReason = 'api') => {
    pauseReasons.add(reason);

    if (!timerSubscription || remainingDuration <= 0) return;

    const elapsed = Date.now() - timerStartedAt;
    remainingDuration = Math.max(0, remainingDuration - elapsed);

    timerSubscription.unsubscribe();
    timerSubscription = null;
  };

  /** Releases one {@link pauseTimer} reason. The countdown resumes once the last one is gone. */
  const resumeTimer = (reason: NotificationPauseReason = 'api') => {
    pauseReasons.delete(reason);

    if (pauseReasons.size > 0 || timerSubscription || remainingDuration <= 0) return;

    timerStartedAt = Date.now();

    timerSubscription = timer(remainingDuration)
      .pipe(tap(() => dismiss()))
      .subscribe();
  };

  /** Whether swapping `current` for `next` can change the notification's box, and thus needs a FLIP capture. */
  const mightResize = (next: NotificationConfig, current: NotificationConfig) =>
    next.status !== current.status ||
    next.title !== current.title ||
    next.message !== current.message ||
    next.action !== current.action ||
    next.secondaryAction !== current.secondaryAction ||
    (next.progress === undefined) !== (current.progress === undefined);

  const applyConfig = (next: NotificationConfig) => {
    const current = entryState().config;

    if (mightResize(next, current)) beforeChange?.();

    entryState.update((e) => ({ ...e, config: next }));
    startTimer(next);
  };

  const update = (partial: Partial<NotificationConfig>) => {
    const current = entryState().config;

    const needsDurationReset =
      partial.status !== undefined && partial.status !== current.status && !('duration' in partial);

    const base: NotificationConfig = needsDurationReset ? { ...current, duration: undefined } : current;

    applyConfig({ ...base, ...partial });
  };

  /**
   * @internal Swaps the whole config, so keys the new one leaves out go back to unset - what an
   * `open()` that lands on a live id means, as opposed to {@link update}'s merge. Ignored once the
   * notification is on its way out: a dismissed notification stays dismissed.
   */
  const replaceConfig = (next: NotificationConfig) => {
    const entry = entryState();
    if (entry.isDismissing || entry.isDismissed) return;

    // Identity is the one thing a replacement cannot change - it is what found this notification.
    applyConfig({ ...next, id: entry.config.id });
  };

  const dismiss = () => {
    const entry = entryState();
    if (entry.isDismissing || entry.isDismissed) return;

    beforeChange?.();
    timerSubscription?.unsubscribe();
    timerSubscription = null;
    entryState.update((e) => ({ ...e, isDismissing: true }));
  };

  const afterDismissed = () => afterDismissedSubject$.asObservable();

  /** @internal Called by EtNotificationDirective after the leave animation completes. */
  const markDismissed = () => {
    beforeChange?.();
    entryState.update((e) => ({ ...e, isDismissed: true, isDismissing: false }));
    afterDismissedSubject$.next();
    afterDismissedSubject$.complete();
  };

  startTimer(config);

  return {
    id,
    entry: entryState.asReadonly(),
    update,
    replaceConfig,
    dismiss,
    pauseTimer,
    resumeTimer,
    afterDismissed,
    markDismissed,
  };
};

export type NotificationRef = ReturnType<typeof createNotificationRef>;
