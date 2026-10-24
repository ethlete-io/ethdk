import controlSuffix from '../src/lib/forms/form-field/form-field-control-suffix-styles.component.css?inline';
import selectBase from '../src/lib/forms/select/select.component.css?inline';
import selectOption from '../src/lib/forms/select/select-option-styles.component.css?inline';
import selectPanel from '../src/lib/forms/select/select-panel.component.css?inline';
import { FormFieldControlMock, formFieldStyles, FormFieldMockState } from './form-field';

export const CHECK_ICON_SVG = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>`;

export const CHEVRON_ICON_SVG = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M244.7 116.7c6.2-6.2 16.4-6.2 22.6 0l192 192c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0L256 150.6 75.3 331.3c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l192-192z"/></svg>`;

export const TIMES_ICON_SVG = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.6 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z"/></svg>`;

export type SelectMockOption = { value: string; label: string };

export type SelectMockOptions = {
  options: SelectMockOption[];
  /** The selected option's `value`. Left out, the select shows its placeholder. */
  value?: string;
  placeholder?: string;
  /** The `value` of the option the keyboard points at while the panel is open. */
  active?: string;
  /** Shows the clear button while the field has focus and a value. Defaults to `true`. */
  clearable?: boolean;
  clearLabel?: string;
  /** The app's default color theme name: the panel provides it to the options. */
  panelColor?: string;
  /** A surface theme name the app registers, for the panel. */
  panelSurface?: string;
};

/** The stylesheets `formField()` with a `select()` control draws with: the real `et-select` CSS. */
export const selectStyles = /* @__PURE__ */ [
  formFieldStyles,
  controlSuffix,
  selectBase,
  selectOption,
  selectPanel,
].join('\n');

const icon = (name: string, svg: string) =>
  `<i eticon="${name}" aria-hidden="true" class="et-icon et-icon--${name}">${svg}</i>`;

/**
 * Draws `<et-select>` as a control for `formField()`. Pass `open: true` to `formField()` to draw
 * the panel below the field, where the overlay would open.
 */
export const select = (options: SelectMockOptions): FormFieldControlMock => {
  const selected = options.options.find((option) => option.value === options.value);

  const optionHtml = (state: FormFieldMockState) => (option: SelectMockOption, index: number) => {
    const isSelected = option === selected;
    const isActive = state.open && option.value === options.active;
    const attributes = [
      'role="option"',
      `value="${option.value}"`,
      'class="et-select-option"',
      `id="et-select-option-${state.id}-${index}"`,
      `aria-selected="${isSelected}"`,
      isSelected && 'data-selected="true"',
      isActive && 'data-active="true" data-active-source="keyboard"',
    ].filter(Boolean);

    return `<et-select-option ${attributes.join(' ')}><span class="et-select-option-label">${option.label}</span><span class="et-select-option-check">${icon('et-check', CHECK_ICON_SVG)}</span></et-select-option>`;
  };

  const optionsHtml = (state: FormFieldMockState) => options.options.map(optionHtml(state)).join('');

  return {
    controlType: 'select',
    hasValue: !!selected,
    expandable: true,
    html: (state) => {
      const triggerId = `et-select-trigger-${state.id}`;
      const activeIndex = options.options.findIndex((option) => option.value === options.active);
      const triggerAttributes = [
        'class="et-select-trigger"',
        `id="${triggerId}"`,
        'role="combobox"',
        'aria-haspopup="listbox"',
        `aria-expanded="${state.open}"`,
        `aria-labelledby="${[state.labelId, triggerId].filter(Boolean).join(' ')}"`,
        `tabindex="${state.disabled ? -1 : 0}"`,
        state.disabled && 'aria-disabled="true" data-disabled="true"',
        state.open && activeIndex >= 0 && `aria-activedescendant="et-select-option-${state.id}-${activeIndex}"`,
        state.open && 'data-select-open="true"',
        state.open && `aria-controls="et-select-listbox-${state.id}"`,
      ].filter(Boolean);

      const value = selected
        ? `<span class="et-select-value">${selected.label}</span>`
        : `<span data-placeholder="true" class="et-select-value">${options.placeholder ?? ''}</span>`;

      const detached = state.open
        ? ''
        : `<div aria-hidden="true" hidden class="et-select-detached-options">${optionsHtml(state)}</div>`;

      return `<et-select class="et-color-interactive et-select"${state.open ? ' data-select-open="true"' : ''}><div ${triggerAttributes.join(' ')}><div class="et-select-trigger-content">${value}</div></div>${detached}</et-select>`;
    },
    suffix: (state) => {
      const clear =
        (options.clearable ?? true) && selected && state.focused && !state.disabled && !state.readonly
          ? `<button aria-label="${options.clearLabel ?? 'Clear'}" class="et-input-clear" tabindex="-1" type="button">${icon('et-times', TIMES_ICON_SVG)}</button>`
          : '';

      return `${clear}<button aria-hidden="true" tabindex="-1" type="button" class="et-input-picker-trigger et-select-arrow"${state.disabled ? ' disabled' : ''}>${icon('et-chevron', CHEVRON_ICON_SVG)}</button>`;
    },
    panel: (state) =>
      `<et-select-panel class="et-select-panel et-color--inherited${options.panelColor ? ` et-color--${options.panelColor}` : ''} et-surface--${options.panelSurface ?? 'inherited'}"><div class="et-select-panel-scroller et-scrollbar-host"><div class="et-select-panel-body"><div role="listbox" class="et-select-listbox" id="et-select-listbox-${state.id}"${state.labelId ? ` aria-labelledby="${state.labelId}"` : ''}>${optionsHtml(state)}</div><div class="et-select-panel-extras"></div></div></div><et-scrollbar class="et-scrollbar" data-orientation="vertical"><div class="et-scrollbar-thumb"></div></et-scrollbar></et-select-panel>`,
  };
};
