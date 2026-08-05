# Badge

`et-badge` is a small, non-interactive pill for a status word or a count - "Active", "Beta", "3 new". Unlike [chip](/components/chip), it never removes itself and carries no selection state - reach for a chip when the value is removable or selectable. Import `BADGE_IMPORTS`.

```ts
import { BADGE_IMPORTS } from '@ethlete/components';
```

```html
<et-badge color="success">Active</et-badge>
<et-badge variant="outline">Beta</et-badge>
```

## Live demo

<StoryEmbed id="components-badge--default" height="120px" />

## Options

| Input     | Type                               | Default   | Description                                                                                                            |
| --------- | ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `variant` | `'filled' \| 'tonal' \| 'outline'` | `'tonal'` | `filled` is a solid fill, `tonal` a soft tint, `outline` a transparent fill with a colored border.                     |
| `color`   | registered color theme name        | -         | Applies one of your app's [registered color themes](/core/theming). Unset, the badge picks up the nearest ambient one. |

Theme names are project-specific - the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `success`, `warning`, `danger`).

## Design specs & tokens

Override tokens: `--et-badge-padding-inline`, `--et-badge-min-block-size`, `--et-badge-border-radius`, `--et-badge-font-size`, `--et-badge-font-weight`, `--et-badge-gap`.
