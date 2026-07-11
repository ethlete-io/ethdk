# Toggletip

Click-triggered popover for on-demand help — unlike a [tooltip](/components/tooltip) it can hold **interactive content** (buttons, links) and moves focus into itself. Import `TOGGLETIP_IMPORTS` (no provider needed).

Attach `[etToggletip]` together with `etToggletipTrigger` to a button:

```html
<!-- text content -->
<button [etToggletip]="'Scores update every 30 seconds.'" et-button etToggletipTrigger type="button">
  Why is this delayed?
</button>

<!-- interactive template content — an aria label is then required -->
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

- `etToggletipTrigger` couples the toggletip to the button it sits on: the button reflects the open state as pressed, and a disabled button disables the toggletip. It requires both an `et-button` and an `etToggletip` on the same element (enforced in dev mode).
- `etToggletipClose` on a button **inside** the content closes it.
- `[data-toggletip-body]` / `[data-toggletip-actions]` are styling hooks — the actions row gets a top border.

## Live demo

<StoryEmbed id="components-toggletip--default" height="380px" />

## Behavior

- **Click** toggles; `open` is a two-way model (`[(etToggletipOpen)]`), plus `show()` / `hide()` / `toggle()` methods.
- Dismisses on outside click and <kbd>Escape</kbd>; non-modal, no backdrop.
- Focus moves to the first tabbable element inside on open and is **restored to the trigger** on close — but it is not trapped.
- `etToggletipDisabled` disables it; it also closes automatically when content becomes `null` or the trigger is disabled.

## Positioning

Same floating-ui anchoring as the tooltip, with an arrow:

| Input                | Default |
| -------------------- | ------- |
| `placement`          | `'top'` |
| `fallbackPlacements` | —       |
| `offset`             | `10`    |
| `arrowPadding`       | `8`     |
| `viewportPadding`    | `8`     |

## Tooltip or toggletip?

| —         | Tooltip                               | Toggletip                                         |
| --------- | ------------------------------------- | ------------------------------------------------- |
| Trigger   | Hover / keyboard focus                | Click                                             |
| Content   | Descriptive text only                 | Text or interactive template                      |
| Focus     | Never moves                           | Moves in (first tabbable), restored on close      |
| Semantics | `role="tooltip"` + `aria-describedby` | `role="dialog"` + `aria-expanded`/`aria-haspopup` |
| Dismissal | Pointer/focus leaves, <kbd>Esc</kbd>  | Outside click, <kbd>Esc</kbd>, close button       |

## Accessibility

A toggletip is a lightweight **dialog**, not a tooltip: the trigger gets `aria-expanded`, `aria-haspopup="dialog"` and `aria-controls`; the overlay opens with `role="dialog"` and an accessible name. String content names it automatically; template content must provide `etToggletipAriaLabel` or `etToggletipAriaLabelledBy` (enforced in dev mode).

## Theming

Public design tokens: `--et-toggletip-font-size`, `--et-toggletip-line-height`, `--et-toggletip-padding-inline`, `--et-toggletip-padding-block`, `--et-toggletip-gap`. The arrow follows the [surface theme](/core/theming) (`--et-overlay-arrow-background` / `--et-overlay-arrow-border`).

## Error codes

Toggletip misuse throws [`ET15xx` errors](/components/error-codes#toggletip-et15xx) in dev mode — a missing accessible name or a trigger without button/toggletip directives.
