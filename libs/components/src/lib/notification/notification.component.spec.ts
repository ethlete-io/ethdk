import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideNotificationManagerConfig } from './notification-config';
import { NotificationRef, createNotificationRef } from './notification-ref';
import { NotificationComponent } from './notification.component';

describe('NotificationComponent', () => {
  let fixture: ComponentFixture<NotificationComponent>;
  let host: HTMLElement;
  let ref: NotificationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationComponent],
      providers: [
        provideNotificationManagerConfig({
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 4000, info: 4000, loading: 0, error: 0 },
        }),
      ],
    });
    fixture = TestBed.createComponent(NotificationComponent);
    host = fixture.nativeElement;
    ref = createNotificationRef(
      { status: 'success', title: 'Test' },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 4000 },
          dismissLabel: 'Dismiss',
        },
      },
    );
  });

  it('has et-notification class', () => {
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();
    expect(host.classList.contains('et-notification')).toBe(true);
  });
});
