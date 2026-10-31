import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import choiceFieldBase from '../src/lib/forms/choice-field/choice-field.component.css?inline';
import choiceFieldCard from '../src/lib/forms/choice-field/choice-field-card-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import selectionCard from '../src/lib/forms/selection-card-styles.component.css?inline';
import switchBase from '../src/lib/forms/switch/switch.component.css?inline';

export type SwitchMockOptions = {
  checked?: boolean;
  /** The bulk-edit state: the thumb parks mid-track. Wins over `checked` in the look. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** View-only: the normal look, without the interactive affordance. */
  readonly?: boolean;
  required?: boolean;
  /** The label, as HTML. Draws the switch inside an `<et-choice-field>`; left out, the switch stands alone. */
  label?: string;
  /** Unique per frame: the label id derives from it. */
  id?: string;
  /** The `et-choice-field` size. Only drawn with a `label`. */
  size?: 'sm' | 'md' | 'lg';
  /** The `et-choice-field` variant. Only drawn with a `label`. */
  variant?: 'plain' | 'card';
  /** Where a `card` puts the switch. */
  controlPosition?: 'start' | 'end';
  /** A color theme name the app registers. Only drawn with a `label`. */
  color?: string;
  /** Extra attributes on the `<et-switch>`, e.g. design markers like `data-et-force="hover"`. */
  attributes?: string;
};

/** The stylesheets `switchControl()` draws with: the real `et-switch` and `et-choice-field` CSS. */
export const switchStyles = /* @__PURE__ */ [
  interactiveStyles,
  label,
  selectionCard,
  choiceFieldBase,
  choiceFieldCard,
  switchBase,
].join('\n');

/** Draws `<et-switch>` as HTML, inside an `<et-choice-field>` when it has a label, with the DOM the components render. */
export const switchControl = (options: SwitchMockOptions = {}) => {
  const { id = 'switch', variant = 'plain' } = options;
  const labelId = options.label !== undefined ? `et-label-${id}` : null;

  const switchAttributes = [
    options.attributes,
    'role="switch"',
    'class="et-switch et-color-interactive"',
    'data-can-animate="true"',
    `aria-checked="${!!options.checked}"`,
    options.indeterminate && 'data-indeterminate="true"',
    options.disabled && 'aria-disabled="true"',
    options.readonly && 'aria-readonly="true" data-readonly="true"',
    options.required && 'aria-required="true"',
    labelId && `aria-labelledby="${labelId}"`,
    `tabindex="${options.disabled ? -1 : 0}"`,
  ].filter(Boolean);

  const control = `<et-switch ${switchAttributes.join(' ')}><div class="et-switch-track"><div class="et-switch-thumb"></div></div></et-switch>`;

  if (labelId === null) return control;

  const fieldAttributes = [
    `class="et-choice-field et-color--${options.color ?? 'inherited'}"`,
    `data-size="${options.size ?? 'md'}"`,
    `data-variant="${variant}"`,
    'data-can-animate="true"',
    variant === 'card' && `data-control-position="${options.controlPosition ?? 'end'}"`,
  ].filter(Boolean);

  const controlClasses = [
    variant === 'card' && 'et-selection-card',
    'et-choice-field-control',
    'et-color-interactive',
    'et-color-interactive-container',
  ].filter(Boolean);

  const labelHtml = `<et-label id="${labelId}"${options.disabled ? ' data-disabled="true"' : ''}><span class="et-label-content">${options.label}</span>${options.required ? '<span class="et-label-required-marker" aria-hidden="true">*</span>' : ''}</et-label>`;

  return `<et-choice-field ${fieldAttributes.join(' ')}><div class="${controlClasses.join(' ')}"><div class="et-choice-field-control-slot et-selection-card-control">${control}</div><div class="et-choice-field-label-area et-selection-card-content">${labelHtml}</div></div></et-choice-field>`;
};
