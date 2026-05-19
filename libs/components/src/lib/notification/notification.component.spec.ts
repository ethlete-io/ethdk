import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideNotificationManagerConfig } from './notification-config';
import { NotificationRef, createNotificationRef } from './notification-ref';
import { NotificationComponent } from './notification.component';

describe('NotificationComponent', () => {
  let fixture: ComponentFixture<NotificationComponent>;
  let host: HTMLElement;
  let ref: NotificationRef;
  let dismissCalls: number;
  let pauseTimerCalls: number;
  let resumeTimerCalls: number;

  beforeEach(() => {
    dismissCalls = 0;
    pauseTimerCalls = 0;
    resumeTimerCalls = 0;

    TestBed.configureTestingModule({
      imports: [NotificationComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'bottom-end',
          maxVisible: 3,
          dismissLabel: 'Close notification',
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        }),
      ],
    });

    ref = createNotificationRef(
      {
        status: 'error',
        title: 'Upload failed',
        message: 'Please try again.',
        progress: 42,
        action: { label: 'Retry', handler: () => undefined },
      },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          dismissLabel: 'Close notification',
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        },
      },
    );

    const dismiss = ref.dismiss;
    ref.dismiss = () => {
      dismissCalls += 1;
      dismiss();
    };

    const pauseTimer = ref.pauseTimer;
    ref.pauseTimer = () => {
      pauseTimerCalls += 1;
      pauseTimer();
    };

    const resumeTimer = ref.resumeTimer;
    ref.resumeTimer = () => {
      resumeTimerCalls += 1;
      resumeTimer();
    };

    fixture = TestBed.createComponent(NotificationComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  it('renders the message, action, and progress bar from the notification ref', () => {
    expect(host.querySelector('.et-notification-message')?.textContent).toContain('Please try again.');
    expect(host.querySelector('et-progress-bar')).not.toBeNull();
    expect(host.querySelector('.et-notification-footer button')?.textContent).toContain('Retry');
  });

  it('reflects error notifications as alert semantics', () => {
    expect(host.getAttribute('data-status')).toBe('error');
    expect(host.getAttribute('role')).toBe('alert');
  });

  it('dismisses the notification on Escape', () => {
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(dismissCalls).toBe(1);
    expect(ref.entry().isDismissing).toBe(true);
  });

  it('pauses and resumes the timer on pointer and focus transitions', () => {
    host.dispatchEvent(new Event('mouseenter'));
    host.dispatchEvent(new Event('focusin'));
    host.dispatchEvent(new Event('mouseleave'));
    host.dispatchEvent(new Event('focusout'));

    expect(pauseTimerCalls).toBe(2);
    expect(resumeTimerCalls).toBe(2);
  });

  it('uses the configured dismiss label on the dismiss button', () => {
    expect(host.querySelector('.et-notification-dismiss-btn')?.getAttribute('aria-label')).toBe('Close notification');
  });
});
