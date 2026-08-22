# Tooltip

Hover/focus-triggered descriptive text for an element. Non-interactive by design - it never receives pointer events or focus. For click-triggered, interactive popovers use a [toggletip](/components/toggletip).

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

<StoryEmbed id="components-feedback-tooltip--default" height="360px" />

## Behavior

- Shows on **hover** (after `showDelay`, default 300ms) and on **keyboard focus** (immediately - and only for focus made visible by the keyboard, so clicking a button doesn't pop its tooltip).
- Hides when neither hover nor focus remains, or on <kbd>Escape</kbd>.
- The overlay is fully passive: non-modal, no backdrop, never steals focus or pointer events.
- `etTooltipDisabled` disables it; it also hides automatically when the content becomes `null`.
- For programmatic control, grab the directive via `#tooltip="etTooltip"` - it exposes `show()` and `hide()`.

## Positioning

floating-ui anchored, with an arrow pointing at the trigger:

| Input                | Default |
| -------------------- | ------- |
| `placement`          | `'top'` |
| `fallbackPlacements` | -       |
| `offset`             | `8`     |
| `arrowPadding`       | `20`    |
| `viewportPadding`    | `8`     |

The tooltip auto-flips and shifts to stay in the viewport, and auto-hides when its trigger is scrolled out of view.

`arrowPadding` is how close the arrow's base may get to the panel's corners. It has to stay above the panel's corner radius (16px) - on aligned placements (`'bottom-end'`, `'left-start'`, …) and whenever a panel is shifted off center near a viewport edge, the arrow slides all the way to that limit, and a smaller value lets its base ride into the rounded corner.

## Accessibility

The tooltip is a **description**, not a name: the trigger gets `aria-describedby` pointing at a visually hidden description element (or the live tooltip while open), and the tooltip itself has `role="tooltip"`. An `aria-describedby` the trigger already carries is kept - the tooltip appends its id to the list. String content doubles as the description automatically; template content must provide `etTooltipAriaDescription` (enforced in dev mode).

## Theming

Text metrics and padding are public design tokens: `--et-tooltip-font-size`, `--et-tooltip-line-height`, `--et-tooltip-font-weight`, `--et-tooltip-letter-spacing`, `--et-tooltip-padding-inline`, `--et-tooltip-padding-block`. The arrow follows the [surface theme](/core/theming) and can be overridden via `--et-overlay-arrow-background` / `--et-overlay-arrow-border`.

## Error codes

Tooltip misuse throws [`ET14xx` errors](/components/error-codes#tooltip-et14xx) in dev mode - currently only a missing aria description on template tooltips.
