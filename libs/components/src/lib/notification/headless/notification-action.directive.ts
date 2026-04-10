import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { NOTIFICATION_ERROR_CODES } from '../notification-errors';
import { NotificationDirective } from './notification.directive';

@Directive({
  selector: '[etNotificationAction]',
  exportAs: 'etNotificationAction',
  host: {
    '(click)': 'runAction()',
  },
})
export class NotificationActionDirective {
  private notification = inject(NotificationDirective, { optional: true });

  constructor() {
    this.notification?.registeredAction.set(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.notification) {
          throw new RuntimeError(
            NOTIFICATION_ERROR_CODES.ACTION_OUTSIDE_NOTIFICATION,
            '[EtNotificationActionDirective] etNotificationAction must be placed inside an [etNotification] element.',
          );
        }
      });
    }
  }

  runAction() {
    this.notification?.action()?.handler();
    this.notification?.ref().dismiss();
  }
}
