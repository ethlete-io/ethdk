import { createStaticRootProvider } from '@ethlete/core';

export const NOTIFICATION_STATUS = {
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
} as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

export type NotificationAction = {
  label: string;
  handler: () => void;
};

export type NotificationConfig = {
  status: NotificationStatus;
  title: string;
  message?: string;
  action?: NotificationAction;
  /**
   * Auto-dismiss duration in milliseconds.
   * `0` or `undefined` uses the manager's `defaultDuration` for the current status.
   * Set explicitly to override the default (e.g. `duration: 0` to prevent auto-dismiss
   * for a status that defaults to non-zero).
   */
  duration?: number;
  /** Optional progress value (0–100). When set, a progress bar is shown below the notification body. */
  progress?: number;
};

export type NotificationManagerConfig = {
  /** Position of the notification stack on screen. @default 'bottom-end' */
  position: 'bottom-center' | 'bottom-start' | 'bottom-end' | 'top-center' | 'top-start' | 'top-end';
  /** Maximum number of simultaneously visible notifications. @default 3 */
  maxVisible: number;
  /**
   * Default auto-dismiss duration (ms) per status.
   * `0` means no auto-dismiss.
   * @default `{ success: 4000, info: 4000, loading: 0, error: 0 }`
   */
  defaultDuration: Partial<Record<NotificationStatus, number>>;
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
};

export const [provideNotificationManagerConfig, injectNotificationManagerConfig] = createStaticRootProvider(
  DEFAULT_NOTIFICATION_MANAGER_CONFIG,
  { name: 'NotificationManagerConfig' },
);
