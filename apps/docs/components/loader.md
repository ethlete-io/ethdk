# Loaders

Three loading indicators, all exposing `role="progressbar"` with correct determinate/indeterminate aria values. Colors come from `currentColor`.

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
