import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { NotificationConfig, provideNotificationManagerConfig } from './notification-config';
import { provideNotificationLabels } from './notification-labels';
import { NotificationPauseReason, NotificationRef, createNotificationRef } from './notification-ref';
import { NotificationComponent } from './notification.component';

describe('NotificationComponent', () => {
  let fixture: ComponentFixture<NotificationComponent>;
  let host: HTMLElement;
  let ref: NotificationRef;
  let dismissCalls: number;
  let pauseReasons: (NotificationPauseReason | undefined)[];
  let resumeReasons: (NotificationPauseReason | undefined)[];

  beforeEach(() => {
    dismissCalls = 0;
    pauseReasons = [];
    resumeReasons = [];

    TestBed.configureTestingModule({
      imports: [NotificationComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        }),
        provideNotificationLabels({ dismiss: 'Close notification' }),
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
    ref.pauseTimer = (reason) => {
      pauseReasons.push(reason);
      pauseTimer(reason);
    };

    const resumeTimer = ref.resumeTimer;
    ref.resumeTimer = (reason) => {
      resumeReasons.push(reason);
      resumeTimer(reason);
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

  it('pauses and resumes the timer per reason on pointer and focus transitions', () => {
    host.dispatchEvent(new Event('mouseenter'));
    host.dispatchEvent(new Event('focusin'));
    host.dispatchEvent(new Event('mouseleave'));
    host.dispatchEvent(new Event('focusout'));

    expect(pauseReasons).toEqual(['hover', 'focus']);
    expect(resumeReasons).toEqual(['hover', 'focus']);
  });

  it('uses the configured dismiss label on the dismiss button', () => {
    expect(host.querySelector('.et-notification-dismiss-btn')?.getAttribute('aria-label')).toBe('Close notification');
  });

  it('renders the status icon, hidden from assistive tech', () => {
    const icon = host.querySelector('.et-notification-icon');

    expect(icon?.classList).toContain('et-icon--et-triangle-exclamation');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('icons', () => {
    const renderWith = (config: Partial<NotificationConfig>) => {
      const iconRef = createNotificationRef(
        { status: 'success', title: 'Saved', ...config },
        { managerConfig: { position: 'bottom-end', maxVisible: 3, defaultDuration: {} } },
      );

      const iconFixture = TestBed.createComponent(NotificationComponent);
      iconFixture.componentRef.setInput('ref', iconRef);
      iconFixture.detectChanges();

      return iconFixture.nativeElement as HTMLElement;
    };

    it('takes the icon from the status', () => {
      expect(renderWith({}).querySelector('.et-notification-icon')?.classList).toContain('et-icon--et-circle-check');
    });

    it('lets the notification name its own icon', () => {
      expect(renderWith({ icon: 'et-times' }).querySelector('.et-notification-icon')?.classList).toContain(
        'et-icon--et-times',
      );
    });

    it('renders no icon at all for `icon: null`', () => {
      expect(renderWith({ icon: null }).querySelector('.et-notification-icon')).toBeNull();
    });

    it('renders the spinner for a loading notification, and an icon in its place when one is named', () => {
      expect(renderWith({ status: 'loading' }).querySelector('et-spinner')).not.toBeNull();
      expect(renderWith({ status: 'loading' }).querySelector('.et-notification-icon')).toBeNull();

      const withIcon = renderWith({ status: 'loading', icon: 'et-circle-info' });

      expect(withIcon.querySelector('et-spinner')).toBeNull();
      expect(withIcon.querySelector('.et-notification-icon')).not.toBeNull();
    });
  });

  describe('auto-dismiss hold', () => {
    let timedRef: NotificationRef;
    let timedHost: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

      timedRef = createNotificationRef(
        { status: 'info', title: 'Saved', duration: 4000 },
        { managerConfig: { position: 'bottom-end', maxVisible: 3, defaultDuration: {} } },
      );

      const timedFixture = TestBed.createComponent(NotificationComponent);
      timedFixture.componentRef.setInput('ref', timedRef);
      timedFixture.detectChanges();
      timedHost = timedFixture.nativeElement;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('dismisses itself once the duration is up', () => {
      vi.advanceTimersByTime(4000);

      expect(timedRef.entry().isDismissing).toBe(true);
    });

    it('keeps holding after the pointer leaves while focus is still inside', () => {
      timedHost.dispatchEvent(new Event('mouseenter'));
      timedHost.dispatchEvent(new Event('focusin'));
      timedHost.dispatchEvent(new Event('mouseleave'));

      vi.advanceTimersByTime(5000);

      expect(timedRef.entry().isDismissing).toBe(false);

      timedHost.dispatchEvent(new Event('focusout'));
      vi.advanceTimersByTime(4000);

      expect(timedRef.entry().isDismissing).toBe(true);
    });

    it('keeps holding after a click released the gesture while the pointer is still over it', () => {
      timedHost.dispatchEvent(new Event('mouseenter'));
      timedRef.pauseTimer('gesture');
      timedRef.resumeTimer('gesture');

      vi.advanceTimersByTime(5000);

      expect(timedRef.entry().isDismissing).toBe(false);
    });

    it('keeps holding when the config changes while it is held', () => {
      timedHost.dispatchEvent(new Event('mouseenter'));
      timedRef.update({ title: 'Saved again' });

      vi.advanceTimersByTime(5000);

      expect(timedRef.entry().isDismissing).toBe(false);
    });
  });

  describe('secondary action', () => {
    it('renders both actions and runs the one that was clicked', () => {
      const handlers = { primary: vi.fn(), secondary: vi.fn() };
      const pairRef = createNotificationRef(
        {
          status: 'info',
          title: 'Delete file?',
          action: { label: 'Delete', handler: handlers.primary },
          secondaryAction: { label: 'Keep', handler: handlers.secondary, dismiss: false },
        },
        { managerConfig: { position: 'bottom-end', maxVisible: 3, defaultDuration: {} } },
      );

      const pairFixture = TestBed.createComponent(NotificationComponent);
      pairFixture.componentRef.setInput('ref', pairRef);
      pairFixture.detectChanges();

      const buttons = (pairFixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.et-notification-footer button',
      );

      expect([...buttons].map((button) => button.textContent?.trim())).toEqual(['Delete', 'Keep']);

      // `dismiss: false` keeps the notification up - the action is not done with it.
      buttons[1]!.click();
      pairFixture.detectChanges();

      expect(handlers.secondary).toHaveBeenCalledTimes(1);
      expect(pairRef.entry().isDismissing).toBe(false);

      buttons[0]!.click();
      pairFixture.detectChanges();

      expect(handlers.primary).toHaveBeenCalledTimes(1);
      expect(pairRef.entry().isDismissing).toBe(true);
    });
  });
});
