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

- The ring is pure CSS on `:focus-visible` - mouse clicks don't show it, keyboard focus does. The directive also toggles an `.et-focus-ring--active` class during <kbd>Enter</kbd>/<kbd>Space</kbd> activation, as a hook for a component's own CSS to add an activation flash - the shared stylesheet above doesn't use it itself; `et-checkbox` is the example that does.
- The stylesheet is mounted lazily once, on first use.
- Suppress the ring per element with `focusRingDisabled`: `<span etFocusRing [focusRingDisabled]="true">`. It is deliberately not called `disabled` - on a native control that name would swallow the element's own `[disabled]` binding and leave the control enabled.

## Theming

Override the private custom properties in your component's CSS scope:

```css
.my-custom-trigger.et-focus-ring {
  --_et-focus-ring-offset: 2px; /* default 3px */
  --_et-focus-ring-width: 3px; /* default 2px */
  --_et-focus-ring-color: hotpink; /* default: var(--et-theme-color-primary-solid, currentColor) */
}
```

By default the color follows the active [color theme](/core/theming)'s primary solid, so themed areas get matching rings automatically.
