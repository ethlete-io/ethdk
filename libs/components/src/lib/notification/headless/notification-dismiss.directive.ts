import { Directive, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { NOTIFICATION_ERROR_CODES } from '../notification-errors';
import { NotificationDirective } from './notification.directive';

@Directive({
  selector: '[etNotificationDismiss]',
  exportAs: 'etNotificationDismiss',
  host: {
    '(click)': 'dismiss()',
  },
})
export class NotificationDismissDirective {
  private notification = inject(NotificationDirective, { optional: true });
  private readonly hostElement = injectHostElement();

  constructor() {
    this.notification?.registeredDismiss.set(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.notification) {
          throw new RuntimeError(
            NOTIFICATION_ERROR_CODES.DISMISS_OUTSIDE_NOTIFICATION,
            '[EtNotificationDismissDirective] etNotificationDismiss must be placed inside an [etNotification] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  public dismiss() {
    this.notification?.ref().dismiss();
  }
}
