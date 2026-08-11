# Button

Five button flavors, all attribute selectors on native `<button>` or `<a>` elements, plus a [split button](#split-button) container that groups two of them into one control. Import `BUTTON_IMPORTS`; icons inside buttons come from the [icon system](/components/icon).

| Flavor         | Selector                     | For                                                          |
| -------------- | ---------------------------- | ------------------------------------------------------------ |
| Surface button | `[et-button]`                | The standard button - label with optional icon               |
| Text button    | `[et-text-button]`           | No background/border; underline on hover                     |
| Icon button    | `[et-icon-button]`           | Icon only (needs an `aria-label`)                            |
| FAB            | `[et-fab]`                   | Floating action button; `expanded` toggles the extended pill |
| Window control | `[et-window-control-button]` | Titlebar-style controls; `kind: 'default' \| 'close'`        |

```html
<button [loading]="saving()" et-button type="button" variant="filled" size="md" color="brand">
  <i etIcon="et-arrow-right"></i>
  Continue to checkout
</button>

<button et-icon-button type="button" aria-label="Edit item">
  <i etIcon="et-pencil"></i>
</button>

<button [expanded]="true" et-fab type="button">
  <i etIcon="et-plus"></i>
  Create project
</button>
```

```ts
import { BUTTON_IMPORTS } from '@ethlete/components';
```

## Live demo

<StoryEmbed id="components-button-surface--default" height="400px" />

## Variants, sizes, color

- `variant`: `'filled' | 'outline' | 'tonal' | 'transparent'` - surface buttons default to `filled`, icon buttons to `transparent`. Text buttons and window controls have no variant.
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` (default `md`; window controls: `sm | md | lg`).
- `color` applies one of your app's [registered color themes](/core/theming). Theme names are project-specific - the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `danger`, …).
- `iconAlignment`: `'start' | 'end'` positions the `[etIcon]` slot relative to the label (surface, text and FAB buttons - the single-icon flavors don't have it).
- `tone`: `'theme' | 'surface'` (default `theme`, on surface and icon buttons) - see below.

### Surface tone

`tone="surface"` takes the button's color from the [surface](/core/theming) it sits on instead of the
ambient color theme, for the actions that shouldn't compete with the primary one - a cancel next to a
submit, a toolbar of icon buttons, chrome around content:

```html
<button et-button variant="tonal" tone="surface" type="button">Cancel</button>
```

Every variant keeps its structural signature (filled stays a solid-ish fill, outline keeps its
border), so a row of surface-toned buttons still reads as a hierarchy - only the tint source changes,
from `--et-theme-color-*` to the surface's neutral interaction color. Text and border follow the
surface too, so it stays readable on light and dark surfaces alike, and it needs **no neutral color
theme registered**.

A pressed toggle stays surface-toned; its pressed state comes from the usual variant swap. Use
`mutedUntilPressed` instead when the pressed state should pick the color theme up.

## States

All flavors share the headless `ButtonDirective` (`[etButton]`):

- `disabled` and `loading` both make the button **inactive**: native `disabled` on `<button>`, `tabindex="-1"` on `<a>`, plus `aria-disabled`.
- `loading` additionally overlays a size-matched spinner (`aria-busy`) on top of the hidden label.
- `pressed` (surface / icon / window-control buttons) marks toggle state - `aria-pressed` is emitted by default, and the visual **variant swaps** while pressed (e.g. `filled` ↔ `outline`) so the toggle reads at a glance. The `emitAriaPressed` opt-out is bindable on the raw headless `[etButton]` and on icon buttons (for pressed-styled triggers that already announce state via `aria-expanded`), but not on the other styled flavors.
- `mutedUntilPressed` (surface / icon buttons) keeps the button neutral until pressed, only then adopting its color theme - useful for toolbars. It is [surface tone](#surface-tone) released on press; `tone="surface"` keeps it for good.
- `type` defaults to `'button'`, so forms don't submit accidentally.

## Anchors

Every flavor works on `<a>` for navigation with identical styling:

```html
<a et-button href="/pricing" variant="outline">See pricing</a>
```

## Split button

`<et-split-button>` groups two buttons into one control: an action segment for the primary action and a trigger segment (usually a chevron icon button) that opens a [menu](/components/menu) with related actions. It's a composition, not a sixth flavor - the segments are regular buttons, so every variant, size, color and state applies unchanged. The container joins the corners, draws a divider between the segments, and sets `role="group"`.

```html
<div etMenu>
  <et-split-button>
    <button (click)="save()" et-button etSplitButtonAction type="button">Save changes</button>

    <button et-icon-button etSplitButtonTrigger etMenuTrigger type="button" aria-label="More save options">
      <i etIcon="et-chevron"></i>
    </button>
  </et-split-button>

  <ng-template etMenuSurface>
    <et-menu>
      <button et-menu-item type="button">Save as copy</button>
      <button et-menu-item type="button">Save and publish</button>
    </et-menu>
  </ng-template>
</div>
```

<StoryEmbed id="components-button-split--default" height="500px" />

- Give both segments the **same `variant`, `size` and `color`** - the container aligns their heights and outer corner radius, but the segment inputs stay yours to set.
- Both segments are **required**; a missing one throws in dev mode (see [error codes](#error-codes)).
- The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%, so it adapts to the variant).
- For custom-styled split buttons, the headless `SplitButtonDirective` (`[etSplitButton]`) plus the two segment directives carry the grouping semantics without the default styling.

## Accessibility

All flavors keep native `<button>` / `<a>` semantics - no custom key handling, no role juggling. On top of that the headless directive emits `aria-busy` while loading, `aria-disabled` (plus native `disabled` on buttons, `tabindex="-1"` on anchors) while inactive, and `aria-pressed` for toggles; the loading spinner overlay is `aria-hidden`. Keyboard focus shows the shared [focus ring](/components/focus-ring).

One thing that stays your job: icon-only buttons have no text content, so always give them an `aria-label` (this is not enforced). That includes a split button's trigger segment; with `etMenuTrigger` on it, the menu system adds `aria-haspopup` / `aria-expanded` for you.

## Design specs & tokens

Base override tokens, shared by every flavor: `--et-button-border-radius`, `--et-button-border-width`, `--et-button-font-size`, `--et-button-font-weight`, `--et-button-gap`, `--et-button-line-height`, `--et-button-padding`, `--et-button-opacity-disabled`, `--et-button-cursor`.

The two icon-shaped flavors size themselves from their own tokens instead of `padding`: the icon button takes `--et-icon-button-size` (diameter), `--et-icon-button-icon-size` and `--et-icon-button-border-radius`; the FAB takes `--et-fab-size` (collapsed diameter), `--et-fab-icon-size`, `--et-fab-label-font-size` and `--et-fab-contents-gap`. The split button adds `--et-split-button-divider-color`.

Most of them are set **per size** by the component (`--et-button-padding`, the two icon-button sizes, all four FAB sizes, …), in a `:where([data-size='…'])` block on the button itself. Two consequences:

- The override has to land **on the button element**, not on an ancestor - the element's own per-size declaration beats anything inherited. A single class in the selector is enough to win: `.my-toolbar .et-icon-button { … }`.
- An override that isn't scoped by size applies to **every** size. Repeat it per `[data-size='…']` to keep a scale.

```css
/* one tighter scale for a whole toolbar */
.my-toolbar .et-icon-button {
  --et-icon-button-border-radius: 0.8rem;

  &[data-size='sm'] {
    --et-icon-button-size: 2.4rem;
    --et-icon-button-icon-size: 1.4rem;
  }

  &[data-size='md'] {
    --et-icon-button-size: 3.2rem;
    --et-icon-button-icon-size: 1.6rem;
  }
}
```

Full per-flavor design specs (anatomy, exact paddings per size, pressed-state variant maps, the complete CSS custom property override API) live in Storybook's docs pages: [Surface](https://next-ethlete-sdk.web.app/?path=/docs/components-button-surface--docs), [Text](https://next-ethlete-sdk.web.app/?path=/docs/components-button-text--docs), [Icon](https://next-ethlete-sdk.web.app/?path=/docs/components-button-icon--docs), [FAB](https://next-ethlete-sdk.web.app/?path=/docs/components-button-fab--docs), [Window Control](https://next-ethlete-sdk.web.app/?path=/docs/components-button-window-control--docs), [Split](https://next-ethlete-sdk.web.app/?path=/docs/components-button-split--docs).

## Error codes

The split button's structural checks throw in the `ET23xx` range - see [error codes](/components/error-codes#split-button-et23xx).
