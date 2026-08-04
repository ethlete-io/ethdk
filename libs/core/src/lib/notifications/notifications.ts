import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  filter,
  from,
  fromEvent,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { injectIsDocumentVisible } from '../signals';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';
import {
  NOTIFICATION_CLICK_MESSAGE_TYPE,
  NotificationClickContext,
  NotificationClickMessage,
  NotificationDeliveryPath,
  NotificationPermissionState,
  NotificationRef,
  Notifications,
  ShowNotificationConfig,
} from './notification.types';

/** The options a persistent (service-worker) notification accepts on top of the constructor's. */
type PersistentNotificationOptions = NotificationOptions & {
  actions?: { action: string; title: string; icon?: string }[];
  image?: string;
  renotify?: boolean;
  timestamp?: number;
  vibrate?: number[];
};

const toNotificationOptions = (config: ShowNotificationConfig, tag: string): PersistentNotificationOptions => ({
  body: config.body,
  icon: config.icon,
  badge: config.badge,
  image: config.image,
  tag,
  data: config.data,
  lang: config.lang,
  dir: config.dir,
  silent: config.silent,
  requireInteraction: config.requireInteraction,
  renotify: config.renotify,
  vibrate: config.vibrate,
  timestamp: config.timestamp,
  actions: config.actions,
});

// The constructor rejects `actions` with a TypeError rather than ignoring them, so the page path gets
// a copy without the options only a persistent notification understands.
const toPageNotificationOptions = (options: PersistentNotificationOptions): NotificationOptions => {
  const { actions, image, renotify, timestamp, vibrate, ...pageOptions } = options;

  return pageOptions;
};

