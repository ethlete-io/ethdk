import controlSuffix from '../src/lib/forms/form-field/form-field-control-suffix-styles.component.css?inline';
import selectAllOptionStyles from '../src/lib/forms/select/select-all-option.component.css?inline';
import selectBase from '../src/lib/forms/select/select.component.css?inline';
import selectOptionGroupStyles from '../src/lib/forms/select/select-option-group.component.css?inline';
import selectOptionStyles from '../src/lib/forms/select/select-option-styles.component.css?inline';
import selectPanelStyles from '../src/lib/forms/select/select-panel.component.css?inline';
import { CHECK_ICON } from '../src/lib/icon/headless/check-icon';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { FormFieldControlMock, formFieldStyles, FormFieldMockState } from './form-field';
import { iconMarkup } from './icon';

export type SelectMockOption = { value: string; label: string; disabled?: boolean };

export type SelectMockActiveSource = 'keyboard' | 'pointer';

export type SelectOptionMockState = {
  id: string;
  selected?: boolean;
  /** Where the active option came from: the keyboard draws it highlighted, the pointer only under `:hover`. */
  active?: SelectMockActiveSource;
};

export type SelectAllOptionMockOptions = {
  id: string;
  label: string;
  checked: boolean | 'mixed';
  active?: SelectMockActiveSource;
};

export type SelectOptionGroupMockOptions = { labelId: string; label: string; content: string };

export type SelectPanelMockOptions = {
  id: string;
  labelId?: string | null;
  /** The panel's options, groups and select-all row as HTML. */
  content: string;
  multiple?: boolean;
  /** The app's default color theme name: the panel provides it to the options. */
  color?: string;
  /** A surface theme name the app registers, for the panel. Left out, the panel takes the surface one elevation above its parent. */
  surface?: string;
};

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
  /** A surface theme name the app registers, for the panel. Left out, the panel takes the surface one elevation above its parent. */
  panelSurface?: string;
};

/** The stylesheets `formField()` with a `select()` control draws with: the real `et-select` CSS. */
export const selectStyles = /* @__PURE__ */ [
  formFieldStyles,
  controlSuffix,
  selectBase,
  selectOptionStyles,
  selectOptionGroupStyles,
  selectAllOptionStyles,
  selectPanelStyles,
].join('\n');

const activeAttributes = (active: SelectMockActiveSource | undefined) =>
  active && `data-active="true" data-active-source="${active}"`;

/** Draws one `<et-select-option>` as the select panel renders it. */
export const selectOption = (option: SelectMockOption, state: SelectOptionMockState) => {
  const attributes = [
    'role="option"',
    `value="${option.value}"`,
    'class="et-select-option"',
    `id="${state.id}"`,
    `aria-selected="${!!state.selected}"`,
    option.disabled && 'aria-disabled="true"',
    state.selected && 'data-selected="true"',
    activeAttributes(state.active),
  ].filter(Boolean);

  return `<et-select-option ${attributes.join(' ')}><span class="et-select-option-label">${option.label}</span><span class="et-select-option-check">${iconMarkup(CHECK_ICON)}</span></et-select-option>`;
};

/** Draws the `<et-select-all-option>` row a multi select with `selectAll` renders first in its panel. */
export const selectAllOption = (options: SelectAllOptionMockOptions) => {
  const attributes = [
    'role="option"',
    'class="et-select-option et-select-all-option"',
    `id="${options.id}"`,
    `aria-checked="${options.checked}"`,
    activeAttributes(options.active),
  ].filter(Boolean);
  const check =
    options.checked === 'mixed'
      ? '<span class="et-select-all-option-dash" aria-hidden="true"></span>'
      : iconMarkup(CHECK_ICON);

  return `<et-select-all-option ${attributes.join(' ')}><span class="et-select-option-label">${options.label}</span><span class="et-select-option-check">${check}</span></et-select-all-option>`;
};

/** Draws an `<et-select-option-group>` with its label around the option HTML in `content`. */
export const selectOptionGroup = (options: SelectOptionGroupMockOptions) =>
  `<et-select-option-group role="group" aria-labelledby="${options.labelId}" class="et-select-option-group"><div id="${options.labelId}" class="et-select-option-group-label">${options.label}</div>${options.content}</et-select-option-group>`;

/** Draws the open `<et-select-panel>` with its listbox around the HTML in `content`. */
export const selectPanel = (options: SelectPanelMockOptions) => {
  const listbox = [
    'role="listbox"',
    'class="et-select-listbox"',
    `id="et-select-listbox-${options.id}"`,
    options.labelId && `aria-labelledby="${options.labelId}"`,
    options.multiple && 'aria-multiselectable="true"',
  ].filter(Boolean);
  const classes = [
    'et-select-panel',
    'et-color--inherited',
    options.color && `et-color--${options.color}`,
    options.surface && `et-surface--${options.surface}`,
  ].filter(Boolean);
  const autoSurface = options.surface ? '' : ' data-et-auto-surface';

  return `<et-select-panel${autoSurface} class="${classes.join(' ')}"><div class="et-select-panel-scroller et-scrollbar-host"><div class="et-select-panel-body"><div ${listbox.join(' ')}>${options.content}</div><div class="et-select-panel-extras"></div></div></div><et-scrollbar class="et-scrollbar" data-orientation="vertical"><div class="et-scrollbar-thumb"></div></et-scrollbar></et-select-panel>`;
};

/**
 * Draws `<et-select>` as a control for `formField()`. Pass `open: true` to `formField()` to draw
 * the panel below the field, where the overlay would open.
 */
export const select = (options: SelectMockOptions): FormFieldControlMock => {
  const selected = options.options.find((option) => option.value === options.value);

  const optionHtml = (state: FormFieldMockState) => (option: SelectMockOption, index: number) =>
    selectOption(option, {
      id: `et-select-option-${state.id}-${index}`,
      selected: option === selected,
      active: state.open && option.value === options.active ? 'keyboard' : undefined,
    });

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
          ? `<button aria-label="${options.clearLabel ?? 'Clear'}" class="et-input-clear" tabindex="-1" type="button">${iconMarkup(TIMES_ICON)}</button>`
          : '';

      return `${clear}<button aria-hidden="true" tabindex="-1" type="button" class="et-input-picker-trigger et-select-arrow"${state.disabled ? ' disabled' : ''}>${iconMarkup(CHEVRON_ICON)}</button>`;
    },
    panel: (state) =>
      selectPanel({
        id: state.id,
        labelId: state.labelId,
        content: optionsHtml(state),
        color: options.panelColor,
        surface: options.panelSurface,
      }),
  };
};
