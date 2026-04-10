import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { NOTIFICATION_ERROR_CODES } from '../notification-errors';
import { NotificationDirective } from './notification.directive';

@Directive({
  selector: '[etNotificationDismiss]',
  exportAs: 'etNotificationDismiss',
  host: {
    '(click)': 'handleClick()',
  },
})
export class NotificationDismissDirective {
  private notification = inject(NotificationDirective, { optional: true });

  constructor() {
    this.notification?.registeredDismiss.set(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.notification) {
          throw new RuntimeError(
            NOTIFICATION_ERROR_CODES.DISMISS_OUTSIDE_NOTIFICATION,
            '[EtNotificationDismissDirective] etNotificationDismiss must be placed inside an [etNotification] element.',
          );
        }
      });
    }
  }

  handleClick() {
    this.notification?.ref().dismiss();
  }
}
