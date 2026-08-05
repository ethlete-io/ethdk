# Card

`et-card` is a generic content container - the padded, bordered or shadowed box every dashboard reaches for. Content is yours; the card only owns the surrounding chrome. Import `CARD_IMPORTS`.

```ts
import { CARD_IMPORTS } from '@ethlete/components';
```

```html
<et-card variant="elevated">
  <h3>Revenue</h3>
  <p>$12,400 this month</p>
</et-card>
```

## Live demo

<StoryEmbed id="components-card--default" height="220px" />

## Options

| Input     | Type                                   | Default      | Description                                                                                          |
| --------- | -------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `variant` | `'elevated' \| 'outlined' \| 'filled'` | `'outlined'` | `outlined` adds a border, `elevated` adds a shadow instead, `filled` is a plain surface-colored box. |
| `surface` | registered surface theme name          | -            | Applies one of your app's [registered surface themes](/core/theming), scoping its own content to it. |

Unset, a card sits on whatever surface it's placed on - set `surface` when it should read as its own elevated panel regardless of context.

## Design specs & tokens

Override tokens: `--et-card-padding`, `--et-card-gap`, `--et-card-border-radius`.
