import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import formFieldBase from '../src/lib/forms/form-field/form-field.component.css?inline';
import textShell from '../src/lib/forms/form-field/form-field-text-shell-styles.component.css?inline';
import suffixOverlap from '../src/lib/forms/form-field/form-field-suffix-overlap-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import hint from '../src/lib/forms/form-field/hint.component.css?inline';
import inputBase from '../src/lib/forms/input/input.component.css?inline';
import iconStyles from '../src/lib/icon/headless/icon-styles.component.css?inline';

/** The field state a control draws itself from. */
export type FormFieldMockState = {
  id: string;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  invalid: boolean;
  focused: boolean;
  open: boolean;
  labelId: string | null;
  describedBy: string | null;
};

/** A control drawn inside `formField()`, for example `input()` or `select()`. */
export type FormFieldControlMock = {
  controlType: string;
  hasValue: boolean;
  /** Can be opened, like a select: `open` then draws the field expanded. */
  expandable?: boolean;
  html: (state: FormFieldMockState) => string;
  /** The control's own affordances, drawn first in the suffix area. */
  suffix?: (state: FormFieldMockState) => string;
  /** Drawn below the field, where the overlay would open. */
  panel?: (state: FormFieldMockState) => string;
};

export type FormFieldMockOptions = {
  /** The control, from `input()` or `select()`, or plain HTML for a text input. */
  control: FormFieldControlMock | string;
  /** The label, as HTML. */
  label?: string;
  /** Unique per frame: the ids that link the label, the control and the messages derive from it. */
  id?: string;
  /** The hint, as HTML. */
  hint?: string;
  /** The error message, as HTML. Draws the field in its error state. */
  error?: string;
  /** The color theme name the app registers for errors. */
  errorColor?: string;
  /** Prefix content, as HTML, for example an icon. */
  prefix?: string;
  /** Suffix content, as HTML. */
  suffix?: string;
  appearance?: 'box' | 'underline';
  fill?: 'transparent' | 'filled';
  labelMode?: 'static' | 'inline' | 'floating-inside' | 'floating-outside';
  size?: 'sm' | 'md' | 'lg';
  /** A color theme name the app registers. */
  color?: string;
  /** A surface theme name the app registers. */
  surface?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  focused?: boolean;
  /** Opens an expandable control, like a select. */
  open?: boolean;
  class?: string;
  style?: string;
};

export type InputMockOptions = {
  value?: string;
  placeholder?: string;
  type?: string;
  textAlign?: 'start' | 'center' | 'end';
};

/** The stylesheets `formField()` and `input()` draw with: the real `et-form-field` CSS. */
export const formFieldStyles = /* @__PURE__ */ [
  interactiveStyles,
  iconStyles,
  formFieldBase,
  textShell,
  suffixOverlap,
  label,
  hint,
  inputBase,
  `.et-design-panel-anchor { position: relative; }
.et-design-panel { position: absolute; inset-inline: 0; inset-block-start: calc(100% + 0.3rem); z-index: 1; }`,
].join('\n');

const attributesOf = (entries: (string | false | null | undefined)[]) => entries.filter(Boolean).join(' ');

/** Draws `<et-input>` as a control for `formField()`. */
export const input = (options: InputMockOptions = {}): FormFieldControlMock => ({
  controlType: 'text-input',
  hasValue: !!options.value,
  html: (state) => {
    const attributes = attributesOf([
      'class="et-input-native"',
      `type="${options.type ?? 'text'}"`,
      options.value && `value="${options.value}"`,
      state.disabled && 'disabled',
      state.readonly && 'readonly',
      state.required && 'required',
      options.placeholder && `placeholder="${options.placeholder}"`,
      state.invalid && 'aria-invalid="true"',
      state.describedBy && `aria-describedby="${state.describedBy}"`,
      state.labelId && `aria-labelledby="${state.labelId}"`,
      `data-text-align="${options.textAlign ?? 'start'}"`,
    ]);

    return `<et-input class="et-color-interactive et-input"><input ${attributes}></et-input>`;
  },
});

