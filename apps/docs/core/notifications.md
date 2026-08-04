# Notifications

System notifications - the ones the operating system draws outside the browser window - through one injectable service that hides the fact that the web has two unrelated APIs for them.

```ts
import { injectNotifications } from '@ethlete/core';

@Component({/* … */})
export class MatchAlertsComponent {
  private notifications = injectNotifications();
  private destroyRef = inject(DestroyRef);

  protected canAsk = computed(() => this.notifications.permission() === 'default');

  protected enable() {
    this.notifications.request().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected announce(match: Match) {
    this.notifications.show({
      title: 'Match starting',
      body: `${match.home} vs ${match.away}, kickoff in 5 minutes`,
      icon: '/icons/match.png',
      data: { matchId: match.id },
      onClick: ({ data }) => {
        window.focus();
        this.router.navigate(['/match', (data as { matchId: string }).matchId]);
      },
    });
  }
}
```

The service is root-provided, so `injectNotifications()` works anywhere without a `provideNotifications()` call - use that only to give a subtree its own instance (`closeAll()` then only reaches that instance's notifications).

Nothing here shows a notification on its own: permission must be granted first, and `show()` never prompts implicitly.

## Permission

`permission()` is a signal over the browser's notification permission, widened with `'unsupported'`:

| State           | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `'default'`     | Not decided - subscribing to `request()` shows the prompt.            |
| `'granted'`     | `show()` can display notifications.                                   |
| `'denied'`      | The user said no. Only they can undo it, in site settings.            |
| `'unsupported'` | No Notification API - a browser without it, or the server during SSR. |

It stays in sync while the app runs. Chromium and Firefox expose a `notifications` descriptor to the Permissions API, so a permission revoked in site settings updates the signal immediately. WebKit has no such descriptor, so the state is re-read whenever the tab returns to the foreground instead - which is where a change made in Settings becomes visible.

`isSupported` is a plain boolean for the same question `'unsupported'` answers, for code that wants to hide a settings toggle entirely.

### Requesting it

`request()` is **cold** - nothing is asked until it is subscribed to, and it emits the outcome once and completes:

```ts
notifications
  .request()
  .pipe(
    filter((state) => state === 'granted'),
    tap(() => this.subscribeToMatchAlerts()),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe();
```

Subscribe **from a user gesture** - a button click, not a lifecycle hook. Safari requires one, and Chromium suppresses the prompt entirely for sites that ask on page load. Once permission is granted or denied the prompt can never be shown again, so `request()` then emits the current state without prompting.

The result also lands in the `permission()` signal, so a template does not need the stream at all.

## Showing a notification

`show(config)` is imperative, not a stream to subscribe to: the notification appears whether or not anybody listens. It returns a `NotificationRef` synchronously, even though one of the two delivery paths is asynchronous:

```ts
const ref = notifications.show({ title: 'Upload finished', tag: 'upload-42' });

ref.tag; // 'upload-42'
ref.close();

ref.shown$.pipe(tap((path) => console.log(path))).subscribe(); // 'page' | 'service-worker' | 'unavailable'
```

`shown$` never errors - it emits the path that carried the notification, or `'unavailable'` when nothing was displayed (no API, permission not granted, or no delivery path available), then completes. The value is replayed, so subscribing after the fact still gets it. `close()` is safe before it emits: the notification is then never displayed at all.

Reading it as a signal is the usual bridge:

```ts
protected deliveryPath = toSignal(ref.shown$);
```

### Config

| Option                           | Path   | Description                                                                                |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `title`                          | both   | The headline. The only required field.                                                     |
| `body`                           | both   | Text below the title.                                                                      |
| `icon` / `badge`                 | both   | Icon URL; monochrome badge for the Android status bar.                                     |
| `tag`                            | both   | Identity - a second notification with the same tag replaces the first. See below.          |
| `data`                           | both   | Arbitrary payload, handed back to `onClick`.                                               |
| `lang` / `dir`                   | both   | Language and text direction.                                                               |
| `silent`                         | both   | Show without sound or vibration.                                                           |
| `requireInteraction`             | both   | Stay on screen until dismissed. Desktop Chromium only.                                     |
| `actions`                        | worker | Buttons. Forces the service-worker path when `path` is `'auto'`.                           |
| `image`                          | worker | Large image inside the notification. Chromium only.                                        |
| `renotify`                       | worker | Alert again when replacing a same-tag notification. Requires `tag`.                        |
| `vibrate`                        | worker | Vibration pattern in ms. Android only.                                                     |
| `timestamp`                      | worker | The time the notification is _about_, for tray ordering - not when it is shown.            |
| `path`                           | -      | `'auto'` (default), `'page'` or `'service-worker'`. See [Delivery paths](#delivery-paths). |
| `autoClose`                      | both   | Close after N ms. Off by default, leaving the lifetime to the platform.                    |
| `onClick`                        | both\* | Click on the notification or one of its actions. \*See the relay note below.               |
| `onClose` / `onShow` / `onError` | page   | Lifecycle events. The service-worker path dispatches these to the worker, not the page.    |

Options marked **worker** are silently dropped on the page path - the `Notification` constructor rejects `actions` outright rather than ignoring them, so a notification pinned to `path: 'page'` is shown without its buttons rather than not at all.

### Tags

Leave `tag` unset for a stand-alone notification and a unique one is generated. That is not cosmetic: the tag is what `close()` matches on the service-worker path and what a relayed click is routed by, so a notification without one could be neither closed nor clicked.

Set it to coalesce repeated notifications about the same thing - one per chat, one per upload. Notifications sharing a tag replace rather than stack, and `close()` on such a ref closes all of them.

## Delivery paths

The web has two ways of putting a notification on screen, and they are not interchangeable:

|                | `page`                | `service-worker`                                                                  |
| -------------- | --------------------- | --------------------------------------------------------------------------------- |
| API            | `new Notification(…)` | `ServiceWorkerRegistration.showNotification()`                                    |
| Where it works | Desktop browsers      | Everywhere, and the **only** path on Android Chrome and in installed iOS web apps |
| Lifetime       | Dies with the tab     | Persists in the tray                                                              |
| `actions`      | No                    | Yes                                                                               |
| Click events   | Straight to the page  | To the service worker                                                             |

`path: 'auto'` - the default - tries the constructor first, because that is the path whose events reach your `onClick` without any cooperation from a service worker. Android Chrome reports "persistent notifications only" by throwing a `TypeError` from the constructor rather than exposing a feature flag, so that throw is what triggers the fallback. A notification with `actions` skips straight to the worker, since the constructor cannot render them.

Pin the path when you care which one runs. `path: 'page'` never falls back; `path: 'service-worker'` resolves `'unavailable'` when no worker is registered.

::: tip Registration, not readiness
The service worker path resolves the registration with `getRegistration()`, never `navigator.serviceWorker.ready` - `ready` never settles in an app that has no service worker, which would leave `shown$` hanging forever instead of reporting `'unavailable'`.
:::

### Making `onClick` work on the service-worker path

A persistent notification's click is dispatched to the service worker, and the page never sees it. Nothing in the SDK can fix that, because a service worker's code belongs to the app - so `onClick` fires on that path only if your worker relays the click as a `postMessage`:

```js
// your service worker
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({
          type: 'et:notification-click',
          tag: event.notification.tag,
          data: event.notification.data,
          action: event.action || undefined,
        });
      }
    }),
  );
});
```

The message type is exported as `NOTIFICATION_CLICK_MESSAGE_TYPE`, and its shape as `NotificationClickMessage`. The service listens for it only after it has shown a notification through the worker with an `onClick` attached, and routes the message to that notification by `tag`.

Without this handler everything else still works - the notification shows, `close()` works, and the click just does nothing (or whatever default your worker already implements).

### `onClick` receives a context, not an event

Because a click can arrive as a DOM event or as a relayed message, the callback gets a `NotificationClickContext`:

```ts
notifications.show({
  title: 'Match starting',
  data: { matchId },
  actions: [{ action: 'watch', title: 'Watch' }],
  onClick: ({ data, action, tag, event }) => {
    if (action === 'watch') {
      /* … */
    }
  },
});
```

`action` is set only when an action button was clicked (service-worker path); `event` only on the page path. A click never focuses the tab - call `window.focus()` yourself if that is what you want.

## Closing

`ref.close()` dismisses one notification. `closeAll()` closes everything the app has open, including persistent notifications still in the tray from an earlier page load - which is what you want on logout, since those outlive the page that created them:

```ts
notifications.closeAll();
```

## SSR

`isSupported` is `false` and `permission()` is `'unsupported'` on the server, `request()` emits `'unsupported'`, and `show()` returns a ref whose `shown$` emits `'unavailable'`. Nothing throws and nothing needs a platform guard at the call site.
