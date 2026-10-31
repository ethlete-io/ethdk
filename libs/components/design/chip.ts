import chipBase from '../src/lib/chip/chip.component.css?inline';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { iconMarkup } from './icon';

export type ChipMockOptions = {
  label: string;
  removable?: boolean;
  disabled?: boolean;
  /** The role `etSelectionOption` gives the chip: `checkbox` in a multiple selection list, `radio` in a single one. */
  selection?: 'checkbox' | 'radio';
  selected?: boolean;
  readonly?: boolean;
  /** A color theme name the app registers. Left out, the chip takes the color theme around it. */
  color?: string;
  /** Extra attributes on the remove button, e.g. design markers. */
  removeAttributes?: string;
  /** Extra attributes on the chip, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `chip()` draws with: the real chip and icon CSS. */
export const chipStyles = /* @__PURE__ */ [
  iconBase,
  chipBase,
  `@layer components {
  .et-chip-mock-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
}`,
].join('\n');

let labelCount = 0;

/** Draws an `et-chip` as the component renders it, alone or as an `etSelectionOption`, as HTML. */
export const chip = (options: ChipMockOptions) => {
  const labelId = `et-chip-label-mock-${labelCount++}`;
  const removeButton = options.removable
    ? `<button ${options.removeAttributes ?? ''} aria-describedby="${labelId}" etChipRemove type="button" aria-label="Remove" class="et-chip-remove-button"${options.disabled ? ' disabled' : ''}>${iconMarkup(TIMES_ICON)}</button>`
    : '';
  const selection = options.selection
    ? [
        `etSelectionOption role="${options.selection}" aria-checked="${!!options.selected}"`,
        options.readonly ? 'data-readonly' : '',
        options.readonly && options.selection === 'checkbox' ? 'aria-readonly="true"' : '',
        `tabindex="${options.disabled ? -1 : 0}"`,
      ]
    : [];
  const attributes = [
    options.attributes ?? '',
    ...selection,
    options.disabled ? 'data-disabled="true" aria-disabled="true"' : '',
    options.removable ? 'data-removable="true"' : '',
    `class="et-chip et-color--${options.color ?? 'inherited'}"`,
  ].filter(Boolean);

  return `<et-chip ${attributes.join(' ')}><span id="${labelId}" class="et-chip-label">${options.label}</span>${removeButton}</et-chip>`;
};

/** Draws chips in a wrapping row, as a chip list or selection list lays them out. */
export const chipRow = (chips: string[]) => `<div class="et-chip-mock-row">${chips.join('')}</div>`;
