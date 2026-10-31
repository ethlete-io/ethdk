import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import description from '../src/lib/forms/description/description.component.css?inline';
import formSupport from '../src/lib/forms/form-field/form-support-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import selectionCard from '../src/lib/forms/selection-card-styles.component.css?inline';
import radioGroupBase from '../src/lib/forms/selection-list/radio-group/radio-group.component.css?inline';
import radioBase from '../src/lib/forms/selection-list/radio-group/radio.component.css?inline';

/** An interaction a frame forces with the `data-et-force` design marker. */
export type RadioMockForce = 'hover' | 'focus-visible' | 'active';

export type RadioGroupMockOption = {
  /** The option label, as HTML. */
  label: string;
  checked?: boolean;
  disabled?: boolean;
  /** The `et-description` under the label, as HTML. */
  description?: string;
  /** Forced interactions on this option. */
  force?: RadioMockForce | RadioMockForce[];
};

export type RadioGroupMockOptions = {
  options: RadioGroupMockOption[];
  /** The group label, as HTML. */
  label?: string;
  /** The hint, as HTML. Hidden while an `error` shows. */
  hint?: string;
  /** The error message, as HTML. Draws the group touched and invalid. */
  error?: string;
  /** The color theme name the app registers for errors, e.g. `danger` in Storybook. */
  errorColor?: string;
  /** The bulk-edit state: no option reads as checked yet, whatever its `checked`. */
  mixed?: boolean;
  disabled?: boolean;
  /** View-only: the normal look, without the interactive affordance. */
  readonly?: boolean;
  required?: boolean;
  /** Unique per frame: the label, description and message ids derive from it. */
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'vertical' | 'horizontal';
  variant?: 'plain' | 'card';
  /** Where a `card` option puts its circle. */
  controlPosition?: 'start' | 'end';
  /** A color theme name the app registers. */
  color?: string;
};

/** The stylesheets `radioGroup()` draws with: the real `et-radio-group`, `et-radio` and form support CSS. */
export const radioGroupStyles = /* @__PURE__ */ [
  interactiveStyles,
  label,
  description,
  formSupport,
  selectionCard,
  radioGroupBase,
  radioBase,
].join('\n');

const forceList = (force: RadioMockForce | RadioMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

const forceMarker = (force: RadioMockForce[]) => force.length > 0 && `data-et-force="${force.join(' ')}"`;

/** Draws `<et-radio-group>` with its `<et-radio>`s as HTML, with the DOM the components render. */
export const radioGroup = (options: RadioGroupMockOptions) => {
  const { id = 'radio-group', variant = 'plain' } = options;
  const ids = { hint: `et-form-field-hint-${id}`, error: `et-form-field-error-${id}` };
  const labelId = options.label !== undefined ? `et-label-${id}` : null;
  const invalid = options.error !== undefined;
  const supportId = invalid ? ids.error : options.hint !== undefined ? ids.hint : null;
  const colorClass = invalid && options.errorColor ? options.errorColor : (options.color ?? 'inherited');
  const enabled = (option: RadioGroupMockOption) => !options.disabled && !option.disabled;
  const isChecked = (option: RadioGroupMockOption) => !options.mixed && !!option.checked;
  const tabStop = options.options.find((o) => isChecked(o) && enabled(o)) ?? options.options.find(enabled);

  const groupAttributes = [
    `class="et-radio-group et-color--${colorClass}"`,
    'role="radiogroup"',
    invalid && 'aria-invalid="true"',
    options.required && 'aria-required="true"',
    supportId && `aria-describedby="${supportId}"`,
    labelId && `aria-labelledby="${labelId}"`,
    options.disabled && 'data-disabled="true"',
    options.mixed && 'data-mixed="true"',
    options.readonly && 'aria-readonly="true" data-readonly="true"',
    `data-size="${options.size ?? 'md'}"`,
    `data-orientation="${options.orientation ?? 'vertical'}"`,
    invalid && 'data-error="true"',
  ].filter(Boolean);

  const items = options.options
    .map((option, index) => {
      const optionLabelId = `et-selection-option-label-${id}-${index}`;
      const descriptionId = option.description !== undefined ? `et-description-${id}-${index}` : null;
      const attributes = [
        `class="et-color-interactive et-radio${variant === 'card' ? ' et-selection-card' : ''}"`,
        'role="radio"',
        `aria-checked="${isChecked(option)}"`,
        `aria-labelledby="${optionLabelId}"`,
        descriptionId && `aria-describedby="${descriptionId}"`,
        !enabled(option) && 'aria-disabled="true"',
        options.readonly && 'data-readonly="true"',
        `tabindex="${option === tabStop ? 0 : -1}"`,
        `data-variant="${variant}"`,
        variant === 'card' && `data-control-position="${options.controlPosition ?? 'end'}"`,
        forceMarker(forceList(option.force)),
      ].filter(Boolean);
      const description = descriptionId
        ? `<et-description class="et-description" id="${descriptionId}">${option.description}</et-description>`
        : '';

      return `<et-radio ${attributes.join(' ')}><div class="et-radio-circle et-selection-card-control"></div><div class="et-radio-content et-selection-card-content"><span class="et-radio-label et-selection-card-label" id="${optionLabelId}">${option.label}</span>${description}</div></et-radio>`;
    })
    .join('');

  const labelHtml = labelId
    ? `<et-label id="${labelId}"${options.disabled ? ' data-disabled="true"' : ''}><span class="et-label-content">${options.label}</span>${options.required ? '<span aria-hidden="true" class="et-label-required-marker">*</span>' : ''}</et-label>`
    : '';

  const support =
    options.hint === undefined && options.error === undefined
      ? ''
      : `<et-form-support class="et-form-support"><div class="et-form-support-stack">${
          invalid
            ? `<div class="et-form-support-content et-form-support-errors${options.errorColor ? ` et-color--${options.errorColor}` : ''}" id="${ids.error}" aria-atomic="true" aria-live="polite" data-active="true" data-direction="from-below" data-state="active"><et-form-error class="et-form-error">${options.error}</et-form-error></div>`
            : `<div class="et-form-support-content et-form-support-hint" id="${ids.hint}" data-active="true" data-direction="from-above" data-state="active"><et-hint>${options.hint}</et-hint></div>`
        }</div></et-form-support>`;

  return `<et-radio-group ${groupAttributes.join(' ')}>${labelHtml}${items}${support}</et-radio-group>`;
};
