# Toggletip

Click-triggered popover for on-demand help - unlike a [tooltip](/components/tooltip) it can hold **interactive content** (buttons, links) and moves focus into itself. Import `TOGGLETIP_IMPORTS` (no provider needed).

Attach `[etToggletip]` together with `etToggletipTrigger` to a button:

```html
<!-- text content -->
<button [etToggletip]="'Scores update every 30 seconds.'" et-button etToggletipTrigger type="button">
  Why is this delayed?
</button>

<!-- interactive template content - an aria label is then required -->
<button
  [etToggletip]="helpTemplate"
  etToggletipAriaLabel="About live scores"
  et-button
  etToggletipTrigger
  type="button"
>
  Live scores
</button>

<ng-template #helpTemplate>
  <div data-toggletip-body>Scores update every 30 seconds while a match is live.</div>
  <div data-toggletip-actions>
    <a et-text-button href="/docs/live-scores" size="xs">Learn more</a>
    <button etToggletipClose et-button size="xs" variant="transparent">Dismiss</button>
  </div>
</ng-template>
```

```ts
import { TOGGLETIP_IMPORTS } from '@ethlete/components';
```

- `etToggletipTrigger` couples the toggletip to the button it sits on: the button reflects the open state as pressed, and a disabled button disables the toggletip. It requires both an `et-button` and an `etToggletip` on the same element (enforced in dev mode).
- `etToggletipClose` on a button **inside** the content closes it.
- `[data-toggletip-body]` / `[data-toggletip-actions]` are styling hooks - the actions row gets a top border.
- `[data-toggletip-hug]` on any element in the content drops the panel's comfortable minimum width, so it hugs its widest row instead. For content that is a list of rows rather than a sentence or two - what the [breadcrumb](/components/breadcrumb#overflow) does with its hidden crumbs.

## Live demo

@example toggletip/toggletip-default 380px

## Behavior

- **Click** toggles; `open` is a two-way model (`[(etToggletipOpen)]`), plus `show()` / `hide()` / `toggle()` methods. The model follows a dismissal as soon as it starts, and a `show()` issued while the previous instance is still fading out re-opens once it has left.
- Dismisses on outside click and <kbd>Escape</kbd>; non-modal, no backdrop.
- Focus moves to the first tabbable element inside on open and is **restored to the trigger** on close - but it is not trapped.
- `etToggletipDisabled` disables it; it also closes automatically when content becomes `null` or a blank string, or the trigger is disabled. A blank string never opens it, so `[etToggletip]="hint() ?? ''"` is a valid conditional toggletip.

## Icon trigger

The trigger must be a button with `et-button` or one of its flavors (error `ET1501` otherwise). For an icon, use an icon-only `et-icon-button` with an `aria-label`. This is the touch-friendly answer for a hint on an icon: a [tooltip](/components/tooltip#touch-devices) opens on touch only by long press, a toggletip opens on a tap.

```html
<button
  aria-label="About nomination rules"
  etToggletip="You can change your nomination until the first match of the matchday starts."
  et-icon-button
  etToggletipTrigger
  size="sm"
  type="button"
>
  <i etIcon="et-circle-info"></i>
</button>
```

@example toggletip/toggletip-icon 200px

## Positioning

Same floating-ui anchoring as the tooltip, with an arrow:

| Input                | Default |
| -------------------- | ------- |
| `placement`          | `'top'` |
| `fallbackPlacements` | -       |
| `offset`             | `10`    |
| `arrowPadding`       | `20`    |
| `viewportPadding`    | `8`     |

`arrowPadding` is how close the arrow's base may get to the panel's corners, and has to stay above the panel's corner radius (16px) - see [the tooltip's note](/components/tooltip#positioning).

## Tooltip or toggletip?

| -         | Tooltip                               | Toggletip                                         |
| --------- | ------------------------------------- | ------------------------------------------------- |
| Trigger   | Hover / keyboard focus / long press   | Click / tap                                       |
| Content   | Descriptive text only                 | Text or interactive template                      |
| Focus     | Never moves                           | Moves in (first tabbable), restored on close      |
| Semantics | `role="tooltip"` + `aria-describedby` | `role="dialog"` + `aria-expanded`/`aria-haspopup` |
| Dismissal | Pointer/focus leaves, <kbd>Esc</kbd>  | Outside click, <kbd>Esc</kbd>, close button       |

## Accessibility

A toggletip is a lightweight **dialog**, not a tooltip: the trigger gets `aria-expanded`, `aria-haspopup="dialog"` and `aria-controls`; the overlay opens with `role="dialog"` and an accessible name. String content names it automatically; template content must provide `etToggletipAriaLabel` or `etToggletipAriaLabelledBy` (enforced in dev mode).

## Theming

Public design tokens: `--et-toggletip-font-size`, `--et-toggletip-line-height`, `--et-toggletip-padding-inline`, `--et-toggletip-padding-block`, `--et-toggletip-gap`, `--et-toggletip-letter-spacing` (default `-0.01em`), `--et-toggletip-min-width` (default `min(272px, calc(100vw - 24px))`; `0` lets a short toggletip hug its content). It also reads `--et-floating-tip-radius` and `--et-floating-tip-max-width`, shared with the [tooltip](/components/tooltip#theming). All of them inherit, so setting one on `et-toggletip` or any ancestor reaches the surface and content that read it. The arrow follows the [surface theme](/core/theming) (`--et-overlay-arrow-background` / `--et-overlay-arrow-border`).

## Migrating from the cdk toggletip

The cdk `etToggletip` directive maps to the components `etToggletip` with `etToggletipTrigger` on an `et-button`. Track the open state with the two-way `[(etToggletipOpen)]` model instead of the cdk `toggletipClose` output, and close from inside the content with `etToggletipClose`.

## Error codes

Toggletip misuse reports [`ET15xx` errors](/components/error-codes#toggletip-et15xx) to the `ErrorHandler` in dev mode - a missing accessible name (the toggletip then stays closed) or a trigger without button/toggletip directives.
