# Description list

`et-description-list` styles a native `<dl>` for term/detail rows - grid auto-placement pairs each `<dt>`/`<dd>` into its own row, so there is no wrapper component for a "row": write plain semantic markup and the layout follows. Distinct from [forms](/components/forms)' `et-description` (a single hint/help line under an input) - unrelated component, unrelated name on purpose. Import `DESCRIPTION_LIST_IMPORTS`.

```ts
import { DESCRIPTION_LIST_IMPORTS } from '@ethlete/components';
```

```html
<dl et-description-list>
  <dt>Name</dt>
  <dd>Jane Doe</dd>
  <dt>Email</dt>
  <dd>jane&#64;example.com</dd>
</dl>
```

## Live demo

<StoryEmbed id="components-data-display-description-list--default" height="280px" />

## Variants

`variant="inline"` (the default) keeps the term beside its detail in two columns - the term column is as wide as its longest term, but never narrower than `--et-description-list-term-min-width`. `variant="stacked"` drops to one column and puts each term above its detail, which is what you want when the details are long, the layout is narrow, or the terms are too varied in length for a shared column to look intentional.

```html
<dl et-description-list variant="stacked">
  <dt>Name</dt>
  <dd>Jane Doe</dd>
</dl>
```

<StoryEmbed id="components-data-display-description-list--stacked" height="280px" />

Switching between them is a plain binding, so a narrow layout can go stacked from a media query in the consumer's own code:

```html
<dl [variant]="isNarrow() ? 'stacked' : 'inline'" et-description-list>
  <dt>Name</dt>
  <dd>Jane Doe</dd>
</dl>
```

## Why grid, not a row wrapper

`<dl>` renders `<dt>`/`<dd>` as a flat sequence of siblings, not grouped pairs - there's no native "row" element to hang layout on. `et-description-list` sets the `<dl>` itself to `display: grid`; CSS grid auto-placement then walks the flat `dt, dd, dt, dd, …` sequence a cell at a time, landing each pair on its own row (`inline`) or each term and detail on its own row (`stacked`), without any JS pairing logic or extra markup. Any content works inside a `<dd>` - text, a badge, a link - it's still just a grid cell.

## Options

| Input     | Type                    | Default    | Description                                                                          |
| --------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `variant` | `'inline' \| 'stacked'` | `'inline'` | Term beside its detail in two columns, or above it in one. See [Variants](#variants) |

Everything else is a CSS token - see [Theming](#theming).

## Accessibility

The real `<dl>`/`<dt>`/`<dd>` elements carry their native term/detail semantics - unlike a `<div>`-based approximation, a screen reader announces the term/detail relationship on its own.

## Theming

Public design tokens: `--et-description-list-row-gap`, `--et-description-list-column-gap`, `--et-description-list-term-min-width`, `--et-description-list-stacked-term-gap`, `--et-description-list-term-font-size`, `--et-description-list-detail-font-size`.

`--et-description-list-row-gap` separates one term/detail pair from the next in both variants. In `stacked`, `--et-description-list-stacked-term-gap` (default `2px`) is the tighter gap _inside_ a pair, between a term and its own detail - that difference is what makes a stacked pair read as one unit. `--et-description-list-column-gap` and `--et-description-list-term-min-width` only apply to `inline`, which is the only variant with two columns.

Text color is not configurable per instance - the term reads in the muted surface tone, the detail in the full one (`--et-surface-color-muted-solid` / `--et-surface-color-solid`), the same pairing [empty state](/components/empty-state#theming) uses for its title/description, so a term always reads as secondary to its value.
