# Notification

Toast/snackbar system. Notifications are opened imperatively through a manager; the stack renders itself into `document.body` — there's no container component to place.

## Setup

```ts
provideNotificationManager({
  position: 'bottom-end',
  statusColorMapping: { info: 'brand', error: 'danger', success: 'brand', loading: 'brand' },
});
```

| Config option        | Default                                               | Notes                                                                           |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `position`           | `'bottom-end'`                                        | `bottom/top` × `start/center/end`                                               |
| `maxVisible`         | `3`                                                   | Opening past the cap auto-dismisses the oldest                                  |
| `defaultDuration`    | `{ success: 4000, info: 4000, loading: 0, error: 0 }` | Per-status auto-dismiss (0 = sticky)                                            |
| `statusColorMapping` | —                                                     | Status → app-registered color theme name for buttons inside the toast           |
| `controlsColor`      | —                                                     | Color theme for control elements (e.g. dismiss); falls back to the status color |
| `dismissLabel`       | `'Dismiss'`                                           | aria-label of the close button                                                  |

## Opening notifications

```ts
private manager = injectNotificationManager();

save() {
  this.manager.open({ status: 'success', title: 'Changes saved', message: 'Your profile has been updated.' });
}

delete() {
  this.manager.open({
    status: 'info',
    title: 'File deleted',
    action: { label: 'Undo', handler: () => this.restore() },
  });
}
```

`open` takes `status` (`'loading' | 'success' | 'error' | 'info'`), `title`, and optionally `message`, `action`, `duration` and `progress` (0–100 renders a progress bar).

### Live-updating a toast

`open` returns a `NotificationRef` — `update()` mutates a visible toast in place, e.g. loading → success:

```ts
const ref = this.manager.open({ status: 'loading', title: 'Uploading…', progress: 0 });

// per tick
ref.update({ progress });

// done — switching status re-arms the timer with the new status's default duration
ref.update({ status: 'success', title: 'Upload complete', progress: undefined, duration: 5000 });
```

The ref also offers `dismiss()`, `pauseTimer()` / `resumeTimer()` (hover and focus pause automatically) and `afterDismissed()`. `manager.dismissAll()` clears everything.

## Live demo

<StoryEmbed id="components-notification--bottom-end" height="480px" />

## Behavior & accessibility

- The stack animates reordering/stacking (FLIP), keeps at most `maxVisible` toasts, and removes its container when the last toast leaves.
- Error toasts get `role="alert"`, all others `role="status"`; the stack itself is a polite `role="log"` live region.
- <kbd>Escape</kbd> dismisses a focused toast; hover/focus pause its auto-dismiss timer.

## Custom notification UI

The default `et-notification` covers spinner/title/message/progress/action/dismiss. For fully custom toasts, build on the headless pieces from `NOTIFICATION_IMPORTS`: `[etNotification]` (takes the `ref`, exposes status/content signals and handles the leave animation), `[etNotificationAction]` (runs the action, then dismisses) and `[etNotificationDismiss]`.

## Theming

The toast shell exposes size/typography tokens: `--et-notification-border-radius` (`4px`), `--et-notification-padding`, `--et-notification-min-width` (`300px`) / `--et-notification-max-width` (`420px`), `--et-notification-shadow`, `--et-notification-border-width` (`4px`), `--et-notification-font-size` / `--et-notification-line-height`, `--et-notification-gap`, `--et-notification-title-font-weight`, `--et-notification-message-font-size` / `-line-height` / `-opacity`, `--et-notification-progress-bar-height` (`3px`). Status colors resolve through `statusColorMapping` / `controlsColor` — app-registered themes, not tokens.

## Error codes

Notification pieces used outside an `[etNotification]` element throw [`ET17xx` errors](/components/error-codes#notification-et17xx) in dev mode.
