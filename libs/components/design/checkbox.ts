import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import checkboxBase from '../src/lib/forms/checkbox/checkbox.component.css?inline';
import choiceFieldBase from '../src/lib/forms/choice-field/choice-field.component.css?inline';
import description from '../src/lib/forms/description/description.component.css?inline';
import choiceFieldCard from '../src/lib/forms/choice-field/choice-field-card-styles.component.css?inline';
import formSupport from '../src/lib/forms/form-field/form-support-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import selectionCard from '../src/lib/forms/selection-card-styles.component.css?inline';
import checkboxGroupBase from '../src/lib/forms/selection-list/checkbox-group/checkbox-group.component.css?inline';
import checkboxGroupSelectAll from '../src/lib/forms/selection-list/checkbox-group/checkbox-group-select-all.component.css?inline';
import checkboxOption from '../src/lib/forms/selection-list/checkbox-group/checkbox-option.component.css?inline';
import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';

/** An interaction a frame forces with the `data-et-force` design marker. */
export type CheckboxMockForce = 'hover' | 'focus-visible' | 'active';

type CheckboxMockSupport = {
  /** The hint, as HTML. Hidden while an `error` shows. */
  hint?: string;
  /** The error message, as HTML. Draws the control touched and invalid. */
  error?: string;
  /** The color theme name the app registers for errors, e.g. `danger` in Storybook. */
  errorColor?: string;
};

export type CheckboxMockOptions = CheckboxMockSupport & {
  checked?: boolean;
  /** The tri-state `mixed` value. Wins over `checked`. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** View-only: the normal look, without the interactive affordance. */
  readonly?: boolean;
  required?: boolean;
  /** The label, as HTML. Draws the checkbox inside an `<et-choice-field>`; left out, the checkbox stands alone. */
  label?: string;
  /** The `et-description` under the label, as HTML. Only drawn with a `label`. */
  description?: string;
  /** Unique per frame: the label, description and message ids derive from it. */
  id?: string;
  /** The `et-choice-field` size. Only drawn with a `label`. */
  size?: 'sm' | 'md' | 'lg';
  /** The `et-choice-field` variant. Only drawn with a `label`. */
  variant?: 'plain' | 'card';
  /** Where a `card` puts the checkbox. */
  controlPosition?: 'start' | 'end';
  /** A color theme name the app registers. Only drawn with a `label`. */
  color?: string;
  /** Forced interactions, as if the pointer or keyboard were on the box. */
  force?: CheckboxMockForce | CheckboxMockForce[];
};

export type CheckboxGroupMockOption = {
  /** The option label, as HTML. */
  label: string;
  checked?: boolean;
  disabled?: boolean;
  /** The `et-description` under the label, as HTML. */
  description?: string;
  /** Forced interactions on this option. */
  force?: CheckboxMockForce | CheckboxMockForce[];
};

export type CheckboxGroupMockOptions = CheckboxMockSupport & {
  options: CheckboxGroupMockOption[];
  /** The group label, as HTML. */
  label?: string;
  /** Draws an `<et-checkbox-group-select-all>` row with this text, e.g. `Select all`. */
  selectAll?: string;
  /** Forced interactions on the select-all row. */
  selectAllForce?: CheckboxMockForce | CheckboxMockForce[];
  /** The bulk-edit state: no option reads as checked yet, whatever its `checked`. */
  mixed?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  /** Unique per frame: the label and message ids derive from it. */
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'vertical' | 'horizontal';
  variant?: 'plain' | 'card';
  /** Where a `card` option puts its box. */
  controlPosition?: 'start' | 'end';
  /** A color theme name the app registers. */
  color?: string;
};

/** The stylesheets `checkbox()` draws with: the real `et-checkbox`, `et-choice-field` and form support CSS. */
export const checkboxStyles = /* @__PURE__ */ [
  interactiveStyles,
  focusRing,
  label,
  description,
  formSupport,
  selectionCard,
  choiceFieldBase,
  choiceFieldCard,
  checkboxBase,
].join('\n');

/** The stylesheets `checkboxGroup()` draws with: the real `et-checkbox-group` and form support CSS. */
export const checkboxGroupStyles = /* @__PURE__ */ [
  interactiveStyles,
  label,
  description,
  formSupport,
  selectionCard,
  checkboxGroupBase,
  checkboxGroupSelectAll,
  checkboxOption,
].join('\n');

