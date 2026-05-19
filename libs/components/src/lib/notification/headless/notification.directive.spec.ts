import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { createNotificationRef, NotificationRef } from '../notification-ref';
import { NotificationActionDirective } from './notification-action.directive';
import { NotificationDismissDirective } from './notification-dismiss.directive';
import { NotificationDirective } from './notification.directive';

@Component({
  template: `
    <div [ref]="ref" etNotification>
      <button etNotificationAction type="button">Retry</button>
      <button etNotificationDismiss type="button">Dismiss</button>
    </div>
  `,
  imports: [NotificationDirective, NotificationActionDirective, NotificationDismissDirective],
})
class NotificationDirectiveTestHost {
  ref!: NotificationRef;
}

describe('NotificationDirective', () => {
  let fixture: ComponentFixture<NotificationDirectiveTestHost>;
  let ref: NotificationRef;
  let actionHandler: () => void;

  beforeEach(() => {
    actionHandler = vi.fn() as unknown as () => void;
    ref = createNotificationRef(
      {
        status: 'info',
        title: 'Saved',
        action: { label: 'Retry', handler: actionHandler },
      },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          dismissLabel: 'Dismiss',
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        },
      },
    );

    TestBed.configureTestingModule({
      imports: [NotificationDirectiveTestHost],
    });

    fixture = TestBed.createComponent(NotificationDirectiveTestHost);
    fixture.componentInstance.ref = ref;
    fixture.detectChanges();
  });

  it('registers the action and dismiss directives on the notification', () => {
    const notificationDirective = fixture.debugElement
      .query(By.directive(NotificationDirective))
      .injector.get(NotificationDirective);
    const actionDirective = fixture.debugElement
      .query(By.directive(NotificationActionDirective))
      .injector.get(NotificationActionDirective);
    const dismissDirective = fixture.debugElement
      .query(By.directive(NotificationDismissDirective))
      .injector.get(NotificationDismissDirective);

    expect(notificationDirective.registeredAction()).toBe(actionDirective);
    expect(notificationDirective.registeredDismiss()).toBe(dismissDirective);
  });

  it('runs the configured action handler and dismisses the notification on action click', () => {
    const actionButton = fixture.nativeElement.querySelector('[etnotificationaction]') as HTMLButtonElement;

    actionButton.click();
    fixture.detectChanges();

    expect(actionHandler).toHaveBeenCalledTimes(1);
    expect(ref.entry().isDismissed).toBe(true);
  });

  it('dismisses the notification on dismiss click', () => {
    const dismissButton = fixture.nativeElement.querySelector('[etnotificationdismiss]') as HTMLButtonElement;

    dismissButton.click();
    fixture.detectChanges();

    expect(ref.entry().isDismissed).toBe(true);
  });
});
