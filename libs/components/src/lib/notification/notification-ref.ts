import { signal } from '@angular/core';
import { Subject, Subscription, tap, timer } from 'rxjs';
import { NotificationConfig, NotificationManagerConfig, NotificationStatus } from './notification-config';

export type NotificationEntry = {
  id: string;
  config: NotificationConfig;
  isDismissing: boolean;
  isDismissed: boolean;
};

const ID_PREFIX = 'et-notification-';
let uniqueId = 0;

export const createNotificationRef = (
  config: NotificationConfig,
  { managerConfig, beforeChange }: { managerConfig: NotificationManagerConfig; beforeChange?: () => void },
) => {
  const id = `${ID_PREFIX}${uniqueId++}`;

  const entryState = signal<NotificationEntry>({
    id,
    config,
    isDismissing: false,
    isDismissed: false,
  });

  const afterDismissedSubject$ = new Subject<void>();
  let timerSubscription: Subscription | null = null;

  const getEffectiveDuration = (cfg: NotificationConfig) => {
    if (cfg.duration !== undefined) return cfg.duration;
    return managerConfig.defaultDuration[cfg.status as NotificationStatus] ?? 0;
  };

  const startTimer = (cfg: NotificationConfig) => {
    timerSubscription?.unsubscribe();
    timerSubscription = null;

    const duration = getEffectiveDuration(cfg);
    if (!duration) return;

    timerSubscription = timer(duration)
      .pipe(tap(() => dismiss()))
      .subscribe();
  };

  const update = (partial: Partial<NotificationConfig>) => {
    const current = entryState().config;

    const mightResize =
      ('status' in partial && partial.status !== current.status) ||
      ('title' in partial && partial.title !== current.title) ||
      ('message' in partial && partial.message !== current.message) ||
      ('action' in partial && partial.action !== current.action) ||
      ('progress' in partial && (partial.progress === undefined) !== (current.progress === undefined));

    if (mightResize) beforeChange?.();

    const needsDurationReset =
      partial.status !== undefined && partial.status !== current.status && !('duration' in partial);

    const base: NotificationConfig = needsDurationReset ? { ...current, duration: undefined } : current;
    const updated: NotificationConfig = { ...base, ...partial };

    entryState.update((e) => ({ ...e, config: updated }));
    startTimer(updated);
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
    dismiss,
    afterDismissed,
    markDismissed,
  };
};

export type NotificationRef = ReturnType<typeof createNotificationRef>;
