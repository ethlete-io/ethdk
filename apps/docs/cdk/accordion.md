# Accordion

Expandable panels with an animated open/close, template slots for the header, and optional exclusive-open grouping.

::: warning Superseded by @ethlete/components
New code should use the [components accordion](/components/accordion) (`ACCORDION_IMPORTS`). `label`,
`isOpen`, `isOpenByDefault`, `disabled` and `et-accordion-group[autoCloseOthers]` all carry over; the
header slots are renamed (`et-accordion-label-wrapper` → `etAccordionLabel`, `et-accordion-hint-wrapper` →
`etAccordionHint`), and it adds `headingLevel`, arrow-key navigation between headers, a deferred-content
slot (`etAccordionContent`) and colors from the [surface/color theming](/core/theming) systems. This page
documents the CDK version, which still receives bug fixes.
:::

```html
<et-accordion [isOpenByDefault]="false" label="Some accordion">
  <p>Panel content…</p>
</et-accordion>
```

```ts
import { AccordionImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-accordion--default" height="260px" />

## Options

| Input (on `et-accordion`) | Default | Purpose                                                         |
| ------------------------- | ------- | --------------------------------------------------------------- |
| `label`                   | `''`    | Header text (ignored when a custom label template is provided). |
| `isOpen`                  | `false` | Two-way bindable open state (`[(isOpen)]`).                     |
| `isOpenByDefault`         | `false` | Open the panel once on init.                                    |
| `disabled`                | `false` | Disables the header toggle.                                     |

The component also exposes `open()`, `close()` and `toggleAccordionOpen()` for programmatic control.

## Custom label & hint

Replace the plain-text label, or add a hint on the right side of the header, with template slots:

```html
<et-accordion label="Fallback label">
  <ng-template et-accordion-label-wrapper>
    <span et-accordion-label>Custom <strong>label</strong></span>
  </ng-template>

  <ng-template et-accordion-hint-wrapper>
    <span et-accordion-hint>3 items</span>
  </ng-template>

  <p>Panel content…</p>
</et-accordion>
```

## Groups

Wrap accordions in `et-accordion-group` to make them exclusive - with `autoCloseOthers` (default `false`), opening one closes the rest:

```html
<et-accordion-group autoCloseOthers>
  <et-accordion label="One">…</et-accordion>
  <et-accordion label="Two">…</et-accordion>
</et-accordion-group>
```

<StoryEmbed id="cdk-accordion-group--default" height="320px" />

## Behavior & accessibility

The expand/collapse is a pure CSS grid-rows transition (300ms), so the panel animates to its natural height without measuring. The header is a real button with `aria-expanded` / `aria-controls`; the body is a `role="region"` that becomes `inert` while closed, and the chevron icon rotates with the state.

## Styling

Style against `et-accordion`, `et-accordion-header`, `et-accordion-body` (`--open` modifier), `et-accordion-label`, `et-accordion-hint` and `et-accordion-separator`. A header with a hint gets `et-accordion-has-hint`. The chevron size is exposed as `--chevron-size`.
