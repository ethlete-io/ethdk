# Focus ring

The keyboard-focus outline used by every interactive component in the library (buttons, checkboxes, tabs, …), exposed as a single directive so custom elements get the identical ring.

```html
<button class="my-custom-trigger" etFocusRing>Custom control</button>
```

Or adopt it in your own component the way the built-ins do:

```ts
import { FocusRingDirective } from '@ethlete/components';

@Component({
  selector: '[my-button]',
  hostDirectives: [FocusRingDirective],
})
```

## How it works

- The ring is pure CSS on `:focus-visible` - mouse clicks don't show it, keyboard focus does. The directive also toggles an `.et-focus-ring--active` class during <kbd>Enter</kbd>/<kbd>Space</kbd> activation, as a hook for a component's own CSS to add an activation flash - the shared stylesheet doesn't use it itself; `et-checkbox` is the example that does.
- The stylesheet is mounted lazily once, on first use.
- Suppress the ring per element with `focusRingDisabled`: `<span etFocusRing [focusRingDisabled]="true">`. It is deliberately not called `disabled` - on a native control that name would swallow the element's own `[disabled]` binding and leave the control enabled.

## Theming

Set the public tokens on the element that carries the ring:

```css
.my-custom-trigger.et-focus-ring {
  --et-focus-ring-offset: 2px; /* default 3px */
  --et-focus-ring-width: 3px; /* default 2px */
  --et-focus-ring-color: hotpink; /* default: light-dark(ink, primary) - see below */
}
```

The tokens do not inherit: a token set on a container leaves the rings of the controls inside it alone.

By default the color follows the active [color theme](/core/theming): `--et-theme-color-ink-solid` in the light scheme and `--et-theme-color-primary-solid` in the dark scheme, both through `light-dark()`, so themed areas get matching rings automatically. Ink is the theme's text-safe tone, so the ring keeps its contrast on a light surface where a bright primary would not.
