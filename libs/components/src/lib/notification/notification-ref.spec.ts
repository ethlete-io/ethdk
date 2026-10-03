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
        },
      },
    );

    expect(typeof ref.afterDismissed().subscribe).toBe('function');
  });
});

describe('createNotificationRef auto-dismiss', () => {
  const managerConfig = {
    position: 'bottom-end' as const,
    maxVisible: 3,
    defaultDuration: { success: 4000, error: 0 },
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not resume a cleared countdown after the notification became sticky while held', () => {
    const ref = createNotificationRef({ status: 'success', title: 'Saved' }, { managerConfig });

    vi.advanceTimersByTime(1000);
    ref.pauseTimer('hover');
    ref.update({ status: 'error', title: 'Failed' });
    ref.resumeTimer('hover');
    vi.advanceTimersByTime(10_000);

    expect(ref.entry().isDismissing).toBe(false);
  });

  it('does not resume a cleared countdown after an update to duration 0', () => {
    const ref = createNotificationRef({ status: 'success', title: 'Saved' }, { managerConfig });

    ref.update({ duration: 0 });
    ref.pauseTimer('hover');
    ref.resumeTimer('hover');
    vi.advanceTimersByTime(10_000);

    expect(ref.entry().isDismissing).toBe(false);
  });
});
