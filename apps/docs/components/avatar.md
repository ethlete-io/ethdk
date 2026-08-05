# Avatar

`et-avatar` represents a user or entity: an image, falling back to initials derived from a `name`, falling back to projected content (e.g. an icon) when neither is set - a failed image load falls back the same way. `et-avatar-group` overlaps a row of avatars into a stack. Import `AVATAR_IMPORTS`.

```ts
import { AVATAR_IMPORTS } from '@ethlete/components';
```

```html
<et-avatar src="/jane.jpg" name="Jane Doe" />
<et-avatar name="Jane Doe" color="brand" />
<et-avatar><et-icon [definition]="USER_ICON" /></et-avatar>
```

## Live demo

<StoryEmbed id="components-avatar--default" height="220px" />

## Options

| Input   | Type                                   | Default    | Description                                                                                                           |
| ------- | -------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `src`   | `string \| null`                       | `null`     | The image URL. A failed load falls back to initials, then to projected content.                                       |
| `name`  | `string \| null`                       | `null`     | Used as the image's `alt` text and, with no `src` (or on a failed load), to derive initials (e.g. "Jane Doe" → "JD"). |
| `size`  | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'`     | Sets the avatar's diameter and font size.                                                                             |
| `shape` | `'circle' \| 'square'`                 | `'circle'` | `square` uses a rounded-square border radius instead.                                                                 |
| `color` | registered color theme name            | -          | Applies one of your app's [registered color themes](/core/theming) to the initials/fallback background.               |

Theme names are project-specific - the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `success`, `warning`, `danger`).

## Avatar group

`et-avatar-group` overlaps its projected `et-avatar` children into a stack, each ringed so it reads apart from its neighbor. Project the avatars you want shown, in order - including any "+N" overflow indicator, itself just another `et-avatar` with initials text:

```html
<et-avatar-group>
  <et-avatar name="Jane Doe" />
  <et-avatar name="John Smith" />
  <et-avatar>+5</et-avatar>
</et-avatar-group>
```

The group has no size/count logic of its own - give every child avatar the same `size` and slice the list to however many you want visible before rendering an overflow avatar.

## Accessibility

The image's `alt` text comes from `name` (empty when unset, which is a deliberate statement that it carries no information). When you fall back to projected content instead of `name`/`src`, give that content its own accessible label (e.g. an `<et-icon>` with a hidden label, or `aria-label` on the avatar itself).

## Theming

Public design tokens:

- `et-avatar`: `--et-avatar-font-size`, `--et-avatar-font-weight`, `--et-avatar-border-radius`.
- `et-avatar-group`: `--et-avatar-group-overlap`, `--et-avatar-group-ring-width`.

The initials/fallback background and text color come from the nearest [color theme](/core/theming) - set `color` to pick a specific one.
