# Collapse

`et-collapse` animates its content between a height of 0 and its natural height. Reach for it when something has to expand in place - a details block, a revealed form section - and no [accordion](/components/accordion) trigger is involved. Import `COLLAPSE_IMPORTS`.

```ts
import { COLLAPSE_IMPORTS } from '@ethlete/components';
```

```html
<et-collapse [open]="isOpen()">
  <p>Details</p>
</et-collapse>
```

## Live demo

@example collapse/collapse-default 200px

## Options

| Input  | Type      | Default | Description                          |
| ------ | --------- | ------- | ------------------------------------ |
| `open` | `boolean` | `false` | Whether the content is shown or not. |

## Spacing goes on the content

The clip around the content has no padding or border. Under `box-sizing: border-box` either would set a floor under the collapsed height, and the region would pop open to that floor before animating. Put padding and margins on the projected content instead.

## Initial state

A collapse that starts open renders open. `data-can-animate` is set one frame after the first render and only then do transitions apply, so nothing animates on load. Under `prefers-reduced-motion: reduce` the region toggles without a transition.

## Headless directive

`[etCollapse]` (exported as `etCollapse`) is the behavior without the styling: it takes `open` and sets `data-open` while open, `inert` while collapsed and `data-can-animate` after first render. Use it to build a custom expand animation on your own element.

```html
<div [open]="isOpen()" class="my-panel" etCollapse>...</div>
```

## Accessibility

Collapsed content is `inert` and `visibility: hidden`, so it cannot be focused, clicked or read out. The component sets no `aria-expanded` - put that on whatever control toggles it, together with `aria-controls`.

## Theming

Public design tokens: `--et-collapse-duration` (default `240ms`) and `--et-collapse-easing` (default `cubic-bezier(0.25, 0, 0.1, 1)`). Both inherit, so setting them on a parent configures every collapse inside it.
