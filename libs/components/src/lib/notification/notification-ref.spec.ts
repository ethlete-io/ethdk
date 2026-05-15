import '../../test-helpers';
import { createNotificationRef } from './notification-ref';

describe('createNotificationRef', () => {
  it('creates a ref with a unique ID', () => {
    const ref1 = createNotificationRef(
      { status: 'success', title: 'Test 1' },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 4000 },
          dismissLabel: 'Dismiss',
        },
      },
    );

    const ref2 = createNotificationRef(
      { status: 'success', title: 'Test 2' },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 4000 },
          dismissLabel: 'Dismiss',
        },
      },
    );

    expect(ref1.id).not.toBe(ref2.id);
    expect(ref1.id).toMatch(/^et-notification-\d+$/);
  });

  it('exposes entry signal with config', () => {
    const config = { status: 'success' as const, title: 'Test' };
    const ref = createNotificationRef(config, {
      managerConfig: {
        position: 'bottom-end',
        maxVisible: 3,
        defaultDuration: { success: 4000 },
        dismissLabel: 'Dismiss',
      },
    });

    expect(ref.entry().config).toEqual(config);
    expect(ref.entry().isDismissing).toBe(false);
    expect(ref.entry().isDismissed).toBe(false);
  });

  it('dismisses notification', () => {
    const ref = createNotificationRef(
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

    ref.dismiss();
    expect(ref.entry().isDismissing).toBe(true);
  });

  it('provides afterDismissed observable', () => {
    const ref = createNotificationRef(
      { status: 'success', title: 'Test', duration: 0 },
      {
        managerConfig: {
          position: 'bottom-end',
          maxVisible: 3,
          defaultDuration: { success: 0 },
          dismissLabel: 'Dismiss',
        },
      },
    );

    expect(typeof ref.afterDismissed().subscribe).toBe('function');
  });
});
