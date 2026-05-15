import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationStackComponent } from './notification-stack.component';

describe('NotificationStackComponent', () => {
  let fixture: ComponentFixture<NotificationStackComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    const mockContext = {
      visibleNotifications: signal([]),
      position: 'bottom-end' as const,
      captureBeforeState: null,
    };

    TestBed.configureTestingModule({
      imports: [NotificationStackComponent],
      providers: [{ provide: NOTIFICATION_STACK_CONTEXT_TOKEN, useValue: mockContext }],
    });
    fixture = TestBed.createComponent(NotificationStackComponent);
    host = fixture.nativeElement;
  });

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

  it('has et-notification-stack class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-notification-stack')).toBe(true);
  });
});
