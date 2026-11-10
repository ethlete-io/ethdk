# Tooltip

Hover-, focus- and long-press-triggered descriptive text for an element. Non-interactive by design - it never receives pointer events or focus. For click-triggered, interactive popovers use a [toggletip](/components/toggletip).

Import `TOOLTIP_IMPORTS` (no provider needed) and attach `[etTooltip]`:

```html
<!-- text content -->
<button [etTooltip]="'Saves the current draft'" et-button>Save</button>

<!-- template content - an aria description is then required -->
<button
  [etTooltip]="richTooltip"
  etTooltipAriaDescription="Saves the current draft. Last saved 5 minutes ago."
  et-button
>
  Save
</button>

<ng-template #richTooltip>
  Saves the current draft.<br />
  <strong>Last saved 5 minutes ago.</strong>
</ng-template>
```

```ts
import { TOOLTIP_IMPORTS } from '@ethlete/components';
```

## Live demo

@example tooltip/tooltip-default 360px

## Behavior

- Shows on **hover** (after `showDelay`, default 300ms) and on **keyboard focus** (immediately - and only for focus made visible by the keyboard, so clicking a button doesn't pop its tooltip).
- On **touch**, a **long press** (500ms) shows it. A normal tap does only the element's own action and never opens the tooltip. After the finger lifts, the tooltip stays visible for 1.5s, then hides. A press that turns into a scroll opens nothing, so a page still scrolls when the swipe starts on the trigger. This behavior is fixed - there is no input to choose a tap trigger.
- Hides when neither hover nor focus remains, or on <kbd>Escape</kbd> - from anywhere, focus does not have to be on the trigger. The tooltip consumes that <kbd>Escape</kbd> only for overlays, so a dialog it is shown inside stays open, while the trigger and its ancestors still receive it unhandled - a grid that moves focus back on <kbd>Escape</kbd> does so in the same keypress. Closing it, by <kbd>Escape</kbd> or `hide()`, also cancels a hover show still waiting for its delay, so it stays closed until the pointer enters again.
- The overlay is fully passive: non-modal, no backdrop, never steals focus or pointer events. It also never becomes the top layer, so a dialog it shows inside still closes on <kbd>Escape</kbd> and on a backdrop press.
- `etTooltipDisabled` disables it; it also hides automatically when the content becomes `null` or a blank string. A blank string never opens it, so `[etTooltip]="truncated() ? label : ''"` is a valid conditional tooltip.
- For programmatic control, grab the directive via `#tooltip="etTooltip"` - it exposes `show()` and `hide()`.

### Touch devices

Most touch users never long-press a control, so a touch user can miss a tooltip. A tooltip must only repeat or explain what the element already shows. A hint that every user must see - why a game is not ready yet, the rules of a nomination - belongs in a [toggletip](/components/toggletip#icon-trigger), which opens on a tap. For an icon, use an icon-only `et-icon-button` as the toggletip trigger.

While a trigger carries a tooltip on a touch device (`(pointer: coarse)`), the tooltip sets `user-select: none` and `-webkit-touch-callout: none` on it, so a long press selects no text and opens no iOS callout. The Android context menu of a long press on the trigger is prevented and shows the tooltip instead. A disabled or empty tooltip leaves the trigger as it is.

@example tooltip/tooltip-in-dialog 320px

## Positioning

floating-ui anchored, with an arrow pointing at the trigger:

| Input                | Default |
| -------------------- | ------- |
| `placement`          | `'top'` |
| `fallbackPlacements` | -       |
| `offset`             | `8`     |
| `arrowPadding`       | `20`    |
| `viewportPadding`    | `8`     |
| `anchor`             | -       |

`anchor` takes an element for the tooltip to point at instead of the trigger - e.g. one end of a larger hit target. Hover, focus and the accessible description stay on the trigger.

The tooltip auto-flips and shifts to stay in the viewport, and auto-hides when its trigger is scrolled out of view.

`arrowPadding` is how close the arrow's base may get to the panel's corners. It has to stay above the panel's corner radius (16px) - on aligned placements (`'bottom-end'`, `'left-start'`, …) and whenever a panel is shifted off center near a viewport edge, the arrow slides all the way to that limit, and a smaller value lets its base ride into the rounded corner.

## Accessibility

The tooltip is a **description**, not a name: the trigger gets `aria-describedby` pointing at a visually hidden description element (or the live tooltip while open). The description element is created once the tooltip has text, before it is ever shown, so screen readers in browse mode can read it; a tooltip with no text adds no node to `document.body`. The tooltip itself has `role="tooltip"`. An `aria-describedby` the trigger already carries is kept - the tooltip appends its id to the list. String content doubles as the description automatically; template content must provide `etTooltipAriaDescription` (enforced in dev mode).

## Theming

Text metrics and padding are public design tokens: `--et-tooltip-font-size`, `--et-tooltip-line-height`, `--et-tooltip-font-weight`, `--et-tooltip-letter-spacing`, `--et-tooltip-padding-inline`, `--et-tooltip-padding-block`. All of them inherit, so setting one on `et-tooltip` or any ancestor reaches the surface that reads it. The arrow follows the [surface theme](/core/theming) and can be overridden via `--et-overlay-arrow-background` / `--et-overlay-arrow-border`.

## Error codes

Tooltip misuse throws [`ET14xx` errors](/components/error-codes#tooltip-et14xx) in dev mode - currently only a missing aria description on template tooltips.
