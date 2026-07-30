# Loaders

Three loading indicators, all exposing `role="progressbar"` with correct determinate/indeterminate aria values. Colors come from `currentColor`. There is no aggregate imports array — import the components directly:

```ts
import { BrandLoaderComponent, ProgressBarComponent, SpinnerComponent } from '@ethlete/components';
```

## Spinner

```html
<!-- indeterminate (default) -->
<et-spinner />

<!-- determinate with background track -->
<et-spinner [determinate]="true" [value]="65" [track]="true" [diameter]="45" [strokeWidth]="2" />
```

| Input         | Default | Notes                                        |
| ------------- | ------- | -------------------------------------------- |
| `diameter`    | `18`    | Size in px                                   |
| `strokeWidth` | `2.25`  |                                              |
| `track`       | `false` | Renders a background ring                    |
| `determinate` | `false` | Switches to value mode (`aria-valuenow` set) |
| `value`       | `0`     | 0–100, clamped                               |

<StoryEmbed id="components-loader-spinner--determinate" height="240px" />

## Progress bar

```html
<et-progress-bar [value]="42" class="w-full" /> <et-progress-bar [indeterminate]="true" class="w-full" />
```

`value` (0–100, clamped) drives the determinate bar; `indeterminate` switches to the sweeping animation and drops the aria value attributes.

<StoryEmbed id="components-loader-progress-bar--indeterminate" height="200px" />

## Brand loader

The animated Ethlete "E" for full-page or initial loading states. No inputs — drop it in and size/color via CSS:

```html
<et-brand-loader class="size-16 text-et-brand" />
```

<StoryEmbed id="components-loader-brand-loader--default" height="240px" />

## Motion

All three keep animating under `prefers-reduced-motion: reduce`. This is a **deliberate
exemption**: the motion _is_ the message — a frozen spinner or a static indeterminate bar reads as
"stuck", not as "loading". The same reasoning is why the [skeleton](/components/skeleton#motion)
goes the other way: it has a shape to fall back on, so its shimmer is dropped entirely.

Most other motion in the library is gated and skips to its end state: notification transitions, FLIP
reordering (tabs underline, segmented button, grid, dropzone, PiP), carousel autoplay and slide
transitions, and calendar/accordion size animations.

## Accessibility

All three render `role="progressbar"`; spinner and progress bar expose `aria-valuenow` / `-valuemin` / `-valuemax` only in determinate mode (indeterminate drops them, as the pattern requires). The brand loader ships an `aria-label="Loading"`; the spinner and progress bar have **no accessible name by default** — add an `aria-label` when they stand alone rather than inside an already-labelled context (like a button's `loading` state, which sets `aria-busy` on the button).

## Theming

Spinner tokens: `--et-spinner-size` (`18px`), `--et-spinner-stroke-width` (`2.25px`), `--et-spinner-color` (`currentColor`), `--et-spinner-track-color` (`transparent`), `--et-spinner-duration` (`1333ms`) — the `diameter`/`strokeWidth` inputs win over the size tokens. Progress bar tokens: `--et-progress-bar-height` (`4px`), `--et-progress-bar-border-radius` (`9999px`). The brand loader has no tokens — size and color it via CSS (`currentColor`).
