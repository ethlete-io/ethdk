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

<StoryEmbed id="components-description-list--default" height="280px" />

## Why grid, not a row wrapper

`<dl>` renders `<dt>`/`<dd>` as a flat sequence of siblings, not grouped pairs - there's no native "row" element to hang layout on. `et-description-list` sets the `<dl>` itself to `display: grid` with two columns; CSS grid auto-placement then walks the flat `dt, dd, dt, dd, …` sequence two cells at a time, landing each pair on its own row without any JS pairing logic or extra markup. Any content works inside a `<dd>` - text, a badge, a link - it's still just a grid cell.

## Options

No inputs - it's a pure styling attachment to whatever `<dl>` you write; there is nothing to configure beyond the CSS tokens below.

## Accessibility

The real `<dl>`/`<dt>`/`<dd>` elements carry their native term/detail semantics - unlike a `<div>`-based approximation, a screen reader announces the term/detail relationship on its own.

## Theming

Public design tokens: `--et-description-list-row-gap`, `--et-description-list-column-gap`, `--et-description-list-term-min-width`, `--et-description-list-term-font-size`, `--et-description-list-detail-font-size`.

Text color is not configurable per instance - the term reads in the muted surface tone, the detail in the full one (`--et-surface-color-muted-solid` / `--et-surface-color-solid`), the same pairing [empty state](/components/empty-state#theming) uses for its title/description, so a term always reads as secondary to its value.
