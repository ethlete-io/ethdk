import { Directive, afterNextRender, computed, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
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

  /** Which action this element runs — `etNotificationAction="secondary"` for the quieter one. */
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
    this.notification?.registeredActions.update((actions) => [...actions, this]);

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

  public runAction() {
    const action = this.action();

    action?.handler();

    // Dismissing is the default for an action: acting on a notification is done with it. Only an
    // action that says otherwise leaves it up (e.g. one that starts a retry it wants to report on).
    if (action?.dismiss !== false) {
      this.notification?.ref().dismiss();
    }
  }
}
