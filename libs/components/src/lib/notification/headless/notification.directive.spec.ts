import { Component } from '@angular/core';
import { AnimatedLifecycleDirective } from '@ethlete/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

@Component({
  template: `<div [ref]="ref" etNotification etAnimatedLifecycle></div>`,
  imports: [NotificationDirective, AnimatedLifecycleDirective],
})
class AnimatedNotificationTestHost {
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

  it('starts the enter animation of an animated lifecycle on the same element', async () => {
    const animatedFixture = TestBed.createComponent(AnimatedNotificationTestHost);
    animatedFixture.componentInstance.ref = ref;
    animatedFixture.detectChanges();
    await animatedFixture.whenStable();

    const host = animatedFixture.nativeElement.querySelector('[etnotification]') as HTMLElement;

    expect(host.classList.contains('et-force-invisible')).toBe(false);
  });
});
