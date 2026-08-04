# Progress spinner

A circular progress indicator with a determinate (percentage) and an indeterminate (endless) mode, drawn as SVG so it scales to any diameter without blurring.

::: warning Superseded by @ethlete/components
New code should use the [components spinner](/components/loader#spinner) (`SpinnerComponent`). The `mode`
input splits into a `determinate` boolean (default `false`, so `<et-spinner />` still means "endless"),
`renderBackground` becomes `track`, `multiColor` is dropped, and the default stroke is `currentColor` rather
than a hardcoded blue - pass `color` to paint it with an app-registered color theme. The
`PROGRESS_SPINNER_DEFAULT_OPTIONS` token is gone too; set `diameter` and `strokeWidth` per instance. The
successor also comes with a progress bar and a brand loader. This page documents the CDK version, which
still receives bug fixes.
:::

```html
<!-- endless -->
<et-spinner />

<!-- percentage -->
<et-progress-spinner [value]="uploadPercent()" [diameter]="48" renderBackground />
```

```ts
import { ProgressSpinnerComponent } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-progress-spinner--default" height="240px" />

## The two selectors pick the mode

The component answers to both `et-progress-spinner` and `et-spinner`, and the tag you use decides the default `mode`: `et-progress-spinner` starts out `'determinate'`, `et-spinner` starts out `'indeterminate'`. Set `mode` explicitly to override it either way - the tag is only a default, not a lock.

## Options

| Input              | Default                       | Purpose                                                                       |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------------- |
| `mode`             | from the selector (see above) | `'determinate'` or `'indeterminate'`.                                         |
| `value`            | `0`                           | Progress in percent, clamped to 0–100. Reads back as `0` while indeterminate. |
| `diameter`         | `100`                         | Outer size in px; also sets the host's `width`/`height`.                      |
| `strokeWidth`      | `diameter / 10`               | Ring thickness in px. Follows the diameter unless you set it.                 |
| `renderBackground` | `false`                       | Draw the full ring behind the progress arc as a track.                        |
| `multiColor`       | `false`                       | Cycle the indeterminate arc through four colors instead of one.               |

`PROGRESS_SPINNER_DEFAULT_OPTIONS` (provided in root) changes the `diameter` and `strokeWidth` defaults app-wide:

```ts
providers: [
  {
    provide: PROGRESS_SPINNER_DEFAULT_OPTIONS,
    useValue: { diameter: 24, strokeWidth: 3 },
  },
],
```

## Accessibility

The host is a `role="progressbar"` with `aria-valuemin="0"` and `aria-valuemax="100"`. In determinate mode it also emits `aria-valuenow`; in indeterminate mode the attribute is omitted, which is what tells assistive technology the duration is unknown. Everything inside is `aria-hidden`, and the host is `tabindex="-1"` so it never becomes a tab stop.

A spinner on its own says "busy" but not what is busy - label the region it belongs to, or pair it with visible text.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). The host carries `et-progress-spinner`, plus `et-circular-progress--indeterminate` and `et-progress-spinner--multi-color` for the current state, and a `mode` attribute with the resolved mode.

| Property                           | Default     | Purpose                                           |
| ---------------------------------- | ----------- | ------------------------------------------------- |
| `--et-progress-spinner-color`      | `#1e88e5`   | The arc color (and `--…-color-1` in multi-color). |
| `--et-progress-spinner-background` | `#1e88e53c` | The track color when `renderBackground` is set.   |
| `--et-progress-spinner-color-2`    | `#f44336`   | Second multi-color stop.                          |
| `--et-progress-spinner-color-3`    | `#ff9800`   | Third multi-color stop.                           |
| `--et-progress-spinner-color-4`    | `#4caf50`   | Fourth multi-color stop.                          |
| `--et-progress-spinner-edges`      | `round`     | `stroke-linecap` of the arc.                      |

The defaults are hardcoded hex values, not theme tokens - set `--et-progress-spinner-color` from your own theming layer. (The [successor](/components/loader#spinner) inherits `currentColor` instead.)
