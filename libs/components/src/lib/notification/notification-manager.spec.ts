import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideNotificationManagerConfig } from './notification-config';
import {
  NotificationManager,
  injectNotificationManager,
  provideNotificationManagerInstance,
} from './notification-manager';

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideNotificationManagerConfig({ maxVisible: 3, defaultDuration: { success: 0, info: 0, error: 0 } }),
        ...provideNotificationManagerInstance(),
      ],
    });

    manager = TestBed.runInInjectionContext(() => injectNotificationManager());
  });

  it('stacks notifications that carry no id', () => {
    manager.open({ status: 'info', title: 'One' });
    manager.open({ status: 'info', title: 'Two' });

    expect(manager.notifications().length).toBe(2);
  });

  it('replaces a live notification that shares its id instead of stacking a duplicate', () => {
    const first = manager.open({ status: 'loading', title: 'Uploading…', id: 'upload', message: 'Hold on' });
    const second = manager.open({ status: 'error', title: 'Upload failed', id: 'upload' });

    expect(second).toBe(first);
    expect(manager.notifications().length).toBe(1);
    expect(first.entry().config).toEqual({ status: 'error', title: 'Upload failed', id: 'upload' });
  });

  it('takes the id as the ref id, so repeated opens can be found by it', () => {
    expect(manager.open({ status: 'info', title: 'One', id: 'my-toast' }).id).toBe('my-toast');
  });

  it('drops a same-id notification that is already leaving rather than let the two coexist', () => {
    const leaving = manager.open({ status: 'info', title: 'One', id: 'my-toast' });
    leaving.dismiss();

    const replacement = manager.open({ status: 'info', title: 'Two', id: 'my-toast' });

    expect(replacement).not.toBe(leaving);
    expect(manager.notifications()).toEqual([replacement]);
    expect(leaving.entry().isDismissed).toBe(true);
  });

  it('dismisses the oldest notification once the visible cap is reached', () => {
    const first = manager.open({ status: 'info', title: 'One' });
    manager.open({ status: 'info', title: 'Two' });
    manager.open({ status: 'info', title: 'Three' });

    expect(first.entry().isDismissing).toBe(false);

    manager.open({ status: 'info', title: 'Four' });

    expect(first.entry().isDismissing).toBe(true);
  });
});