const forceList = (force: CheckboxMockForce | CheckboxMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

const forceMarker = (force: CheckboxMockForce[]) => force.length > 0 && `data-et-force="${force.join(' ')}"`;

const CHECKMARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true" class="et-checkbox-checkmark"><polyline points="3.5 8 6.5 11 12.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="et-checkbox-checkmark-path"></polyline></svg>';

const INDETERMINATE_MARK =
  '<svg viewBox="0 0 16 16" aria-hidden="true" class="et-checkbox-indeterminate"><line x1="4" y1="8" x2="12" y2="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="et-checkbox-indeterminate-path"></line></svg>';

const optionCheck = (className: string, hidden: boolean) =>
  `<svg viewBox="0 0 12 10" fill="none"${hidden ? ' aria-hidden="true"' : ''} class="${className}"><path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

const supportOf = (
  options: CheckboxMockSupport,
  context: { ids: { hint: string; error: string }; exclude: boolean },
) => {
  const { ids, exclude } = context;
  const { hint, error, errorColor } = options;

  if (hint === undefined && error === undefined) return '';

  const content =
    error !== undefined
      ? `<div class="et-form-support-content et-form-support-errors${errorColor ? ` et-color--${errorColor}` : ''}" id="${ids.error}" aria-atomic="true" aria-live="polite" data-active="true" data-direction="from-below" data-state="active"><et-form-error class="et-form-error">${error}</et-form-error></div>`
      : `<div class="et-form-support-content et-form-support-hint" id="${ids.hint}" data-active="true" data-direction="from-above" data-state="active"><et-hint>${hint}</et-hint></div>`;

  return `<et-form-support class="et-form-support${exclude ? ' et-color-interactive-exclude' : ''}"><div class="et-form-support-stack">${content}</div></et-form-support>`;
};

const supportIdOf = (options: CheckboxMockSupport, ids: { hint: string; error: string }) =>
  options.error !== undefined ? ids.error : options.hint !== undefined ? ids.hint : null;

const labelOf = (id: string, options: { label?: string; disabled?: boolean; required?: boolean }) =>
  `<et-label id="${id}"${options.disabled ? ' data-disabled="true"' : ''}><span class="et-label-content">${options.label ?? ''}</span>${options.required ? '<span aria-hidden="true" class="et-label-required-marker">*</span>' : ''}</et-label>`;

/** Draws `<et-checkbox>` as HTML, inside an `<et-choice-field>` when it has a label, with the DOM the components render. */
export const checkbox = (options: CheckboxMockOptions = {}) => {
  const { id = 'checkbox', variant = 'plain' } = options;
  const hasField = options.label !== undefined;
  const ids = { hint: `et-form-field-hint-${id}`, error: `et-form-field-error-${id}` };
  const labelId = hasField ? `et-label-${id}` : null;
  const descriptionId = hasField && options.description !== undefined ? `et-description-${id}` : null;
  const describedBy = hasField ? [descriptionId, supportIdOf(options, ids)].filter(Boolean).join(' ') : '';
  const invalid = hasField && options.error !== undefined;
  const force = forceList(options.force);

  const checkboxAttributes = [
    'role="checkbox"',
    'class="et-color-interactive et-checkbox et-focus-ring"',
    `aria-checked="${options.indeterminate ? 'mixed' : !!options.checked}"`,
    options.disabled && 'aria-disabled="true"',
    options.readonly && 'aria-readonly="true" data-readonly="true"',
    options.required && 'aria-required="true"',
    describedBy && `aria-describedby="${describedBy}"`,
    labelId && `aria-labelledby="${labelId}"`,
    `tabindex="${options.disabled ? -1 : 0}"`,
    invalid && 'aria-invalid="true"',
    forceMarker(force),
  ].filter(Boolean);

  const control = `<et-checkbox ${checkboxAttributes.join(' ')}><div class="et-checkbox-box">${CHECKMARK}${INDETERMINATE_MARK}</div></et-checkbox>`;

  if (labelId === null) return control;

  const colorClass = invalid && options.errorColor ? options.errorColor : (options.color ?? 'inherited');

  const fieldAttributes = [
    `class="et-choice-field et-color--${colorClass}"`,
    `data-size="${options.size ?? 'md'}"`,
    `data-variant="${variant}"`,
    variant === 'card' && `data-control-position="${options.controlPosition ?? 'end'}"`,
    invalid && 'data-error="true"',
  ].filter(Boolean);

  const controlAttributes = [
    `class="et-color-interactive-container et-color-interactive et-choice-field-control${variant === 'card' ? ' et-selection-card' : ''}"`,
    forceMarker(force.filter((name) => name !== 'focus-visible')),
  ].filter(Boolean);

  const description = descriptionId
    ? `<et-description class="et-description" id="${descriptionId}">${options.description}</et-description>`
    : '';

  return `<et-choice-field ${fieldAttributes.join(' ')}><div ${controlAttributes.join(' ')}><div class="et-choice-field-control-slot et-selection-card-control">${control}</div><div class="et-choice-field-label-area et-selection-card-content">${labelOf(labelId, options)}${description}</div></div>${supportOf(options, { ids, exclude: true })}</et-choice-field>`;
};

/** Draws `<et-checkbox-group>` with its `<et-checkbox-option>`s as HTML, with the DOM the components render. */
export const checkboxGroup = (options: CheckboxGroupMockOptions) => {
  const { id = 'checkbox-group', variant = 'plain' } = options;
  const ids = { hint: `et-form-field-hint-${id}`, error: `et-form-field-error-${id}` };
  const labelId = options.label !== undefined ? `et-label-${id}` : null;
  const supportId = supportIdOf(options, ids);
  const invalid = options.error !== undefined;
  const colorClass = invalid && options.errorColor ? options.errorColor : (options.color ?? 'inherited');
  const enabled = (option: CheckboxGroupMockOption) => !options.disabled && !option.disabled;
  const isChecked = (option: CheckboxGroupMockOption) => !options.mixed && !!option.checked;
  const tabStop = options.options.find((o) => isChecked(o) && enabled(o)) ?? options.options.find(enabled);

  const groupAttributes = [
    `class="et-checkbox-group et-color--${colorClass}"`,
    'role="group"',
    invalid && 'aria-invalid="true"',
    options.required && 'aria-required="true"',
    supportId && `aria-describedby="${supportId}"`,
    labelId && `aria-labelledby="${labelId}"`,
    options.disabled && 'data-disabled="true"',
    options.mixed && 'data-mixed="true"',
    options.readonly && 'data-readonly="true"',
    `data-size="${options.size ?? 'md'}"`,
    `data-orientation="${options.orientation ?? 'vertical'}"`,
    invalid && 'data-error="true"',
  ].filter(Boolean);

  const checkedCount = options.options.filter(isChecked).length;
  const selectAllChecked = checkedCount === 0 ? 'false' : checkedCount === options.options.length ? 'true' : 'mixed';

  const selectAll =
    options.selectAll !== undefined
      ? `<et-checkbox-group-select-all ${[
          'class="et-color-interactive et-checkbox-group-select-all"',
          'role="checkbox"',
          `aria-checked="${selectAllChecked}"`,
          options.disabled && 'aria-disabled="true"',
          options.readonly && 'aria-readonly="true"',
          `tabindex="${options.disabled ? -1 : 0}"`,
          forceMarker(forceList(options.selectAllForce)),
        ]
          .filter(Boolean)
          .join(
            ' ',
          )}><span class="et-checkbox-group-select-all-box">${optionCheck('et-checkbox-group-select-all-check', true)}<span aria-hidden="true" class="et-checkbox-group-select-all-dash"></span></span><span class="et-checkbox-group-select-all-label">${options.selectAll}</span></et-checkbox-group-select-all>`
      : '';

  const items = options.options
    .map((option, index) => {
      const optionLabelId = `et-selection-option-label-${id}-${index}`;
      const descriptionId = option.description !== undefined ? `et-description-${id}-${index}` : null;
      const attributes = [
        `class="et-color-interactive et-checkbox-option${variant === 'card' ? ' et-selection-card' : ''}"`,
        'role="checkbox"',
        `aria-checked="${isChecked(option)}"`,
        `aria-labelledby="${optionLabelId}"`,
        descriptionId && `aria-describedby="${descriptionId}"`,
        !enabled(option) && 'aria-disabled="true"',
        options.readonly && 'aria-readonly="true" data-readonly="true"',
        `tabindex="${option === tabStop ? 0 : -1}"`,
        `data-variant="${variant}"`,
        variant === 'card' && `data-control-position="${options.controlPosition ?? 'end'}"`,
        forceMarker(forceList(option.force)),
      ].filter(Boolean);
      const description = descriptionId
        ? `<et-description class="et-description" id="${descriptionId}">${option.description}</et-description>`
        : '';

      return `<et-checkbox-option ${attributes.join(' ')}><div class="et-checkbox-option-box et-selection-card-control">${optionCheck('et-checkbox-option-check', false)}</div><div class="et-checkbox-option-content et-selection-card-content"><span class="et-checkbox-option-label et-selection-card-label" id="${optionLabelId}">${option.label}</span>${description}</div></et-checkbox-option>`;
    })
    .join('');

  const labelHtml = labelId ? labelOf(labelId, options) : '';

  return `<et-checkbox-group ${groupAttributes.join(' ')}>${labelHtml}${selectAll}${items}${supportOf(options, { ids, exclude: false })}</et-checkbox-group>`;
};
