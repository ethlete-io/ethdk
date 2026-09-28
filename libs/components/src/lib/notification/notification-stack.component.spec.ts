import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_OVERLAY_LAYER } from '@ethlete/core';
import { vi } from 'vitest';
import '../../test-helpers';
import { provideNotificationManagerConfig } from './notification-config';
import { createNotificationRef, NotificationRef } from './notification-ref';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationStackComponent } from './notification-stack.component';

describe('NotificationStackComponent', () => {
  let fixture: ComponentFixture<NotificationStackComponent>;
  let host: HTMLElement;
  let visibleNotifications: ReturnType<typeof signal<NotificationRef[]>>;
  let mockContext: { captureBeforeState: (() => void) | null };

  beforeEach(() => {
    visibleNotifications = signal<NotificationRef[]>([]);

    const context = {
      visibleNotifications,
      position: 'bottom-end' as const,
      captureBeforeState: null,
    };

    mockContext = context;

    TestBed.configureTestingModule({
      imports: [NotificationStackComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
        }),
        { provide: NOTIFICATION_STACK_CONTEXT_TOKEN, useValue: context },
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

  it('paints one level above the overlay layer, and declares it', () => {
    fixture.detectChanges();

    expect(host.getAttribute('data-et-overlay-layer')).toBe(`${DEFAULT_OVERLAY_LAYER + 1}`);
    expect(host.style.getPropertyValue('--_et-notification-stack-layer')).toBe(`${DEFAULT_OVERLAY_LAYER + 1}`);
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

  describe('resize FLIP', () => {
    let itemHeight: number;

    const mountResizableItem = () => {
      visibleNotifications.set([createRef('First')]);
      fixture.detectChanges();

      const item = host.querySelector('[data-notification-id]') as HTMLElement;

      item.getBoundingClientRect = () => ({ top: 0, left: 0, width: 300, height: itemHeight }) as DOMRect;

      return item;
    };

    const resizeTo = (height: number) => {
      mockContext.captureBeforeState?.();
      itemHeight = height;
      fixture.detectChanges();
      vi.advanceTimersToNextFrame();
    };

    beforeEach(() => {
      vi.useFakeTimers();
      itemHeight = 50;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps a newer resize when an older one finishes inside its window', () => {
      const item = mountResizableItem();

      resizeTo(80);
      expect(item.style.height).toBe('80px');

      vi.advanceTimersByTime(100);
      itemHeight = 65;
      resizeTo(100);

      vi.advanceTimersByTime(150);
      expect(item.style.height).toBe('100px');

      vi.advanceTimersByTime(100);
      expect(item.style.height).toBe('');
    });

    it('does not animate under prefers-reduced-motion', () => {
      const matchMedia = vi
        .spyOn(window, 'matchMedia')
        .mockImplementation((query: string) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList);

      try {
        const item = mountResizableItem();

        resizeTo(80);

        expect(item.style.height).toBe('');
        expect(item.style.transition).toBe('');
      } finally {
        matchMedia.mockRestore();
      }
    });
  });
});
