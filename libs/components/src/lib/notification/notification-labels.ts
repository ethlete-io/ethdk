import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings a notification renders itself. Its message and actions are yours; dismissal is its own. */
export type NotificationLabels = {
  /** Accessible label for a notification's dismiss button. */
  dismiss: string;
};

/** The built-in English labels. */
export const DEFAULT_NOTIFICATION_LABELS: NotificationLabels = {
  dismiss: 'Dismiss',
};

const NOTIFICATION_LABELS_DEF = /* @__PURE__ */ defineLabels<NotificationLabels>(
  'NOTIFICATION_LABELS',
  DEFAULT_NOTIFICATION_LABELS,
);

/**
 * Localize a notification's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_NOTIFICATION_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideNotificationLabels({ dismiss: 'Schließen' });
 */
export const provideNotificationLabels = /* @__PURE__ */ toProvideFn(NOTIFICATION_LABELS_DEF);
export const injectNotificationLabels = /* @__PURE__ */ toInjectFn(NOTIFICATION_LABELS_DEF);
export const NOTIFICATION_LABELS = /* @__PURE__ */ toToken(NOTIFICATION_LABELS_DEF);
