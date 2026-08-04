import { Signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * The browser's notification permission, widened with `'unsupported'` - which covers both a browser
 * without the Notification API and the server, where there is no `Notification` global to ask.
 */
export type NotificationPermissionState = NotificationPermission | 'unsupported';

/**
 * Which of the two ways of putting a notification on screen was used.
 *
 * - `page` - the `Notification` constructor. Its events come back to the page, so `onClick`,
 *   `onClose`, `onShow` and `onError` all work, but the notification dies with the tab.
 * - `service-worker` - `ServiceWorkerRegistration.showNotification()`. The only path Android Chrome
 *   and installed iOS web apps have, and the only one that can render `actions` - but its clicks are
 *   delivered to the service worker rather than to the page, see {@link ShowNotificationConfig.onClick}.
 * - `unavailable` - nothing was shown: no API, permission not granted, the page path threw and no
 *   service worker was registered to fall back to, or the notification was closed before it appeared.
 */
export type NotificationDeliveryPath = 'page' | 'service-worker' | 'unavailable';

/**
 * A button rendered on a notification. Service-worker path only - `show()` routes a notification with
 * actions there automatically, and a notification pinned to `path: 'page'` drops them.
 */
export type NotificationActionConfig = {
  /** Identifies this button in the service worker's `notificationclick` handler (`event.action`). */
  action: string;

  /** The button's label. */
  title: string;

  /** Icon URL for the button. Rendered on Android, ignored on desktop. */
  icon?: string;
};

/** What {@link ShowNotificationConfig.onClick} is called with. */
export type NotificationClickContext = {
  /** The notification's tag - the generated one when the config did not set one. */
  tag: string;

  /** Whatever was passed as {@link ShowNotificationConfig.data}. */
  data: unknown;

  /** The action button that was clicked. Service-worker path only, and absent for the body itself. */
  action?: string;

  /** The underlying DOM event. Page path only. */
  event?: Event;
};

/**
 * The message a service worker posts to relay a notification click back to the page. Matches what
 * {@link NOTIFICATION_CLICK_MESSAGE_TYPE} documents.
 */
export type NotificationClickMessage = {
  type: typeof NOTIFICATION_CLICK_MESSAGE_TYPE;
  tag: string;
  data?: unknown;
  action?: string;
};

/**
 * The `message` type a service worker must post for `onClick` to fire on the service-worker path,
 * where the click event is dispatched to the worker and never reaches the page.
 *
 * Nothing in the SDK can install this handler - a service worker's code is the app's. Add it to yours
 * to make `onClick` work on Android Chrome and installed iOS web apps:
 *
 * ```js
 * self.addEventListener('notificationclick', (event) => {
 *   event.notification.close();
 *
 *   event.waitUntil(
 *     self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
 *       for (const client of clients) {
 *         client.postMessage({
 *           type: 'et:notification-click',
 *           tag: event.notification.tag,
 *           data: event.notification.data,
 *           action: event.action || undefined,
 *         });
 *       }
 *     }),
 *   );
 * });
 * ```
 */
export const NOTIFICATION_CLICK_MESSAGE_TYPE = 'et:notification-click';

export type ShowNotificationConfig = {
  /** The notification's headline. The only required field. */
  title: string;

  /** Body text below the title. */
  body?: string;

  /** URL of the image shown as the notification's icon. */
  icon?: string;

  /** URL of a small monochrome badge, shown in the Android status bar when the icon does not fit. */
  badge?: string;

  /**
   * URL of a large image shown inside the notification. Service-worker path only, and only honored by
   * Chromium.
   */
  image?: string;

  /**
   * Identity of the notification: showing another one with the same tag **replaces** it instead of
   * stacking, and it is what `close()` matches on the service-worker path.
   *
   * Leave it unset for a stand-alone notification - a unique tag is generated, which is what makes
   * `close()` and click relaying work at all. Set it to coalesce repeated notifications about the same
   * thing (one per chat, one per upload); `close()` on such a ref closes every notification sharing
   * the tag.
   */
  tag?: string;

  /** Arbitrary payload, handed back to `onClick` and to the service worker's `notificationclick`. */
  data?: unknown;

  /** Language of the title and body, as a BCP 47 tag. */
  lang?: string;

  /** Text direction of the title and body. */
  dir?: NotificationDirection;

  /** Show without sound or vibration. */
  silent?: boolean;

  /**
   * Keep the notification on screen until the user dismisses it, rather than auto-hiding it. Desktop
   * Chromium only; ignored elsewhere.
   */
  requireInteraction?: boolean;

  /**
   * Alert the user again when this notification replaces one with the same tag - by default a
   * replacement is silent. Requires `tag`; service-worker path only.
   */
  renotify?: boolean;

  /**
   * Vibration pattern in milliseconds, alternating vibrate and pause. Service-worker path only, and
   * Android only.
   */
  vibrate?: number[];

  /**
   * The time the notification is *about*, as an epoch timestamp - not when it is shown. Used for
   * ordering in the notification tray. Service-worker path only.
   */
  timestamp?: number;

  /** Buttons on the notification. Forces the service-worker path, since the page path cannot render them. */
  actions?: NotificationActionConfig[];

  /**
   * Which delivery path to use.
   *
   * - `auto` (default) - the page path first, falling back to the service worker when the constructor
   *   throws, which is how Android Chrome reports that it only does persistent notifications. A
   *   notification with `actions` goes straight to the service worker.
   * - `page` - constructor only. Fails to `'unavailable'` where the constructor is illegal, and drops
   *   `actions`, `image`, `renotify`, `vibrate` and `timestamp`.
   * - `service-worker` - persistent only. Fails to `'unavailable'` when no service worker is
   *   registered.
   * @default 'auto'
   */
  path?: 'auto' | 'page' | 'service-worker';

  /**
   * Close the notification this many milliseconds after it is shown. Off by default, which leaves the
   * lifetime to the platform - desktop Chromium hides a notification after about 20 seconds and keeps
   * it in the tray, Android keeps it until dismissed.
   */
  autoClose?: number;

  /**
   * Called when the user clicks the notification (or one of its `actions`).
   *
   * On the page path this is wired directly to the notification's `click` event. On the
   * service-worker path the event goes to the worker instead, so this only fires if that worker
   * relays it - see {@link NOTIFICATION_CLICK_MESSAGE_TYPE} for the handler to add.
   *
   * A click does not focus the tab. Call `window.focus()` yourself if that is what you want.
   */
  onClick?: (context: NotificationClickContext) => void;

  /** Called when the notification is closed, by the user or by `close()`. Page path only. */
  onClose?: () => void;

  /** Called once the notification is on screen. Page path only. */
  onShow?: () => void;

  /** Called when the browser failed to display the notification. Page path only. */
  onError?: () => void;
};

/** Handle on a notification handed to {@link Notifications.show}. */
export type NotificationRef = {
  /** The notification's tag - generated when the config did not provide one. */
  readonly tag: string;

  /**
   * Emits once the browser has taken the notification, with the path that carried it - or
   * `'unavailable'` if nothing was shown - and completes. Never errors.
   *
   * The notification is shown whether or not anyone subscribes, and the result is replayed, so a late
   * subscriber still gets it.
   */
  readonly shown$: Observable<NotificationDeliveryPath>;

  /**
   * Dismiss the notification. Safe to call before `shown$` emits (the notification is then never
   * displayed) and safe to call twice.
   */
  readonly close: () => void;
};

/** The notification API, injected with `injectNotifications()`. */
export type Notifications = {
  /**
   * Whether this browser exposes a Notification API at all - `false` on the server and in engines
   * without it. Not a promise that a notification will show: permission still has to be granted, and
   * a browser that only supports persistent notifications still needs a service worker.
   */
  readonly isSupported: boolean;

  /**
   * The current permission, kept in sync while the app runs: through the Permissions API where it has
   * a `notifications` descriptor (Chromium, Firefox), and by re-reading it whenever the tab comes back
   * to the foreground everywhere else - which is how a permission revoked in browser settings is
   * picked up on WebKit.
   */
  readonly permission: Signal<NotificationPermissionState>;

  /**
   * Show the browser's permission prompt, emitting the outcome once and completing. Cold - nothing is
   * asked until it is subscribed to.
   *
   * Subscribe from a user gesture: Safari requires one, and Chromium blocks the prompt entirely on
   * sites that ask on page load. Emits the current state without prompting when permission was already
   * granted or denied - the prompt can only be shown once, after which only the user can change it in
   * site settings.
   */
  readonly request: () => Observable<NotificationPermissionState>;

  /**
   * Show a notification, if permission has been granted - this never prompts on its own, so run
   * `request()` first.
   *
   * Returns synchronously, and the notification is shown without anyone subscribing to anything; the
   * ref's `shown$` reports which path carried it.
   */
  readonly show: (config: ShowNotificationConfig) => NotificationRef;

  /**
   * Close every notification this app has open - the ones shown through `show()` plus any persistent
   * ones still in the tray from an earlier page load.
   */
  readonly closeAll: () => void;
};
