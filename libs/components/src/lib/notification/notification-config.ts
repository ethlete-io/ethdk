import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

export const NOTIFICATION_STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
} as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

export const NOTIFICATION_ACTION_SLOTS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
} as const;

/** Which of a notification's two actions an action element stands for. */
export type NotificationActionSlot = (typeof NOTIFICATION_ACTION_SLOTS)[keyof typeof NOTIFICATION_ACTION_SLOTS];

export type NotificationAction = {
  label: string;
  handler: () => void;
  /**
   * Whether clicking the action dismisses the notification.
   * @default true
   */
  dismiss?: boolean;
};

export type NotificationConfig = {
  status: NotificationStatus;
  title: string;
  message?: string;
  action?: NotificationAction;
  /** A second, quieter action rendered next to {@link NotificationConfig.action} (e.g. a cancel next to a confirm). */
  secondaryAction?: NotificationAction;
  /**
   * Auto-dismiss duration in milliseconds.
   * `0` or `undefined` uses the manager's `defaultDuration` for the current status.
   * Set explicitly to override the default (e.g. `duration: 0` to prevent auto-dismiss
   * for a status that defaults to non-zero).
   */
  duration?: number;
  /** Optional progress value (0–100). When set, a progress bar is shown below the notification body. */
  progress?: number;
  /**
   * Identity of the notification. Opening a notification whose id matches one that is still on
   * screen replaces that one in place instead of stacking a duplicate - the way to keep repeated
   * clicks, retries or a per-entity notification down to a single toast.
   *
   * Defaults to a generated id, which is never equal to another notification's.
   */
  id?: string;
  /**
   * Icon name rendered in front of the title, overriding the default for the notification's status.
   * `null` renders no icon at all. Names must be registered with the icon registry - the built-in
   * `et-*` set is, and `provideIconOverrides()` takes both replacements and brand-new names.
   *
   * A `loading` notification shows its spinner unless this names an icon.
   */
  icon?: string | null;
};

/**
 * The content half of a {@link NotificationConfig} - everything except the `status`, which is
 * decided by whatever opens the notification (see `NotificationManager.promise`).
 */
export type NotificationContentInit = Omit<NotificationConfig, 'status'>;

/** A {@link NotificationContentInit}, or just a string to use as the title. */
export type NotificationContentInput = NotificationContentInit | string;

/** Normalizes the string shorthand of a {@link NotificationContentInput}. */
export const toNotificationContent = (content: NotificationContentInput): NotificationContentInit =>
  typeof content === 'string' ? { title: content } : content;

export type NotificationManagerConfig = {
  /** Position of the notification stack on screen. @default 'bottom-end' */
  position: 'bottom-center' | 'bottom-start' | 'bottom-end' | 'top-center' | 'top-start' | 'top-end';
  /** Maximum number of simultaneously visible notifications, floored at `1`. @default 3 */
  maxVisible: number;
  /**
   * Default auto-dismiss duration (ms) per status.
   * `0` means no auto-dismiss.
   * @default `{ success: 4000, info: 4000, loading: 0, error: 0 }`
   */
  defaultDuration: Partial<Record<NotificationStatus, number>>;
  /**
   * Maps each notification status to a color key used by `ProvideColorDirective`.
   * When set, the notification host element receives the corresponding color class
   * so that `et-button` and other colored components render correctly inside the notification.
   */
  statusColorMapping?: Partial<Record<NotificationStatus, string>>;
  /**
   * Color key applied to control elements (e.g. the dismiss button).
   * Uses the notification's status color when not set.
   */
  controlsColor?: string;
  /**
   * Icon rendered per status, overridable per notification via {@link NotificationConfig.icon}.
   * `null` opts a status out of icons entirely. `loading` has none by default - it renders a spinner.
   * @default `{ success: 'et-circle-check', error: 'et-triangle-exclamation', info: 'et-circle-info', loading: null }`
   */
  statusIcons?: Partial<Record<NotificationStatus, string | null>>;
  /**
   * Whether a notification can be swiped away with a pointer or finger.
   * @default true
   */
  swipeToDismiss?: boolean;
};

export const DEFAULT_NOTIFICATION_STATUS_ICONS: Record<NotificationStatus, string | null> = {
  success: 'et-circle-check',
  error: 'et-triangle-exclamation',
  info: 'et-circle-info',
  loading: null,
};

/**
 * The icon a status renders when the notification itself doesn't name one. A partial `statusIcons`
 * map only speaks for the statuses it lists - the rest keep their {@link DEFAULT_NOTIFICATION_STATUS_ICONS}
 * icon, and a listed `null` opts that status out.
 */
export const resolveNotificationStatusIcon = (config: NotificationManagerConfig, status: NotificationStatus) => {
  const icons = config.statusIcons;

  return icons && status in icons ? (icons[status] ?? null) : DEFAULT_NOTIFICATION_STATUS_ICONS[status];
};

export const DEFAULT_NOTIFICATION_MANAGER_CONFIG: NotificationManagerConfig = {
  position: 'bottom-end',
  maxVisible: 3,
  defaultDuration: {
    success: 4000,
    info: 4000,
    loading: 0,
    error: 0,
  },
  statusColorMapping: undefined,
  controlsColor: undefined,
  statusIcons: DEFAULT_NOTIFICATION_STATUS_ICONS,
  swipeToDismiss: true,
};

const NOTIFICATION_MANAGER_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider(DEFAULT_NOTIFICATION_MANAGER_CONFIG, {
  name: 'NotificationManagerConfig',
});

export const provideNotificationManagerConfig = /* @__PURE__ */ toProvideFn(NOTIFICATION_MANAGER_CONFIG_DEF);
export const injectNotificationManagerConfig = /* @__PURE__ */ toInjectFn(NOTIFICATION_MANAGER_CONFIG_DEF);
