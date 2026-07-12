# Button

Five button flavors, all attribute selectors on native `<button>` or `<a>` elements, plus a [split button](#split-button) container that groups two of them into one control. Import `BUTTON_IMPORTS`; icons inside buttons come from the [icon system](/components/icon).

| Flavor         | Selector                     | For                                                          |
| -------------- | ---------------------------- | ------------------------------------------------------------ |
| Surface button | `[et-button]`                | The standard button — label with optional icon               |
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

- `variant`: `'filled' | 'outline' | 'tonal' | 'transparent'` — surface buttons default to `filled`, icon buttons to `transparent`. Text buttons and window controls have no variant.
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` (default `md`; window controls: `sm | md | lg`).
- `color` applies one of your app's [registered color themes](/core/theming). Theme names are project-specific — the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `danger`, …).
- `iconAlignment`: `'start' | 'end'` positions the `[etIcon]` slot relative to the label (surface, text and FAB buttons — the single-icon flavors don't have it).

## States

All flavors share the headless `ButtonDirective` (`[etButton]`):

- `disabled` and `loading` both make the button **inactive**: native `disabled` on `<button>`, `tabindex="-1"` on `<a>`, plus `aria-disabled`.
- `loading` additionally overlays a size-matched spinner (`aria-busy`) on top of the hidden label.
- `pressed` (surface / icon / window-control buttons) marks toggle state — `aria-pressed` is emitted by default, and the visual **variant swaps** while pressed (e.g. `filled` ↔ `outline`) so the toggle reads at a glance. The `emitAriaPressed` opt-out is only bindable on the raw headless `[etButton]`, not on the styled flavors.
- `mutedUntilPressed` (surface / icon buttons) keeps the button neutral until pressed, only then adopting its color theme — useful for toolbars.
- `type` defaults to `'button'`, so forms don't submit accidentally.

## Anchors

Every flavor works on `<a>` for navigation with identical styling:

```html
<a et-button href="/pricing" variant="outline">See pricing</a>
```

## Split button

`<et-split-button>` groups two buttons into one control: an action segment for the primary action and a trigger segment (usually a chevron icon button) that opens a [menu](/components/menu) with related actions. It's a composition, not a sixth flavor — the segments are regular buttons, so every variant, size, color and state applies unchanged. The container joins the corners, draws a divider between the segments, and sets `role="group"`.

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

- Give both segments the **same `variant`, `size` and `color`** — the container aligns their heights and outer corner radius, but the segment inputs stay yours to set.
- Both segments are **required**; a missing one throws in dev mode (see [error codes](#error-codes)).
- The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%, so it adapts to the variant).
- For custom-styled split buttons, the headless `SplitButtonDirective` (`[etSplitButton]`) plus the two segment directives carry the grouping semantics without the default styling.

## Accessibility

All flavors keep native `<button>` / `<a>` semantics — no custom key handling, no role juggling. On top of that the headless directive emits `aria-busy` while loading, `aria-disabled` (plus native `disabled` on buttons, `tabindex="-1"` on anchors) while inactive, and `aria-pressed` for toggles; the loading spinner overlay is `aria-hidden`. Keyboard focus shows the shared [focus ring](/components/focus-ring).

One thing that stays your job: icon-only buttons have no text content, so always give them an `aria-label` (this is not enforced). That includes a split button's trigger segment; with `etMenuTrigger` on it, the menu system adds `aria-haspopup` / `aria-expanded` for you.

## Design specs & tokens

Base override tokens: `--et-button-border-radius`, `--et-button-border-width`, `--et-button-font-size`, `--et-button-font-weight`, `--et-button-gap`, `--et-button-line-height`, `--et-button-padding`, `--et-button-opacity-disabled`, `--et-button-cursor`. The split button adds `--et-split-button-divider-color`.

Full per-flavor design specs (anatomy, exact paddings per size, pressed-state variant maps, the complete CSS custom property override API) live in Storybook's docs pages: [Surface](https://next-ethlete-sdk.web.app/?path=/docs/components-button-surface--docs), [Text](https://next-ethlete-sdk.web.app/?path=/docs/components-button-text--docs), [Icon](https://next-ethlete-sdk.web.app/?path=/docs/components-button-icon--docs), [FAB](https://next-ethlete-sdk.web.app/?path=/docs/components-button-fab--docs), [Window Control](https://next-ethlete-sdk.web.app/?path=/docs/components-button-window-control--docs), [Split](https://next-ethlete-sdk.web.app/?path=/docs/components-button-split--docs).

## Error codes

The split button's structural checks throw in the `ET23xx` range — see [error codes](/components/error-codes#split-button-et23xx).
