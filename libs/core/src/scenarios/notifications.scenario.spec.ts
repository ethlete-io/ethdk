import { NOTIFICATION_CLICK_MESSAGE_TYPE, injectNotifications } from '../index';
import { useScenario } from './harness';

type Shown = { tag: string; close: () => void };

describe('notifications scenarios', () => {
  const tray: Shown[] = [];
  const listeners = new Set<(event: MessageEvent) => void>();

  beforeEach(() => {
    tray.length = 0;
    listeners.clear();

    function NotificationStub() {
      throw new TypeError('Illegal constructor');
    }

    Object.assign(NotificationStub, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', NotificationStub);

    const registration = {
      showNotification: vi.fn((_title: string, options?: NotificationOptions) => {
        tray.push({ tag: options?.tag ?? '', close: vi.fn() });

        return Promise.resolve();
      }),
      getNotifications: vi.fn(() => Promise.resolve([...tray])),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn(() => Promise.resolve(registration)),
        addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.delete(listener),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  const scenario = useScenario();

  it('forgets the click handler of a service-worker notification the user dismissed natively', async () => {
    const s = scenario();
    const notifications = s.run(() => injectNotifications());
    const onDismissedClick = vi.fn();

    const dismissed = notifications.show({ title: 'Old', tag: 'old', onClick: onDismissedClick });
    await s.settle();
    expect(dismissed.tag).toBe('old');

    tray.length = 0;

    notifications.show({ title: 'New', tag: 'new', onClick: vi.fn() });
    await s.settle();

    listeners.forEach((listener) =>
      listener({ data: { type: NOTIFICATION_CLICK_MESSAGE_TYPE, tag: 'old' } } as MessageEvent),
    );

    expect(onDismissedClick).not.toHaveBeenCalled();
  });
});
