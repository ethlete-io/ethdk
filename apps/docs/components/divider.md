# Divider

`et-divider` is the thin rule between two groups of content or controls. Horizontal by default, `orientation="vertical"` for a rule between items in a row. Reach for it when the grouping is not already implied by a container the user can see - a [card](/components/card) boundary, an [accordion](/components/accordion) header, or a [table](/components/table) row already separate their content without one. Import `DIVIDER_IMPORTS`.

```ts
import { DIVIDER_IMPORTS } from '@ethlete/components';
```

```html
<p>Notifications</p>
<et-divider />
<p>Privacy</p>
```

## Live demo

<StoryEmbed id="components-divider--default" height="240px" />

## Options

| Input         | Type                         | Default        | Description                                               |
| ------------- | ---------------------------- | -------------- | --------------------------------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Which way the rule runs.                                  |
| `decorative`  | `boolean`                    | `false`        | Drops the `separator` role, leaving a purely visual rule. |

## Vertical dividers need a flex or grid parent

A horizontal divider fills its container's inline size on its own. A vertical one has no intrinsic length: it takes its block size from the parent's cross axis via `align-self: stretch`, so it is only visible inside a flex or grid parent - or with an explicit `block-size`. This is deliberate; the alternative is a magic default length that is wrong at every call site.

```html
<div class="flex items-center">
  <button et-button>Save</button>
  <et-divider orientation="vertical" decorative />
  <button et-button>Duplicate</button>
</div>
```

<StoryEmbed id="components-divider--vertical" height="200px" />

## Spacing

`--et-divider-spacing` is the margin along the flow direction - the gap between the rule and the content on either side (`margin-block` when horizontal, `margin-inline` when vertical). `--et-divider-inset` is the margin on the other axis, which shortens the rule: an inset vertical divider stops short of its neighbours' full height, the way the [rich text editor](/components/rich-text-editor)'s toolbar groups its tools.

Both tokens inherit, so setting them once on a toolbar or list configures every divider inside it:

```css
.my-toolbar {
  --et-divider-spacing: 2px;
  --et-divider-inset: 4px;
}
```

## Accessibility

By default the host is `role="separator"` with a matching `aria-orientation`, so assistive technology announces the break between groups. Set `decorative` when it would be noise - when the grouping is already conveyed by headings, landmarks or a labelled group - and the host becomes `role="presentation"` with `aria-hidden="true"` instead.

A separator is never focusable and carries no value; `et-divider` is not the `aria-valuenow`-carrying [window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) variant of the role.

## Theming

Public design tokens: `--et-divider-thickness` (default `1px`), `--et-divider-spacing` (default `8px`), `--et-divider-inset` (default `0`).

The rule's color is not a registered token, because it defaults to the surface theme's border color: set `--et-divider-color` to override it, and it falls back to `--et-surface-border-solid`. Keep the override tied to the theme rather than a literal - a `color-mix()` over `currentColor` (what the rich text editor's toolbars use) or another surface token. See [theming](/core/theming) for the token set.