/** Draws `<et-form-field>` with a control, its label, affixes and messages, as the component renders them. */
export const formField = (options: FormFieldMockOptions) => {
  const control: FormFieldControlMock =
    typeof options.control === 'string'
      ? { controlType: 'text-input', hasValue: false, html: () => options.control as string }
      : options.control;

  const {
    id = 'field',
    appearance = 'box',
    fill = 'transparent',
    labelMode = 'static',
    size = 'md',
    error,
    hint,
  } = options;
  const open = !!control.expandable && !!options.open;
  const focused = !!options.focused || open;
  const labelId = options.label ? `et-label-${id}` : null;
  const errorId = `et-form-field-error-${id}`;
  const hintId = `et-form-field-hint-${id}`;

  const state: FormFieldMockState = {
    id,
    disabled: !!options.disabled,
    readonly: !!options.readonly,
    required: !!options.required,
    invalid: error !== undefined,
    focused,
    open,
    labelId,
    describedBy: error !== undefined ? errorId : hint !== undefined ? hintId : null,
  };

  const errorColor = error !== undefined && options.errorColor;
  const floating = labelMode === 'floating-inside' || labelMode === 'floating-outside';

  const classes = [
    'et-color-interactive--has-focus',
    'et-form-field',
    errorColor ? `et-color--${errorColor}` : `et-color--${options.color ?? 'inherited'}`,
    `et-surface--${options.surface ?? 'inherited'}`,
    options.class,
  ].filter(Boolean);

  const attributes = attributesOf([
    `class="${classes.join(' ')}"`,
    `data-control-type="${control.controlType}"`,
    error !== undefined && 'data-error="true"',
    open && 'data-expanded=""',
    focused && 'data-focused=""',
    state.readonly && 'data-readonly=""',
    state.disabled && 'data-disabled=""',
    `data-appearance="${appearance}"`,
    `data-fill="${fill}"`,
    fill === 'filled' && 'data-et-surface-fill=""',
    floating && (focused || control.hasValue) && 'data-label-floated=""',
    options.label && 'data-has-label=""',
    `data-label-mode="${labelMode}"`,
    `data-size="${size}"`,
    'data-text-shell="true"',
    options.style && `style="${options.style}"`,
  ]);

  const labelAreaClasses = [
    'et-form-field-label-area',
    floating && 'et-form-field-label-area--floating',
    labelMode === 'inline' && 'et-form-field-label-area--inline',
  ].filter(Boolean);

  const labelHtml = options.label
    ? `<et-label id="${labelId}"${state.disabled ? ' data-disabled="true"' : ''}><span class="et-label-content">${options.label}</span>${state.required ? '<span class="et-label-required-marker" aria-hidden="true">*</span>' : ''}</et-label>`
    : '';

  const errorHtml =
    error !== undefined
      ? `<div class="et-form-field-support-content et-form-field-errors${errorColor ? ` et-color--${errorColor}` : ''}" id="${errorId}" aria-atomic="true" aria-live="polite" data-active="true" data-direction="from-below" data-state="active"><et-form-error class="et-form-error">${error}</et-form-error></div>`
      : '';

  const hintHtml =
    hint !== undefined && error === undefined
      ? `<div class="et-form-field-support-content et-form-field-hint" id="${hintId}" data-active="true" data-direction="from-above" data-state="active"><et-hint>${hint}</et-hint></div>`
      : '';

  const support =
    error !== undefined || hint !== undefined
      ? `<div class="et-color-interactive-exclude et-form-field-support"><div class="et-form-field-support-row"><div class="et-form-field-support-stack">${errorHtml}${hintHtml}</div><div class="et-form-field-support-counter${options.errorColor ? ` et-color--${options.errorColor}` : ''}" hidden></div></div></div>`
      : '';

  const field = `<et-form-field ${attributes}><div class="et-form-field-shell"><div class="et-form-field-control-frame"><div class="et-form-field-affix et-form-field-prefix">${options.prefix ?? ''}</div><div class="et-form-field-control-area"><div class="${labelAreaClasses.join(' ')}">${labelHtml}</div><div class="et-form-field-control-slot">${control.html(state)}</div></div><div class="et-form-field-affix et-form-field-suffix">${control.suffix?.(state) ?? ''}${options.suffix ?? ''}</div></div></div>${support}</et-form-field>`;

  if (!open || !control.panel) return field;

  return `<div class="et-design-panel-anchor">${field}<div class="et-design-panel">${control.panel(state)}</div></div>`;
};
