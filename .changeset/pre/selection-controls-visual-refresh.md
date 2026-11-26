---
'@ethlete/components': minor
---

Forms: visual refresh and new options for the selection controls (checkbox group, radio group, segmented button group, switch, choice field).

- Checkbox options and radios: option labels now render in the regular text color at a fixed size, boxes/circles gained hover tint fills, press feedback and a draw-in checkmark animation; the group label is styled like a form-field label (new `--et-<group>-group-label-font-size` tokens).
- Selection-list groups (`et-checkbox-group`, `et-radio-group`, `et-segmented-button-group`) now support a projected `<et-label>` as group label - it shows the required marker (`*`) and wires `aria-labelledby` automatically. The plain `.et-<group>-label` span still works for label text without the marker.
- Segmented button group: redesigned as a tonal track with a filled active pill that animates between options (flip animation). `--et-segmented-button-border-width` was removed; new tokens `--et-segmented-button-border-radius`, `--et-segmented-button-group-track-padding`, `--et-segmented-button-group-track-radius` and `--et-segmented-button-group-label-font-size`.
- Switch: reworked visuals - the off state uses a neutral tinted track with a smaller muted thumb that grows and slides on toggle, plus a press-stretch effect. Default dimensions changed to a 40×22px track with a 16px thumb.
- New `size` input (`'sm' | 'md' | 'lg'`, default `'md'`) on `et-checkbox-group`, `et-radio-group`, `et-segmented-button-group` and `et-choice-field`, scaling controls, labels and gaps in line with `et-form-field` sizes.
- Group error states now tint the unchecked control borders with the error color (previously only the error message was colored).
- The control CSS tokens (`--et-checkbox-*`, `--et-checkbox-option-*`, `--et-radio-*`, `--et-segmented-button-*`, `--et-switch-*`) are now registered as inheriting custom properties, so overriding them on the component or a wrapper actually reaches the inner elements that consume them.