const NOTIFICATIONS_DEF = /* @__PURE__ */ defineRootProvider(
  (): Notifications => {
    const destroyRef = inject(DestroyRef);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const isSupported = isBrowser && typeof Notification !== 'undefined';

    // Streams here outlive the call that created them, and `close()` can be called after teardown -
    // where `takeUntilDestroyed()` would throw rather than unsubscribe.
    const destroyed$ = new Subject<void>();

    destroyRef.onDestroy(() => {
      destroyed$.next();
      destroyed$.complete();
    });

    const permission = signal<NotificationPermissionState>(isSupported ? Notification.permission : 'unsupported');

    if (isSupported) {
      // Chromium and Firefox report permission changes here, including a revoke made in site settings
      // while the tab is open. WebKit has no `notifications` descriptor and rejects the query.
      const permissionStatus$ = navigator.permissions
        ? from(navigator.permissions.query({ name: 'notifications' as PermissionName })).pipe(catchError(() => EMPTY))
        : EMPTY;

      permissionStatus$
        .pipe(
          switchMap((status) =>
            fromEvent(status, 'change').pipe(
              map(() => status.state),
              startWith(status.state),
            ),
          ),
          map((state): NotificationPermissionState => (state === 'prompt' ? 'default' : state)),
          tap((state) => permission.set(state)),
          takeUntil(destroyed$),
        )
        .subscribe();

      const isDocumentVisible = injectIsDocumentVisible();

      // The fallback for engines without that descriptor: a permission changed in browser settings is
      // only observable by reading it again, and coming back to the tab is when that matters.
      effect(() => {
        if (!isDocumentVisible()) {
          return;
        }

        untracked(() => permission.set(Notification.permission));
      });
    }

    const request = (): Observable<NotificationPermissionState> =>
      defer((): Observable<NotificationPermissionState> => {
        if (!isSupported) {
          return of('unsupported');
        }

        // The prompt can only be shown once - after that only the user can change it in site settings.
        if (Notification.permission !== 'default') {
          return of(Notification.permission);
        }

        return from(
          new Promise<NotificationPermission>((resolve) => {
            // WebKit only gained the promise-returning form in Safari 16 and hands the result to the
            // deprecated callback before that. Passing both is spec-legal; the later resolve is a no-op.
            const requested = Notification.requestPermission(resolve) as Promise<NotificationPermission> | undefined;

            requested?.then(resolve, () => resolve(Notification.permission));
          }),
        );
      }).pipe(tap((state) => permission.set(state)));

    let nextTagId = 0;
    const clickHandlers = new Map<string, (context: NotificationClickContext) => void>();
    const openCloseFns = new Set<() => void>();
    let isClickRelayAttached = false;

    const attachClickRelay = () => {
      const serviceWorker = navigator.serviceWorker;

      if (isClickRelayAttached || !serviceWorker) {
        return;
      }

      isClickRelayAttached = true;

      fromEvent<MessageEvent>(serviceWorker, 'message')
        .pipe(
          map((event) => event.data as NotificationClickMessage | null),
          filter((message): message is NotificationClickMessage => message?.type === NOTIFICATION_CLICK_MESSAGE_TYPE),
          tap((message) =>
            clickHandlers.get(message.tag)?.({ tag: message.tag, data: message.data, action: message.action }),
          ),
          takeUntil(destroyed$),
        )
        .subscribe();
    };

    // `getRegistration()` rather than `ready`: `ready` never settles in an app without a service
    // worker, which would leave every `shown$` hanging instead of reporting 'unavailable'.
    const serviceWorkerRegistration = (): Observable<ServiceWorkerRegistration | undefined> =>
      defer(() =>
        navigator.serviceWorker
          ? from(navigator.serviceWorker.getRegistration()).pipe(catchError(() => of(undefined)))
          : of(undefined),
      );

    const closePersistentNotifications = (tag?: string): Observable<Notification[]> =>
      serviceWorkerRegistration().pipe(
        switchMap((registration) =>
          registration
            ? // Firefox rejects getNotifications() when the worker is not the one that showed them.
              from(registration.getNotifications(tag ? { tag } : undefined)).pipe(catchError(() => of([])))
            : of<Notification[]>([]),
        ),
        tap((notifications) => notifications.forEach((notification) => notification.close())),
      );

    const show = (config: ShowNotificationConfig): NotificationRef => {
      const tag = config.tag ?? `et-notification-${++nextTagId}`;
      const options = toNotificationOptions(config, tag);
      const path = config.path ?? 'auto';
      // Actions only redirect a notification that has not been pinned to a path - `path: 'page'` is a
      // caller saying they would rather have it without the buttons than not at all.
      const needsPersistent = path === 'auto' && !!config.actions?.length;

      const closed$ = new Subject<void>();
      let isClosed = false;
      let pageNotification: Notification | null = null;

      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        closed$.next();
        closed$.complete();
        clickHandlers.delete(tag);
        openCloseFns.delete(close);
        pageNotification?.close();

        // A no-op unless this notification took the persistent path.
        closePersistentNotifications(tag).pipe(takeUntil(destroyed$)).subscribe();
      };

      const showViaPage = (): NotificationDeliveryPath => {
        let notification: Notification;

        try {
          notification = new Notification(config.title, toPageNotificationOptions(options));
        } catch {
          // How Android Chrome says "persistent notifications only" - there is no feature flag to test.
          return 'unavailable';
        }

        pageNotification = notification;

        notification.onclick = (event) => config.onClick?.({ tag, data: config.data, event });
        notification.onclose = () => {
          // The user dismissed it - forget the ref so `closeAll()` has nothing stale to walk.
          openCloseFns.delete(close);
          config.onClose?.();
        };
        notification.onshow = () => config.onShow?.();
        notification.onerror = () => config.onError?.();

        if (isClosed) {
          notification.close();

          return 'unavailable';
        }

        return 'page';
      };

      const showViaServiceWorker = (): Observable<NotificationDeliveryPath> =>
        serviceWorkerRegistration().pipe(
          switchMap((registration): Observable<NotificationDeliveryPath> => {
            if (!registration || isClosed) {
              return of('unavailable');
            }

            if (config.onClick) {
              clickHandlers.set(tag, config.onClick);
              attachClickRelay();
            }

            return from(registration.showNotification(config.title, options)).pipe(
              switchMap((): Observable<NotificationDeliveryPath> =>
                isClosed
                  ? // Closed while the worker was still putting it up - take back what just appeared.
                    closePersistentNotifications(tag).pipe(map((): NotificationDeliveryPath => 'unavailable'))
                  : of('service-worker'),
              ),
              catchError(() => {
                clickHandlers.delete(tag);

                return of<NotificationDeliveryPath>('unavailable');
              }),
            );
          }),
        );

      const shown$ = defer((): Observable<NotificationDeliveryPath> => {
        // Permission is never requested here - an app that wants the prompt calls `request()`.
        if (!isSupported || Notification.permission !== 'granted' || isClosed) {
          return of('unavailable');
        }

        if (path === 'service-worker' || needsPersistent) {
          return showViaServiceWorker();
        }

        const pagePath = showViaPage();

        if (pagePath !== 'unavailable' || path === 'page') {
          return of(pagePath);
        }

        return showViaServiceWorker();
      }).pipe(
        tap((deliveryPath) => {
          if (deliveryPath === 'unavailable') {
            openCloseFns.delete(close);
          }
        }),
        // Shown once, replayed to every later subscriber - `refCount: false` keeps the result after
        // the eager subscription below has completed.
        shareReplay({ bufferSize: 1, refCount: false }),
      );

      openCloseFns.add(close);

      // `show()` is imperative: the notification appears whether or not anyone subscribes.
      shown$.pipe(takeUntil(destroyed$)).subscribe();

      if (config.autoClose) {
        shown$
          .pipe(
            filter((deliveryPath) => deliveryPath !== 'unavailable'),
            switchMap(() => timer(config.autoClose ?? 0)),
            tap(() => close()),
            takeUntil(closed$),
            takeUntil(destroyed$),
          )
          .subscribe();
      }

      return { tag, shown$, close };
    };

    const closeAll = () => {
      for (const close of Array.from(openCloseFns)) {
        close();
      }

      closePersistentNotifications().pipe(takeUntil(destroyed$)).subscribe();
    };

    destroyRef.onDestroy(() => {
      clickHandlers.clear();
      openCloseFns.clear();
    });

    return { isSupported, permission: permission.asReadonly(), request, show, closeAll };
  },
  { name: 'Notifications' },
);

export const provideNotifications = /* @__PURE__ */ toProvideFn(NOTIFICATIONS_DEF);
export const injectNotifications = /* @__PURE__ */ toInjectFn(NOTIFICATIONS_DEF);
