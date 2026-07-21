# Mixed state (bulk editing)

When one form edits several records at once and their current values differ, a control can't honestly display any single value. The `mixed` state solves this: the control presents an explicit "values differ" state without touching the underlying form value, and the first thing the user commits replaces the value for every edited record.

<StoryEmbed id="components-forms-select--mixed" height="420px" />

## The contract

`mixed` behaves identically on every control that has it. These rules are enforced by a shared conformance test suite (`libs/components/src/lib/forms/testing/mixed-state-contract.ts`) that every implementing control runs in CI — they are guaranteed, not conventions:

1. **Presentation only.** While `mixed` is `true`, the raw form value stays untouched and is masked: it is not displayed, and nothing (option, chip, star, thumb, aria state) reports it as selected. The host element exposes `data-mixed` for styling.
2. **First commit replaces.** The first value the user commits replaces the raw value outright — multi-value controls start a fresh array containing only the committed entry; nothing toggles against or merges with the hidden value. The commit resolves `mixed` to `false`; afterwards the control behaves normally.
3. **Explicitly controlled.** `mixed` is two-way bindable and only user interaction (or you) resolves it. External/programmatic value writes — server data arriving, form resets — do **not** change it; set `mixed` to `false` yourself when external data establishes a single value.
4. **Clear resolves.** A control's clear affordance writes its empty shape (`null`, `''`, `[]`, …) and resolves `mixed`.
5. **No mass-clear by accident.** Keyboard deletion never wipes a hidden multi-value selection (e.g. Backspace in a mixed multi select is a no-op) — the visible clear affordance is the destructive path.
6. **Validation sees the raw value.** `mixedLabel` is never a form value; `required` and friends keep evaluating the real (hidden) value.

## API

Every implementing control:

| Member        | Type      | Notes                                                                           |
| ------------- | --------- | ------------------------------------------------------------------------------- |
| `mixed`       | `boolean` | Two-way bindable (`[(mixed)]`). Default `false`.                                |
| `mixedChange` | output    | Emits when a user commit or clear resolves the state.                           |
| `mixedLabel`  | `string`  | Default `'Mixed'`. Only on controls with a text display slot (see table below). |

## Control coverage

| Control                                                                                            | Mixed presentation                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `et-select` (single, multi, searchable, virtualized)                                               | Trigger shows `mixedLabel`; chips hidden; no option `aria-selected`                      |
| `et-cascader`                                                                                      | Trigger shows `mixedLabel`; no node selected in columns/breadcrumb                       |
| `et-input`, `et-number-input`, `et-password-input`                                                 | Field renders empty with `mixedLabel` as placeholder; typing commits                     |
| `et-textarea`                                                                                      | Same as inputs                                                                           |
| `et-color-input`                                                                                   | Neutral swatch (raw color never shown); value slot shows `mixedLabel`; picking commits   |
| `et-date-input`, `et-time-input`, `et-date-time-input`, `et-date-range-input`, `et-duration-input` | Field empty with `mixedLabel` placeholder; picker highlights nothing; parse/pick commits |
| `et-tag-input`                                                                                     | Chips hidden; `mixedLabel` placeholder; first added tag starts a fresh array             |
| `et-phone-input`                                                                                   | Number field masked; country picking alone neither leaks the hidden number nor resolves  |
| `et-slider`, `et-range-slider`                                                                     | `aria-valuenow` removed, `aria-valuetext` = `mixedLabel`; thumbs parked + dimmed         |
| `et-rating`                                                                                        | No stars filled; `aria-valuenow` removed, `aria-valuetext` = `mixedLabel`                |
| `et-radio-group`, `et-checkbox-group`, `et-segmented-button-group`                                 | Nothing `aria-checked`; first pick replaces                                              |

### Deliberate boundaries

- **`et-checkbox`** already expresses this concept through the platform-named API: `indeterminate` / `aria-checked="mixed"`, with the native resolution behavior (activating an indeterminate checkbox checks it). Boolean tri-state is `indeterminate`, not `mixed` — the names differ because the platform's do.
- **`et-switch` deliberately has no mixed state.** ARIA defines `role="switch"` as strictly two-state — `aria-checked="mixed"` is invalid — so a mixed switch cannot be represented to assistive technology. Use `et-checkbox` for tri-state booleans in bulk editors.
- **`et-otp-input`, `et-dropzone`, and the rich text editors** are not bulk-edit fields; they have no mixed state. `et-choice-field` is layout chrome — the control it wraps carries the state.
- **`etInputMask`** decorates `et-input` and inherits its mixed behavior.

## Wiring a bulk editor

```html
<et-select [(mixed)]="ownerIsMixed" [formField]="form.owner" mixedLabel="Mixed" placeholder="Pick an owner">
  @for (owner of owners; track owner.id) {
  <et-select-option [value]="owner.id">{{ owner.name }}</et-select-option>
  }
</et-select>
```

- Initialize each field: if all selected records agree, set the value and `mixed = false`; if they differ, set `mixed = true` (the raw value can be anything — it stays hidden).
- On submit, patch only the fields the user actually resolved (`mixed === false` **and** dirty). A field still mixed means "don't touch this field on any record".
- To offer "un-decide" per field, keep a reset affordance in the form that restores `mixed = true` — the control itself never re-enters mixed from user interaction.

## For contributors

A control that grows a `mixed` input **must** run `describeMixedStateContract` from `libs/components/src/lib/forms/testing/mixed-state-contract.ts` in its spec (see the harnesses at the end of `select.directive.spec.ts`) and follow the naming above exactly. The contract file's doc comment is the normative text.
