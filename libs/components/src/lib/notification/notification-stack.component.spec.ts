import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideNotificationManagerConfig } from './notification-config';
import { createNotificationRef, NotificationRef } from './notification-ref';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationStackComponent } from './notification-stack.component';

describe('NotificationStackComponent', () => {
  let fixture: ComponentFixture<NotificationStackComponent>;
  let host: HTMLElement;
  let visibleNotifications: ReturnType<typeof signal<NotificationRef[]>>;

  beforeEach(() => {
    visibleNotifications = signal<NotificationRef[]>([]);

    const mockContext = {
      visibleNotifications,
      position: 'bottom-end' as const,
      captureBeforeState: null,
    };

    TestBed.configureTestingModule({
      imports: [NotificationStackComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'bottom-end',
          maxVisible: 3,
          dismissLabel: 'Dismiss',
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        }),
        { provide: NOTIFICATION_STACK_CONTEXT_TOKEN, useValue: mockContext },
      ],
    });
    fixture = TestBed.createComponent(NotificationStackComponent);
    host = fixture.nativeElement;
  });

  const createRef = (title: string) => {
    return createNotificationRef(
      {
        status: 'info',
        title,
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
  };

  it('has role="log"', () => {
    fixture.detectChanges();
    expect(host.getAttribute('role')).toBe('log');
  });

  it('has aria-live="polite"', () => {
    fixture.detectChanges();
    expect(host.getAttribute('aria-live')).toBe('polite');
  });

  it('has aria-relevant="additions"', () => {
    fixture.detectChanges();
    expect(host.getAttribute('aria-relevant')).toBe('additions');
  });

  it('renders the visible notifications in context order for bottom stacks', () => {
    visibleNotifications.set([createRef('First'), createRef('Second')]);
    fixture.detectChanges();

    const titles = Array.from(host.querySelectorAll('.et-notification-title')).map((el) => el.textContent?.trim());
    const itemIds = Array.from(host.querySelectorAll('[data-notification-id]')).map((el) =>
      el.getAttribute('data-notification-id'),
    );

    expect(titles).toEqual(['First', 'Second']);
    expect(itemIds).toHaveLength(2);
  });

  it('reverses the visible notification order for top-position stacks', () => {
    const topContext = {
      visibleNotifications,
      position: 'top-end' as const,
      captureBeforeState: null,
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NotificationStackComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'top-end',
          maxVisible: 3,
          dismissLabel: 'Dismiss',
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        }),
        { provide: NOTIFICATION_STACK_CONTEXT_TOKEN, useValue: topContext },
      ],
    });

    fixture = TestBed.createComponent(NotificationStackComponent);
    host = fixture.nativeElement;

    visibleNotifications.set([createRef('First'), createRef('Second')]);
    fixture.detectChanges();

    const titles = Array.from(host.querySelectorAll('.et-notification-title')).map((el) => el.textContent?.trim());

    expect(host.getAttribute('data-position')).toBe('top-end');
    expect(titles).toEqual(['Second', 'First']);
  });
});
