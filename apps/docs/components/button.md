# Button

Five button flavors, all attribute selectors on native `<button>` or `<a>` elements. Import `BUTTON_IMPORTS`; icons inside buttons come from the [icon system](/components/icon).

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

## Live demo

<StoryEmbed id="components-button-surface--default" height="400px" />

## Variants, sizes, color

- `variant`: `'filled' | 'outline' | 'tonal' | 'transparent'` — surface buttons default to `filled`, icon buttons to `transparent`. Text buttons and window controls have no variant.
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` (default `md`; window controls: `sm | md | lg`).
- `color` applies one of your app's registered color themes. Theme names are project-specific — the SDK ships none; examples in these guides use the names this repo's Storybook registers (`brand`, `danger`, …).
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

## Accessibility

All flavors keep native `<button>` / `<a>` semantics — no custom key handling, no role juggling. On top of that the headless directive emits `aria-busy` while loading, `aria-disabled` (plus native `disabled` on buttons, `tabindex="-1"` on anchors) while inactive, and `aria-pressed` for toggles; the loading spinner overlay is `aria-hidden`. Keyboard focus shows the shared [focus ring](/components/focus-ring).

One thing that stays your job: icon-only buttons have no text content, so always give them an `aria-label` (this is not enforced).

## Design specs & tokens

Base override tokens: `--et-button-border-radius`, `--et-button-border-width`, `--et-button-font-size`, `--et-button-font-weight`, `--et-button-gap`, `--et-button-line-height`, `--et-button-padding`, `--et-button-opacity-disabled`, `--et-button-cursor`.

Full per-flavor design specs (anatomy, exact paddings per size, pressed-state variant maps, the complete CSS custom property override API) live in Storybook's docs pages: [Surface](https://next-ethlete-sdk.web.app/?path=/docs/components-button-surface--docs), [Text](https://next-ethlete-sdk.web.app/?path=/docs/components-button-text--docs), [Icon](https://next-ethlete-sdk.web.app/?path=/docs/components-button-icon--docs), [FAB](https://next-ethlete-sdk.web.app/?path=/docs/components-button-fab--docs), [Window Control](https://next-ethlete-sdk.web.app/?path=/docs/components-button-window-control--docs).
