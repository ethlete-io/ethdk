import { Directive, afterNextRender, computed, inject, input } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { NOTIFICATION_ACTION_SLOTS, NotificationActionSlot } from '../notification-config';
import { NOTIFICATION_ERROR_CODES } from '../notification-errors';
import { NotificationDirective } from './notification.directive';

/** Reads the attribute value, which is `''` when the directive is used as a bare attribute. */
const toActionSlot = (value: NotificationActionSlot | ''): NotificationActionSlot =>
  value === NOTIFICATION_ACTION_SLOTS.SECONDARY
    ? NOTIFICATION_ACTION_SLOTS.SECONDARY
    : NOTIFICATION_ACTION_SLOTS.PRIMARY;

@Directive({
  selector: '[etNotificationAction]',
  exportAs: 'etNotificationAction',
  host: {
    '(click)': 'runAction()',
  },
})
export class NotificationActionDirective {
  private notification = inject(NotificationDirective, { optional: true });
  private hostElement = injectHostElement();

  /** Which action this element runs - `etNotificationAction="secondary"` for the quieter one. */
  public actionSlot = input(NOTIFICATION_ACTION_SLOTS.PRIMARY, {
    alias: 'etNotificationAction',
    transform: toActionSlot,
  });

  public action = computed(() =>
    this.actionSlot() === NOTIFICATION_ACTION_SLOTS.SECONDARY
      ? this.notification?.secondaryAction()
      : this.notification?.action(),
  );

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.notification) {
          throw new RuntimeError(
            NOTIFICATION_ERROR_CODES.ACTION_OUTSIDE_NOTIFICATION,
            '[EtNotificationActionDirective] etNotificationAction must be placed inside an [etNotification] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  public runAction() {
    const action = this.action();

    action?.handler();

    if (action?.dismiss !== false) {
      this.notification?.ref().dismiss();
    }
  }
}
