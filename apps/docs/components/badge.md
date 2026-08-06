# Badge

`et-badge` is a small, non-interactive pill for a status word or a count - "Active", "Beta", "3 new". Unlike [chip](/components/chip), it never removes itself and carries no selection state - reach for a chip when the value is removable or selectable. Import `BADGE_IMPORTS`.

```ts
import { BADGE_IMPORTS } from '@ethlete/components';
```

```html
<et-badge color="success">Active</et-badge> <et-badge variant="outline">Beta</et-badge>
```

## Live demo

<StoryEmbed id="components-badge--default" height="120px" />

## Options

| Input           | Type                               | Default   | Description                                                                                                            |
| --------------- | ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `variant`       | `'filled' \| 'tonal' \| 'outline'` | `'tonal'` | `filled` is a solid fill, `tonal` a soft tint, `outline` a transparent fill with a colored border.                     |
| `size`          | `'sm' \| 'md' \| 'lg'`             | `'md'`    | Scales the padding, minimum height and font size together. An icon in the slot follows the font size.                  |
| `iconAlignment` | `'start' \| 'end'`                 | `'start'` | Which side of the label the icon slot sits on.                                                                         |
| `color`         | registered color theme name        | -         | Applies one of your app's [registered color themes](/core/theming). Unset, the badge picks up the nearest ambient one. |

Theme names are project-specific - the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `success`, `warning`, `danger`).

## Icons

An element carrying [`etIcon`](/components/icon) is projected into the badge's icon slot; everything else you project becomes the label. The slot sizes the icon to `1em`, so it tracks `size` (and any `--et-badge-font-size` you set) without a per-icon width.

```html
<et-badge color="success">
  <i etIcon="et-check"></i>
  Verified
</et-badge>

<et-badge iconAlignment="end" size="lg">
  Featured
  <i etIcon="et-star"></i>
</et-badge>
```

The icon is decorative by default (`aria-hidden`), which is right when it sits next to a label. A badge whose icon _is_ the content needs a name on the icon: `<i etIcon="et-check" label="Verified"></i>`.

## Design specs & tokens

Override tokens: `--et-badge-padding-inline`, `--et-badge-min-block-size`, `--et-badge-border-radius`, `--et-badge-font-size`, `--et-badge-font-weight`, `--et-badge-gap`.

`size="md"` is the token defaults, left unset by the stylesheet - so a token you set on an ancestor reaches every `md` badge under it. `sm` and `lg` set the four sizing tokens on the badge itself and therefore win over an ancestor override; restyle those per size, or reach for `md` plus your own tokens.
