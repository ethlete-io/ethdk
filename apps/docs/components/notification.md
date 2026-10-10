# Notification

Toast/snackbar system. Notifications are opened imperatively through a manager; the stack renders itself into `document.body` - there's no container component to place.

## Setup

```ts
import { provideNotificationManager } from '@ethlete/components';

provideNotificationManager({
  position: 'bottom-end',
  // `brand` is a theme name this example app registered - the SDK ships none.
  statusColorMapping: { info: 'brand', loading: 'brand' },
});
```

Without a mapping entry, an `error` toast takes the app's `type: 'error'` color theme and a `success` toast its `type: 'success'` one. `info` and `loading` get no theme unless the mapping names one.

| Config option        | Default                                               | Notes                                                                           |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `position`           | `'bottom-end'`                                        | `bottom/top` × `start/center/end` - `start`/`end` are logical (see below)       |
| `maxVisible`         | `3`                                                   | Opening past the cap auto-dismisses the oldest (whole number, min 1)            |
| `defaultDuration`    | `{ success: 4000, info: 4000, loading: 0, error: 0 }` | Per-status auto-dismiss (0 = sticky); a partial map keeps the other defaults    |
| `statusColorMapping` | semantic `error` / `success` themes                   | Status → app-registered color theme name for buttons inside the toast           |
| `controlsColor`      | -                                                     | Color theme for control elements (e.g. dismiss); falls back to the status color |
| `statusIcons`        | see [Status icons](#status-icons)                     | Per-status icon name; `null` opts a status out                                  |
| `swipeToDismiss`     | `true`                                                | Whether a notification can be flicked away with a pointer or finger             |
| `component`          | `et-notification`                                     | Your own toast component, see [Custom notification UI](#custom-notification-ui) |

## Opening notifications

```ts
import { injectNotificationManager } from '@ethlete/components';

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

`open` takes `status` (`'loading' | 'success' | 'error' | 'info'`), `title`, and optionally:

| Option            | Type                 | Notes                                                                                       |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `message`         | `string`             | Secondary line under the title                                                              |
| `action`          | `NotificationAction` | `{ label, handler, dismiss? }` - dismisses on click unless `dismiss: false`                 |
| `secondaryAction` | `NotificationAction` | A second, quieter action next to the first (see [Two actions](#two-actions))                |
| `duration`        | `number`             | Overrides the status's `defaultDuration`; `0` never auto-dismisses                          |
| `progress`        | `number`             | 0–100 renders a progress bar under the body                                                 |
| `id`              | `string`             | Identity - a repeat `open` replaces it in place (see [One toast per id](#one-toast-per-id)) |
| `icon`            | `string \| null`     | Overrides the status icon; `null` renders none                                              |

### Two actions

`action` is the affirmative one and renders accented; `secondaryAction` renders in the muted surface color next to it. Both dismiss the notification when clicked - pass `dismiss: false` on an action that should leave it up (e.g. one that starts work the same toast then reports on).

```ts
this.manager.open({
  status: 'info',
  title: 'Delete this file?',
  action: { label: 'Delete', handler: () => this.delete() },
  secondaryAction: { label: 'Keep', handler: () => undefined },
});
```

### Status icons

Each status renders a glyph in front of the title, in the status color:

| Status    | Icon                      |
| --------- | ------------------------- |
| `success` | `et-circle-check`         |
| `error`   | `et-triangle-exclamation` |
| `info`    | `et-circle-info`          |
| `loading` | none - a spinner instead  |

Swap the artwork app-wide with [`provideIconOverrides`](/components/icon#overriding-the-built-in-icons), remap a status with the manager's `statusIcons`, or decide per notification with `icon` - `icon: null` renders none, and naming an icon on a `loading` notification replaces its spinner.

```ts
provideNotificationManager({ statusIcons: { info: null } }); // info toasts get no glyph
```

A `statusIcons` map only speaks for the statuses it lists; the rest keep their defaults. A per-notification `icon` name must be registered **app-wide** (`provideIconOverrides` takes new names too, not just replacements) - the stack renders from the manager's own injector, so a component-level `provideIcons` doesn't reach it.

### One toast per id

Give a notification an `id` and a later `open` with that id replaces the live one in place instead of stacking a duplicate - the cure for repeated clicks, retries, or a per-entity toast. The replacement is a **full** config (unlike `ref.update()`, which merges), and it re-arms the auto-dismiss timer.

```ts
// Three clicks, one toast.
this.manager.open({ id: 'message-sent', status: 'success', title: 'Message sent', message: `${count} sent` });
```

The id also becomes the ref's `id`. If a notification with that id is already animating out, it is dropped immediately and the new one takes its place. A `promise()` whose toast a later `open` replaced no longer settles it.

### Following a promise, observable or query

`manager.promise()` opens a `loading` notification and turns it into the success or error one when the work settles - one toast, updated in place:

```ts
this.manager.promise(this.api.save(body), {
  loading: 'Saving…',
  success: (saved) => ({ title: 'Saved', message: `${saved.name} is safe.` }),
  error: (error) => ({ title: 'Could not save', message: (error as Error).message }),
});
```

Each of `loading` / `success` / `error` takes a content object (a config without `status`) or a bare string as the title; `success` and `error` may be functions that receive the value or the error. Dismissing the notification detaches it - the work keeps running, it just has nothing left to report.

It accepts three kinds of work:

| Work                             | Settles when                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Promise<T>`                     | It resolves (value) or rejects (error)                                                                  |
| `Observable<T>`                  | It completes, carrying its last value; completing without emitting is a failure (as in `lastValueFrom`) |
| `Query` (`@ethlete/query`)       | Its execution state reaches success or failure                                                          |
| `createLegacyQueryCreator` query | The query it wraps (`newQuery`) reaches success or failure                                              |

A query is **followed, not executed** - trigger it yourself (or let a `GET` auto-execute) and the notification mirrors its execution state, settling on the first success or failure it sees. An aborted execution (`reset()`, args parked to `null`, the owning component destroyed) is not a failure: the notification is dismissed without a success or error toast, and a cancelled re-execution never reports the previous response as its success. The error callback gets the typed `QueryErrorResponse`, so [`queryErrorMessage`](/query/errors) is usually what you want in the message:

```ts
save() {
  this.saveQuery.execute({ args: { body: { name: 'report-q4.pdf' } } });

  this.manager.promise(this.saveQuery, {
    loading: { title: 'Uploading…', progress: 0 },
    success: (saved) => ({ title: 'Upload complete', message: `${saved.name} is on the server.` }),
    error: (error) => ({ title: `Upload failed (${error.code})`, message: queryErrorMessage(error) ?? '' }),
  });
}
```

Declaring `progress` in the `loading` content (as above) opts the toast into following the request's **upload progress**; without it the notification shows no bar even when the request reports progress. Execute and call `promise()` in the same turn - a query that already carries a response settles the notification immediately.

<StoryEmbed id="components-feedback-notification--promise-api" height="420px" />

### Live-updating a toast

`open` returns a `NotificationRef` - `update()` mutates a visible toast in place, e.g. loading → success:

```ts
const ref = this.manager.open({ status: 'loading', title: 'Uploading…', progress: 0 });

// per tick
ref.update({ progress });

// done - switching status re-arms the timer with the new status's default duration
ref.update({ status: 'success', title: 'Upload complete', progress: undefined, duration: 5000 });
```

The ref also offers `dismiss()`, `pauseTimer()` / `resumeTimer()` and `afterDismissed()`. `manager.dismissAll()` clears everything.

Both timer methods take a reason: the toast holds its countdown until every reason that asked for it has released it, so hover (`'hover'`), focus inside (`'focus'`) and a swipe in progress (`'gesture'`) can overlap without one release re-arming the timer under the others. Pass your own string for your own hold, and release it with the same one - `pauseTimer()` with no argument uses `'api'`. A hold also survives `update()`: the new duration is armed, but not started until the last reason is gone.

```ts
ref.pauseTimer('confirm-open');
// …
ref.resumeTimer('confirm-open');
```

## Live demo

<StoryEmbed id="components-feedback-notification--bottom-end" height="480px" />

## Swipe to dismiss

Drag a notification toward the edge its stack is docked to and it follows the pointer, fading as it goes; let go past 30% of its width (at least 64px) - or flick it - and it leaves carrying the speed of the release. A shorter drag slides back. `center` positions accept either direction, and the gesture is inline-only (`touch-action: pan-y`), so a touch that pans the page vertically is left to the page. Swiping away counts as a manual dismissal, like the dismiss button.

A drag surface inside the notification keeps its own gesture: the swipe skips any pointerdown whose target sits under an element that has taken the inline axis with `touch-action` (a slider at `pan-y`, a color picker area at `none`). Buttons, links and form fields are skipped the same way.

Turn it off with `provideNotificationManager({ swipeToDismiss: false })`. A custom toast opts in by adding `etNotificationSwipeToDismiss` to its notification element.

## Right-to-left

`start` and `end` in the position names are **logical**: the stack docks to the inline-start/inline-end edge and follows the writing direction, so `bottom-end` sits bottom-left under `dir="rtl"`. The toast's slide-in offset and its status accent border flip with it. Because the stack renders into `document.body` it inherits the direction from the document root - setting `dir` on a subtree of your app does not affect it.

<StoryEmbed id="components-feedback-notification--bottom-end-right-to-left" height="480px" />

The `center` positions are unaffected - centering has no inline side.

## Narrow viewports

At `480px` and below the stack spans both edges and every toast fills it, which is the shape a toast has on a phone - and the only one that fits: the card's `300px` minimum plus the stack's insets already overflows a `320px` viewport at a `16px` rem base. The docked corner still decides which edge toasts enter from and whether they sit at the top or the bottom; only the inline size changes. An app that wants the corner card at every width overrides it from its own stylesheet, which wins over the SDK's `@layer components`:

```css
@media (max-width: 480px) {
  .et-notification-stack {
    left: auto;
    align-items: flex-end;
  }

  .et-notification {
    min-width: var(--et-notification-min-width);
    max-width: var(--et-notification-max-width);
  }
}
```

## Behavior & accessibility

- The stack animates reordering/stacking (FLIP, skipped under `prefers-reduced-motion`), keeps at most `maxVisible` toasts, and removes its container when the last toast leaves.
- Error toasts get `role="alert"`, all others `role="status"`; the stack itself is not a live region, so each toast is announced once.
- <kbd>Escape</kbd> dismisses a focused toast; hover/focus pause its auto-dismiss timer, as does holding it under a finger.
- Status icons are decorative (`aria-hidden`) - the status is already carried by the role and the wording.
- A toast paints one surface elevation above the page - the level a dialog resolves to - whatever is open underneath it. Opening or closing an overlay never re-shades a visible toast.
- The stack paints one stacking level above the level overlays mount at (`DEFAULT_OVERLAY_LAYER`), so a toast stays visible over a dialog, a sheet and their backdrops. It declares that level as its own `data-et-overlay-layer`, so pressing a toast does not close an overlay below it, and an overlay opened from a toast action mounts above the stack. Override the level with `--et-notification-stack-z-index` for chrome that must stay on top of a toast, and `--et-notification-stack-gap` (`0.5rem`) for the gap between stacked toasts.
- The stack's insets compose all four `--et-viewport-inset-*` edges, so a toast is never stacked under a surface that [reserved one](/core/overlay-runtime#page-chrome-reads-the-css-custom-properties) - a devtools panel docked to any edge, for example. A `center` position centers in the space that is left, and the stack spans both block edges, so it stops growing at the opposite one instead of sliding under it.

## Custom notification UI

The default `et-notification` covers icon/spinner/title/message/progress/actions/dismiss. For a fully custom toast, write your own component and pass it as `component` to `provideNotificationManager()`. The stack then renders it in place of `et-notification` for every notification, with the `NotificationRef` as its `ref` input.

Build the component on the headless pieces from `NOTIFICATION_IMPORTS`. It must host `NotificationDirective` with the `ref` input: the directive exposes the status/content signals, sets the `role`, and removes a dismissed toast from the stack. Without it, a dismissed toast never leaves. Inside it, use `[etNotificationAction]` (runs the action, then dismisses - `etNotificationAction="secondary"` for the second one) and `[etNotificationDismiss]`; add `NotificationSwipeToDismissDirective` as a host directive for swipe-to-dismiss.

```ts
import { Component, inject } from '@angular/core';
import {
  NOTIFICATION_IMPORTS,
  NotificationDirective,
  NotificationSwipeToDismissDirective,
  provideNotificationManager,
} from '@ethlete/components';

@Component({
  selector: 'app-toast',
  template: `
    <strong>{{ notification.title() }}</strong>
    <button etNotificationDismiss>Close</button>
  `,
  imports: [NOTIFICATION_IMPORTS],
  hostDirectives: [{ directive: NotificationDirective, inputs: ['ref'] }, NotificationSwipeToDismissDirective],
})
export class AppToastComponent {
  protected notification = inject(NotificationDirective);
}

provideNotificationManager({ component: AppToastComponent });
```

The stack keeps its position, stacking, FLIP animation and `maxVisible` limit. A custom component gets no enter or leave animation, no status colour and no hover pause unless it adds them.

<StoryEmbed id="components-feedback-notification--custom-component" />

## Theming

The toast shell exposes size/typography tokens: `--et-notification-border-radius` (`4px`), `--et-notification-padding`, `--et-notification-min-width` (`300px`) / `--et-notification-max-width` (`420px`, both dropped [below `480px`](#narrow-viewports)), `--et-notification-shadow`, `--et-notification-border-width` (`4px`), `--et-notification-font-size` / `--et-notification-line-height`, `--et-notification-gap`, `--et-notification-title-font-weight`, `--et-notification-message-font-size` / `-line-height` / `-opacity`, `--et-notification-progress-bar-height` (`3px`), `--et-notification-icon-size` (`16px`). All of them inherit, so set them on `.et-notification` or any ancestor. Status colors resolve through `statusColorMapping` / `controlsColor`, then the semantic `error` / `success` theme types - [app-registered themes](/core/theming), not tokens; the status icon and the accent border read from the resolved status color.

## Error codes

Notification pieces used outside an `[etNotification]` element throw [`ET17xx` errors](/components/error-codes#notification-et17xx) in dev mode.
