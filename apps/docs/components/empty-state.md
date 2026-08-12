# Empty state

`et-empty-state` is a placeholder for a section or page that currently has nothing to show - no search results, an empty list, a not-yet-configured feature. It's a slot-driven layout (icon, title, description, action) rather than a data-fetching or filtering concept - you decide when to render it. Import `EMPTY_STATE_IMPORTS`.

```ts
import { EMPTY_STATE_IMPORTS } from '@ethlete/components';
```

```html
<et-empty-state heading="No results" description="Try a different search term or clear your filters.">
  <i etIcon="et-file"></i>
  <button et-button etEmptyStateAction type="button">Clear filters</button>
</et-empty-state>
```

## Live demo

<StoryEmbed id="components-feedback-empty-state--default" height="320px" />

## Anatomy

`et-empty-state` renders four optional pieces, in this order:

1. An icon, projected via `[etIcon]` - any [icon](/components/icon).
2. `heading` - a short string input.
3. `description` - a longer string input.
4. An action, projected via `[etEmptyStateAction]` - typically a [button](/components/button).

None of the four are required; an unconfigured `<et-empty-state />` renders nothing but its own layout box, so partial states (icon + title only, or description + action only) work without extra input.

## Options

| Input         | Type     | Default | Description                                                              |
| ------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `heading`     | `string` | -       | Short headline, rendered as a `<p class="et-empty-state-title">`.        |
| `description` | `string` | -       | Supporting copy, rendered as a `<p class="et-empty-state-description">`. |

## Accessibility

`et-empty-state` renders plain text and forwards whatever you project - it has no roles or focus behavior of its own. Give a projected `[etIcon]` a `label` when it's the empty state's only visual content and conveys meaning beyond the title/description (see [Icon](/components/icon#accessibility)); otherwise leave it `aria-hidden` (the icon directive's default).

## Theming

Public design tokens: `--et-empty-state-padding`, `--et-empty-state-gap`, `--et-empty-state-icon-size`, `--et-empty-state-max-inline-size`, `--et-empty-state-title-font-size`, `--et-empty-state-description-font-size`.

Text and icon color resolve from the ambient [surface theme](/core/theming) (`--et-surface-color-solid` for the title, `--et-surface-color-muted-solid` for the description and icon) - no color input, no hardcoded colors.
