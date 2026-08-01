# Skeleton

Loading placeholders: compose `et-skeleton-item`s inside an `et-skeleton`, which handles the shimmer animation and screen-reader announcement.

```html
<et-skeleton loadingAllyText="Loading article…">
  <et-skeleton-item class="headline" />
  <et-skeleton-item class="line" />
  <et-skeleton-item class="line" />
</et-skeleton>
```

```ts
import { SkeletonImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-skeleton--default" height="240px" />

Items carry no intrinsic size - give each one its width, height and border-radius in your own CSS.

## Options

| Input             | Default        | Purpose                                           |
| ----------------- | -------------- | ------------------------------------------------- |
| `loadingAllyText` | `'Loading...'` | Visually hidden text announced to screen readers. |
| `animated`        | `true`         | Toggles the shimmer sweep.                        |

## Behavior & accessibility

The wrapper renders the loading text visually hidden; every `et-skeleton-item` is `aria-hidden`, so assistive tech hears one meaningful announcement instead of decorative boxes. The shimmer is wrapped in `@media (prefers-reduced-motion: no-preference)` - users with reduced motion get static placeholders.

## Styling

The shimmer gradient, duration and easing are exposed as `--et-skeleton-gradient`, `--et-skeleton-animation-duration` (3s) and `--et-skeleton-animation-timing-function`. The animation only runs while the host has `et-skeleton--animated`.
