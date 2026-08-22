# Loaders

Three loading indicators, all exposing `role="progressbar"` with correct determinate/indeterminate aria values. Colors come from `currentColor` unless you say otherwise - the spinner takes a `color` input. There is no aggregate imports array - import the components directly:

```ts
import { BrandLoaderComponent, ProgressBarComponent, SpinnerComponent } from '@ethlete/components';
```

## Spinner

```html
<!-- indeterminate (default) -->
<et-spinner />

<!-- determinate with background track -->
<et-spinner [determinate]="true" [value]="65" [track]="true" [diameter]="45" [strokeWidth]="2" />

<!-- painted in a color theme the app registered -->
<et-spinner color="brand" />
```

| Input         | Default | Notes                                                                        |
| ------------- | ------- | ---------------------------------------------------------------------------- |
| `diameter`    | `18`    | Size in px                                                                   |
| `strokeWidth` | `2.25`  |                                                                              |
| `track`       | `false` | Renders a background ring                                                    |
| `determinate` | `false` | Switches to value mode (`aria-valuenow` set)                                 |
| `value`       | `0`     | 0–100, clamped                                                               |
| `color`       | `null`  | A color theme name or `ColorTheme`; unset keeps the inherited `currentColor` |

`color` opens a color scope on the spinner itself and paints the strokes with that scope's
`--et-theme-color-primary-solid`. It only does so when you set it: an unset spinner keeps inheriting
`currentColor` from its context even when it sits inside a color scope, so a spinner in a themed
button or a tinted text block still matches the text next to it. Set `--et-spinner-color` directly
when the color isn't a registered theme.

<StoryEmbed id="components-feedback-loader-spinner--determinate" height="240px" />

<StoryEmbed id="components-feedback-loader-spinner--themed" height="240px" />

::: info Coming from the CDK
The cdk `et-progress-spinner` defaulted `--et-progress-spinner-color` to a themed blue (`#1e88e5`), so
a bare spinner arrived pre-colored. `et-spinner` defaults to `currentColor` instead: a themed
page-loader should now pass `color` (or set `--et-spinner-color`), while spinners inside buttons,
chips and inputs are usually better off inheriting.
:::

## Progress bar

```html
<et-progress-bar [value]="42" class="w-full" /> <et-progress-bar [indeterminate]="true" class="w-full" />
```

`value` (0–100, clamped) drives the determinate bar; `indeterminate` switches to the sweeping animation and drops the aria value attributes.

<StoryEmbed id="components-feedback-loader-progress-bar--indeterminate" height="200px" />

## Brand loader

The animated Ethlete "E" for full-page or initial loading states. No inputs - drop it in and size it
via CSS; color comes from its own custom properties, not `currentColor` (see [Theming](#theming)):

```html
<et-brand-loader class="size-16" />
```

<StoryEmbed id="components-feedback-loader-brand-loader--default" height="240px" />

## Motion

All three keep animating under `prefers-reduced-motion: reduce`. This is a **deliberate
exemption**: the motion _is_ the message - a frozen spinner or a static indeterminate bar reads as
"stuck", not as "loading". The same reasoning is why the [skeleton](/components/skeleton#motion)
goes the other way: it has a shape to fall back on, so its shimmer is dropped entirely.

Most other motion in the library is gated and skips to its end state: notification transitions, FLIP
reordering (tabs underline, segmented button, grid, dropzone, PiP), carousel autoplay and slide
transitions, and calendar/accordion size animations.

## Accessibility

All three render `role="progressbar"`; spinner and progress bar expose `aria-valuenow` / `-valuemin` / `-valuemax` only in determinate mode (indeterminate drops them, as the pattern requires). The brand loader ships an `aria-label="Loading"`; the spinner and progress bar have **no accessible name by default** - add an `aria-label` when they stand alone rather than inside an already-labelled context (like a button's `loading` state, which sets `aria-busy` on the button).

## Theming

Spinner tokens: `--et-spinner-size` (`18px`), `--et-spinner-stroke-width` (`2.25px`), `--et-spinner-color` (`currentColor`), `--et-spinner-track-color` (`currentColor` at 24%), `--et-spinner-duration` (`1333ms`) - the `diameter`/`strokeWidth` inputs win over the size tokens. The `color` input fills `--et-spinner-color` from its color scope; a rule that sets the token on a specific spinner (as `et-button` does for its loading spinner, `et-notification` for its status spinner) is more specific and keeps winning. Before this release `--et-spinner-track-color` was registered with an `initial-value`, so `track` rendered a ring that never painted. Progress bar tokens: `--et-progress-bar-height` (`4px`), `--et-progress-bar-border-radius` (`9999px`), `--et-progress-bar-track-color` (`currentColor` at 12%), `--et-progress-bar-indicator-color` (`currentColor`), `--et-progress-bar-duration` (`2s`, the indeterminate sweep) - set them on the `et-progress-bar` element or anywhere above it (they inherit; before this release the height and radius were registered as non-inheriting and silently kept their defaults). The brand loader has its own tokens rather than `currentColor`: `--et-brand-loader-accent` (`#00ffa1`), `--et-brand-loader-ghost` and `--et-brand-loader-glow` (both a `color-mix` of the accent), `--et-brand-loader-duration` (`3200ms`), `--et-brand-loader-size` (`10rem`).
