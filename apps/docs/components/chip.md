# Chip

`et-chip` is a compact pill for a selected value, tag or filter — with an optional built-in remove button. It is usable anywhere on its own, and it is the building block the upcoming select (multi-select trigger) and tag input compose. Import `CHIP_IMPORTS`.

```ts
import { CHIP_IMPORTS } from '@ethlete/components';
```

```html
<et-chip (remove)="removeTag('Design')" removable>Design</et-chip>
```

## Live demo

<StoryEmbed id="components-chip--default" height="120px" />

## Options

On `et-chip` (forwarded from the headless `[etChip]` directive):

| Input       | Type      | Default | Description                                                                 |
| ----------- | --------- | ------- | --------------------------------------------------------------------------- |
| `disabled`  | `boolean` | `false` | Dims the chip, blocks pointer events and disables removal.                  |
| `removable` | `boolean` | `false` | Shows the remove button and enables removal via pointer, Backspace, Delete. |

| Output   | Payload | Emitted when                                                              |
| -------- | ------- | ------------------------------------------------------------------------- |
| `remove` | `void`  | The remove button is clicked, or Backspace/Delete is pressed on the chip. |

The chip never removes itself from the DOM — removal is a request. Handle `remove` and update your data:

```html
@for (tag of tags(); track tag) {
<et-chip (remove)="removeTag(tag)" removable>{{ tag }}</et-chip>
}
```

Long labels are truncated with an ellipsis; the chip never exceeds its container's inline size.

## Filter chips (selection composition)

Selectable chips — filter bars, tag pickers — are a **composition**, not a dedicated component: put the selection-list headless directives on plain chips. `etSelectionList` is the signal-forms control (single or `multiple`), `etSelectionOption` turns each chip into an option with roving focus and the correct `radio`/`checkbox` semantics; the chip styles its selected state (a color-theme tonal fill) off the resulting `aria-checked`.

```html
<div [formField]="form.categories" [multiple]="true" class="flex flex-wrap gap-2" etSelectionList>
  @for (category of categories(); track category) {
  <et-chip [value]="category" etSelectionOption>{{ category }}</et-chip>
  }
</div>
```

<StoryEmbed id="components-chip--filter-chips" height="320px" />

Everything the [selection lists](/components/choice-inputs#selection-lists) document applies: value is an array with `multiple` and a single value otherwise, arrow keys rove across chips (selecting as they move in single mode), <kbd>Space</kbd>/<kbd>Enter</kbd> toggles, `readonly` keeps the chips focusable but blocks changes. Don't combine `removable` with `etSelectionOption` on the same chip — a filter chip toggles, it doesn't remove.

## Headless usage

For custom chip markup, compose the directives directly — `[etChip]` owns the state and keyboard handling, `[etChipRemove]` wires any element (ideally a `<button>`) as the remove control:

```html
<span [disabled]="disabled()" (remove)="onRemove()" removable etChip>
  Custom chip
  <button [removeLabel]="'Remove custom chip'" etChipRemove>×</button>
</span>
```

| `[etChipRemove]` input | Type             | Default  | Description                        |
| ---------------------- | ---------------- | -------- | ---------------------------------- |
| `removeLabel`          | `string \| null` | `null` ¹ | The remove control's `aria-label`. |

¹ `null` falls through to [`CHIP_LABELS.remove`](/components/localization) (`'Remove'`).

## Accessibility

- The chip host mirrors its state as `aria-disabled` plus `data-disabled` / `data-removable` attributes.
- The remove control is a real `<button type="button">` with an `aria-label` (`removeLabel`), but sits at `tabindex="-1"` — **chips are never tab stops**. Composite widgets (a select trigger, a tag input) move focus across chips virtually; standalone chips are removed via pointer or via Backspace/Delete while the chip element has (programmatic) focus.
- Clicking remove calls `stopPropagation()`, so a chip that is itself clickable doesn't also activate.
- Dev mode throws when `etChipRemove` is placed outside an `[etChip]` element.

## Theming

Colors come from the app-registered [surface theme](/core/theming) (`--et-surface-interaction-solid` tint for the background, `--et-surface-color-*` for text) — there is nothing color-related to override per chip. Public design tokens:

| Token                        | Default | Purpose                             |
| ---------------------------- | ------- | ----------------------------------- |
| `--et-chip-gap`              | `4px`   | Gap between label and remove button |
| `--et-chip-padding-inline`   | `10px`  | Horizontal padding                  |
| `--et-chip-min-block-size`   | `24px`  | Minimum height                      |
| `--et-chip-border-radius`    | `999px` | Corner radius (pill)                |
| `--et-chip-font-size`        | `12px`  | Label font size                     |
| `--et-chip-remove-size`      | `16px`  | Remove button hit area              |
| `--et-chip-opacity-disabled` | `0.4`   | Disabled opacity                    |

## Error codes

The chip domain owns the `ET1100`–`ET1199` range — see [error codes](/components/error-codes#chip-et11xx).
