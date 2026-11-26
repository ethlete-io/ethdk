import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { NOTIFICATION_CLICK_MESSAGE_TYPE } from './notification.types';
import { injectNotifications } from './notifications';

type NotificationInstance = {
  title: string;
  options?: NotificationOptions;
  close: ReturnType<typeof vi.fn>;
  onclick?: (event: Event) => void;
  onclose?: () => void;
  onshow?: () => void;
  onerror?: () => void;
};

type PersistentNotification = {
  title: string;
  options?: NotificationOptions;
  close: ReturnType<typeof vi.fn>;
};

describe('notifications', () => {
  let injector: Injector;
  let pageNotifications: NotificationInstance[];

  const stubNotificationApi = (
    options: { permission?: NotificationPermission; throwOnConstruct?: boolean; legacyRequest?: boolean } = {},
  ) => {
    const permission = options.permission ?? 'granted';

    function NotificationStub(this: NotificationInstance, title: string, notificationOptions?: NotificationOptions) {
      if (options.throwOnConstruct) {
        throw new TypeError('Illegal constructor');
      }

      this.title = title;
      this.options = notificationOptions;
      this.close = vi.fn();
      pageNotifications.push(this);
    }

    const requestPermission = vi.fn((callback?: (result: NotificationPermission) => void) => {
      if (options.legacyRequest) {
        callback?.('granted');

        return undefined;
      }

      return Promise.resolve('granted' as NotificationPermission);
    });

    Object.assign(NotificationStub, { permission, requestPermission });
    Object.defineProperty(globalThis, 'Notification', {
      value: NotificationStub,
      configurable: true,
      writable: true,
    });

    return { requestPermission };
  };

  const createRegistration = () => {
    const notifications: PersistentNotification[] = [];

    return {
      notifications,
      showNotification: vi.fn(async (title: string, options?: NotificationOptions) => {
        notifications.push({ title, options, close: vi.fn() });
      }),
      getNotifications: vi.fn(async (filter?: { tag?: string }) =>
        notifications.filter((notification) => !filter?.tag || notification.options?.tag === filter.tag),
      ),
    };
  };

  const stubServiceWorker = (registration: unknown) => {
    const listeners = new Set<(event: MessageEvent) => void>();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn(async () => registration ?? undefined),
        addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => listeners.add(listener)),
        removeEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) =>
          listeners.delete(listener),
        ),
      },
      configurable: true,
    });

    return { emit: (data: unknown) => listeners.forEach((listener) => listener({ data } as MessageEvent)) };
  };

  const notifications = () => runInInjectionContext(injector, () => injectNotifications());

  beforeEach(() => {
    pageNotifications = [];
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    Reflect.deleteProperty(globalThis, 'Notification');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.restoreAllMocks();
  });

  describe('support and permission', () => {
    it('reports the API as unsupported when there is no Notification global', () => {
      const service = notifications();

      expect(service.isSupported).toBe(false);
      expect(service.permission()).toBe('unsupported');
    });

    it('reads the current permission on creation', () => {
      stubNotificationApi({ permission: 'denied' });

      const service = notifications();

      expect(service.isSupported).toBe(true);
      expect(service.permission()).toBe('denied');
    });

    it('emits unsupported from request() instead of throwing', async () => {
      await expect(firstValueFrom(notifications().request())).resolves.toBe('unsupported');
    });

    it('prompts and records the outcome', async () => {
      const { requestPermission } = stubNotificationApi({ permission: 'default' });
      const service = notifications();

      await expect(firstValueFrom(service.request())).resolves.toBe('granted');
      expect(requestPermission).toHaveBeenCalled();
      expect(service.permission()).toBe('granted');
    });

    it('supports the legacy callback form of requestPermission', async () => {
      stubNotificationApi({ permission: 'default', legacyRequest: true });
      const service = notifications();

      await expect(firstValueFrom(service.request())).resolves.toBe('granted');
      expect(service.permission()).toBe('granted');
    });

    it('does not prompt again once the user has decided', async () => {
      const { requestPermission } = stubNotificationApi({ permission: 'denied' });

      await expect(firstValueFrom(notifications().request())).resolves.toBe('denied');
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('does not prompt until subscribed', () => {
      const { requestPermission } = stubNotificationApi({ permission: 'default' });

      notifications().request();

      expect(requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('shows the notification without anyone subscribing', () => {
      stubNotificationApi();

      notifications().show({ title: 'Match starting' });

      expect(pageNotifications).toHaveLength(1);
    });

    it('replays the delivery path to a late subscriber', async () => {
      stubNotificationApi();

      const ref = notifications().show({ title: 'Match starting' });
      await firstValueFrom(ref.shown$);

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('page');
      expect(pageNotifications).toHaveLength(1);
    });

    it('shows nothing while permission is not granted, and does not prompt', async () => {
      const { requestPermission } = stubNotificationApi({ permission: 'default' });

      const ref = notifications().show({ title: 'Match starting' });

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('unavailable');
      expect(pageNotifications).toHaveLength(0);
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('uses the page path and forwards the config', async () => {
      stubNotificationApi();

      const ref = notifications().show({ title: 'Match starting', body: 'Kickoff in 5 minutes', data: { id: 7 } });

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('page');
      expect(pageNotifications).toHaveLength(1);
      expect(pageNotifications[0]?.title).toBe('Match starting');
      expect(pageNotifications[0]?.options).toMatchObject({ body: 'Kickoff in 5 minutes', data: { id: 7 } });
    });

    it('generates a unique tag when the config does not set one', async () => {
      stubNotificationApi();
      const service = notifications();

      const first = service.show({ title: 'One' });
      const second = service.show({ title: 'Two' });

      await Promise.all([firstValueFrom(first.shown$), firstValueFrom(second.shown$)]);

      expect(first.tag).not.toBe(second.tag);
      expect(pageNotifications[0]?.options?.tag).toBe(first.tag);
    });

    it('keeps a caller-provided tag', async () => {
      stubNotificationApi();

      const ref = notifications().show({ title: 'Upload', tag: 'upload-42' });
      await firstValueFrom(ref.shown$);

      expect(ref.tag).toBe('upload-42');
      expect(pageNotifications[0]?.options?.tag).toBe('upload-42');
    });

    it('wires the page path event handlers', async () => {
      stubNotificationApi();
      const onClick = vi.fn();
      const onClose = vi.fn();
      const onShow = vi.fn();

      const ref = notifications().show({ title: 'Match starting', data: 'payload', onClick, onClose, onShow });
      await firstValueFrom(ref.shown$);

      const event = new Event('click');
      pageNotifications[0]?.onclick?.(event);
      pageNotifications[0]?.onclose?.();
      pageNotifications[0]?.onshow?.();

      expect(onClick).toHaveBeenCalledWith({ tag: ref.tag, data: 'payload', event });
      expect(onClose).toHaveBeenCalled();
      expect(onShow).toHaveBeenCalled();
    });

    it('closes the underlying page notification', async () => {
      stubNotificationApi();

      const ref = notifications().show({ title: 'Match starting' });
      await firstValueFrom(ref.shown$);

      ref.close();
      ref.close();

      expect(pageNotifications[0]?.close).toHaveBeenCalledTimes(1);
    });

    it('falls back to the service worker when the constructor is illegal', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const registration = createRegistration();
      stubServiceWorker(registration);

      const ref = notifications().show({ title: 'Match starting' });

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('service-worker');
      expect(registration.showNotification).toHaveBeenCalledWith(
        'Match starting',
        expect.objectContaining({ tag: ref.tag }),
      );
      expect(pageNotifications).toHaveLength(0);
    });

    it('reports unavailable when the constructor is illegal and no service worker is registered', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      stubServiceWorker(null);

      await expect(firstValueFrom(notifications().show({ title: 'Match starting' }).shown$)).resolves.toBe(
        'unavailable',
      );
    });

    it('routes a notification with actions to the service worker', async () => {
      stubNotificationApi();
      const registration = createRegistration();
      stubServiceWorker(registration);

      const ref = notifications().show({
        title: 'Match starting',
        actions: [{ action: 'open', title: 'Watch' }],
      });

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('service-worker');
      expect(pageNotifications).toHaveLength(0);
      expect(registration.showNotification.mock.calls[0]?.[1]).toMatchObject({
        actions: [{ action: 'open', title: 'Watch' }],
      });
    });

    it('drops persistent-only options on a notification pinned to the page path', async () => {
      stubNotificationApi();

      const ref = notifications().show({
        title: 'Match starting',
        path: 'page',
        actions: [{ action: 'open', title: 'Watch' }],
        image: '/hero.png',
        vibrate: [100],
      });

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('page');
      expect(pageNotifications[0]?.options).not.toHaveProperty('actions');
      expect(pageNotifications[0]?.options).not.toHaveProperty('image');
      expect(pageNotifications[0]?.options).not.toHaveProperty('vibrate');
    });

    it('does not fall back to the service worker for a notification pinned to the page path', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const registration = createRegistration();
      stubServiceWorker(registration);

      await expect(
        firstValueFrom(notifications().show({ title: 'Match starting', path: 'page' }).shown$),
      ).resolves.toBe('unavailable');
      expect(registration.showNotification).not.toHaveBeenCalled();
    });

    it('skips the constructor for a notification pinned to the service-worker path', async () => {
      stubNotificationApi();
      const registration = createRegistration();
      stubServiceWorker(registration);

      await expect(
        firstValueFrom(notifications().show({ title: 'Match starting', path: 'service-worker' }).shown$),
      ).resolves.toBe('service-worker');
      expect(pageNotifications).toHaveLength(0);
    });

    it('closes a persistent notification by tag', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const registration = createRegistration();
      stubServiceWorker(registration);

      const ref = notifications().show({ title: 'Match starting' });
      await firstValueFrom(ref.shown$);

      ref.close();
      await vi.waitFor(() => expect(registration.notifications[0]?.close).toHaveBeenCalled());
    });

    it('never shows a notification that was closed before it appeared', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const registration = createRegistration();
      stubServiceWorker(registration);

      const ref = notifications().show({ title: 'Match starting' });
      ref.close();

      await expect(firstValueFrom(ref.shown$)).resolves.toBe('unavailable');
      expect(registration.showNotification).not.toHaveBeenCalled();
    });
  });

  describe('service worker click relay', () => {
    it('calls onClick when the worker relays a click for that tag', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const { emit } = stubServiceWorker(createRegistration());
      const onClick = vi.fn();

      const ref = notifications().show({ title: 'Match starting', onClick });
      await firstValueFrom(ref.shown$);

      emit({ type: NOTIFICATION_CLICK_MESSAGE_TYPE, tag: ref.tag, data: { id: 7 }, action: 'open' });

      expect(onClick).toHaveBeenCalledWith({ tag: ref.tag, data: { id: 7 }, action: 'open' });
    });

    it('ignores unrelated messages and other tags', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const { emit } = stubServiceWorker(createRegistration());
      const onClick = vi.fn();

      const ref = notifications().show({ title: 'Match starting', onClick });
      await firstValueFrom(ref.shown$);

      emit({ type: 'something-else', tag: ref.tag });
      emit({ type: NOTIFICATION_CLICK_MESSAGE_TYPE, tag: 'other-tag' });
      emit(null);

      expect(onClick).not.toHaveBeenCalled();
    });

    it('stops relaying once the notification is closed', async () => {
      stubNotificationApi({ throwOnConstruct: true });
      const { emit } = stubServiceWorker(createRegistration());
      const onClick = vi.fn();

      const ref = notifications().show({ title: 'Match starting', onClick });
      await firstValueFrom(ref.shown$);
      ref.close();

      emit({ type: NOTIFICATION_CLICK_MESSAGE_TYPE, tag: ref.tag });

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('autoClose', () => {
    it('closes the notification after the configured delay', async () => {
      vi.useFakeTimers();
      stubNotificationApi();

      const ref = notifications().show({ title: 'Match starting', autoClose: 2000 });
      await firstValueFrom(ref.shown$);

      expect(pageNotifications[0]?.close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      expect(pageNotifications[0]?.close).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('closeAll', () => {
    it('closes every open notification plus anything left in the tray', async () => {
      stubNotificationApi();
      const registration = createRegistration();
      stubServiceWorker(registration);
      const service = notifications();

      const first = service.show({ title: 'One' });
      const second = service.show({ title: 'Two' });
      await Promise.all([firstValueFrom(first.shown$), firstValueFrom(second.shown$)]);

      // A notification from an earlier page load - `show()` knows nothing about it.
      registration.notifications.push({ title: 'Stale', options: { tag: 'stale' }, close: vi.fn() });

      service.closeAll();

      expect(pageNotifications[0]?.close).toHaveBeenCalled();
      expect(pageNotifications[1]?.close).toHaveBeenCalled();
      await vi.waitFor(() => expect(registration.notifications[0]?.close).toHaveBeenCalled());
    });

    it('does not touch a notification the user already dismissed', async () => {
      stubNotificationApi();
      const service = notifications();

      const ref = service.show({ title: 'One' });
      await firstValueFrom(ref.shown$);

      pageNotifications[0]?.onclose?.();
      service.closeAll();

      expect(pageNotifications[0]?.close).not.toHaveBeenCalled();
    });
  });
});
