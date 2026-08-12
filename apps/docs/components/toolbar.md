# Toolbar

`et-toolbar` is a bar of related controls that share a single tab stop: Tab enters the toolbar on one control, the arrow keys move between them, and the next Tab leaves. That is the [ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), and it is the reason to reach for a toolbar rather than a plain flex row - eight formatting buttons in a row are eight tab stops in the user's way. Import `TOOLBAR_IMPORTS`.

```ts
import { TOOLBAR_IMPORTS } from '@ethlete/components';
```

```html
<et-toolbar aria-label="Text formatting">
  <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Bold">
    <i etIcon="et-bold"></i>
  </button>
  <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Italic">
    <i etIcon="et-italic"></i>
  </button>
  <et-divider orientation="vertical" decorative />
  <button et-icon-button color="surface" pressedColor="inherit" size="sm" type="button" aria-label="Link">
    <i etIcon="et-link"></i>
  </button>
</et-toolbar>
```

## Live demo

<StoryEmbed id="components-layout-toolbar--default" height="240px" />

## Options

| Input         | Type                         | Default        | Description                                                                      |
| ------------- | ---------------------------- | -------------- | -------------------------------------------------------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Lays the controls out in a row or a column, and picks which arrow keys navigate. |

Group related controls with [`et-divider`](/components/divider) - a `vertical` divider in a horizontal toolbar, and the other way round.

<StoryEmbed id="components-layout-toolbar--vertical" height="440px" />

## Which elements become toolbar controls

Every focusable element rendered inside the toolbar - `button`, `a[href]`, `input`, `select`, `textarea` - is a toolbar control, in DOM order. Nothing is marked up per item, deliberately: content arriving through `ng-content`, a `@for`, or a component that owns its own button template can't be made to carry a marker directive, and that dynamic case is exactly what a toolbar is for. Two exceptions:

- **Natively disabled controls are skipped** by arrow navigation - a `disabled` button cannot hold focus at all, so including it would strand the user. Use `aria-disabled` instead of `disabled` if you want a control to stay reachable and announce itself as unavailable.
- **A nested toolbar keeps its own controls.** Controls inside an inner `role="toolbar"` are navigated by that toolbar, not the outer one.

Controls rendered into an overlay - a menu panel opened from a toolbar button - are outside the toolbar element, so they are never toolbar controls.

## Headless

`[etToolbar]` is the behavior on its own: the role, the roving tab stop and the keyboard model, with no layout or chrome. Put it on an element you style yourself when `et-toolbar`'s row is not the shape you need - the [rich text editor](/components/rich-text-editor)'s own toolbar uses it that way.

```html
<div class="my-toolbar" etToolbar aria-label="Text formatting">…</div>
```

## Accessibility

The host is `role="toolbar"` with `aria-orientation` matching `orientation`. **Give it an accessible name** - `aria-label`, or `aria-labelledby` pointing at a visible heading. Without one a screen reader announces that a toolbar is present but not what it acts on, which matters as soon as a page has more than one.

| Key                              | Action                                                    |
| -------------------------------- | --------------------------------------------------------- |
| <kbd>Tab</kbd>                   | Enters the toolbar on its single tab stop, or leaves it   |
| <kbd>←</kbd> / <kbd>→</kbd>      | Previous / next control in a horizontal toolbar, wrapping |
| <kbd>↑</kbd> / <kbd>↓</kbd>      | Previous / next control in a vertical toolbar, wrapping   |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last control                                      |

In a horizontal toolbar the left/right keys follow the writing direction, so they swap under `direction: rtl`. The tab stop stays on the control the user last focused, so <kbd>Shift</kbd>+<kbd>Tab</kbd> back into the toolbar re-enters where they left off.

<StoryEmbed id="components-layout-toolbar--disabled-control" height="240px" />

## Theming

Public design tokens: `--et-toolbar-gap` (default `4px`), `--et-toolbar-padding` (default `4px`), `--et-toolbar-border-radius` (default `8px`), `--et-toolbar-background` (default `transparent`).

The toolbar paints no chrome of its own, because what it needs depends on where it sits - a bar inside a card wants none, one floating over content wants a surface and a border. Set `--et-toolbar-background` from a surface token (`var(--et-surface-background-solid)`) rather than a literal color, and add the border yourself; see [theming](/core/theming).
