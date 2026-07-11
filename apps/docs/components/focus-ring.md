# Focus ring

The keyboard-focus outline used by every interactive component in the library (buttons, checkboxes, tabs, …), exposed as a single directive so custom elements get the identical ring.

```html
<button class="my-custom-trigger" etFocusRing>Custom control</button>
```

Or adopt it in your own component the way the built-ins do:

```ts
@Component({
  selector: '[my-button]',
  hostDirectives: [FocusRingDirective],
})
```

## How it works

- The ring is pure CSS on `:focus-visible` — mouse clicks don't show it, keyboard focus does. The directive also flashes it during <kbd>Enter</kbd>/<kbd>Space</kbd> activation.
- The stylesheet is mounted lazily once, on first use.
- Disable per element with the directive's `disabled` input: `<span etFocusRing [disabled]="true">`. On native form elements the binding also hits the element's own `disabled` property, so there it's rarely what you want.

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
