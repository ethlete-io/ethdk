# Banner

`et-banner` is a static, dismissible page or section message - unlike [notification](/components/notification), which is a transient toast, a banner stays until its consumer removes it or the reader dismisses it. Import `BANNER_IMPORTS`.

```ts
import { BANNER_IMPORTS } from '@ethlete/components';
```

```html
<et-banner type="error" heading="Something went wrong" description="Please try again." dismissible>
  <i etIcon="et-triangle-exclamation"></i>
  <button et-text-button etBannerAction type="button">Retry</button>
</et-banner>
```

## Live demo

<StoryEmbed id="components-banner--info" height="200px" />

## Anatomy

`et-banner` renders three optional pieces, in this order:

1. An icon, projected via `[etIcon]` - any [icon](/components/icon). Not rendered automatically from `type`; pick the one that matches your message.
2. `heading` - a short string input.
3. `description` - a longer string input.
4. Actions, projected via `[etBannerAction]` - typically a [button](/components/button).

A dismiss button renders after all of it when `dismissible` is set, and emits `dismiss` on click - the banner doesn't remove itself; render it conditionally on your own state (`@if`) and unset that state on `(dismiss)`.

<StoryEmbed id="components-banner--warning" height="200px" />

## Semantic coloring

`type` picks the panel's color: `success`, `warning` and `error` resolve to whatever theme your app registered with that `type` (see [theming](/core/theming)) via `injectSuccessTheme()` / `injectWarningTheme()` / `injectErrorTheme()`. Only the type actually rendered is looked up, so an app that only ever shows `info`/`error` banners never needs to register `warning` or `success` themes.

`info` (the default) has no registered theme of its own - there is no `type: 'info'` slot in the theme registry - so it renders untinted by default. Pass `color` to tint an informational banner explicitly:

```html
<et-banner type="info" color="brand" heading="New feature" description="Try out the new dashboard." />
```

`color` overrides the type-driven default for any type, the same escape hatch [query-error](/components/query-error) offers for its error theme.

<StoryEmbed id="components-banner--error" height="200px" />

## Options

| Input         | Type                                             | Default  | Description                                                                          |
| ------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| `heading`     | `string`                                         | -        | Short headline, rendered as a `<p class="et-banner-heading">`.                       |
| `description` | `string`                                         | -        | Supporting copy, rendered as a `<p class="et-banner-description">`.                  |
| `type`        | `'info' \| 'success' \| 'warning' \| 'error'`    | `'info'` | Drives the default color theme and the `role` (see [Accessibility](#accessibility)). |
| `color`       | `RegisteredColorThemeName \| ColorTheme \| null` | `null`   | Overrides the type's default color.                                                  |
| `dismissible` | `boolean`                                        | `false`  | Renders a dismiss button.                                                            |

| Output    | Type           | Description                            |
| --------- | -------------- | -------------------------------------- |
| `dismiss` | `output<void>` | The reader clicked the dismiss button. |

## Accessibility

The host's `role` follows `type`: `alert` (assertive) for `warning`/`error`, `status` (polite) for `info`/`success` - a warning or error interrupts, an informational or success message doesn't need to. Render the banner conditionally (`@if`) for the role to announce on appearance, the same as [query-error](/components/query-error#accessibility).

The dismiss button's accessible label comes from `injectBannerLabels()` / `provideBannerLabels({ dismiss: '...' })`, the same localization convention every domain in this library shares.

## Theming

Public design tokens: `--et-banner-gap`, `--et-banner-padding`, `--et-banner-border-radius`, `--et-banner-icon-size`, `--et-banner-heading-size`, `--et-banner-heading-weight`, `--et-banner-description-size`.

There is no global "warning color" or "success color" variable - each is a theme your app registers with the matching `type`, the same theming model [query-error](/components/query-error#theming) uses for its error color. Inside the resolved color scope, `--et-theme-color-primary-*` **is** that color, so the panel's tint, border and icon all follow it, and any projected action inherits it without being told.
