import { InjectionToken, Signal } from '@angular/core';
import { NotificationManagerConfig } from './notification-config';
import { NotificationRef } from './notification-ref';

export type NotificationStackContext = {
  visibleNotifications: Signal<NotificationRef[]>;
  position: NotificationManagerConfig['position'];
  /** @internal Set by the stack component. Called by the manager before any mutation. */
  captureBeforeState: (() => void) | null;
};

export const NOTIFICATION_STACK_CONTEXT_TOKEN = new InjectionToken<NotificationStackContext>(
  'NOTIFICATION_STACK_CONTEXT_TOKEN',
);
