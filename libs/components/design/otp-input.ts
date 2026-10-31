import formSupport from '../src/lib/forms/form-field/form-support-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import otpInputBase from '../src/lib/forms/otp-input/otp-input.component.css?inline';

/** An interaction a frame forces with the `data-et-force` design marker. */
export type OtpInputMockForce = 'hover' | 'active';

export type OtpInputMockOptions = {
  /** The number of segments. */
  length?: number;
  /** The typed characters; only the first `length` show. */
  value?: string;
  /** Draws each typed character as a dot. */
  masked?: boolean;
  /** Draws the field focused: the caret segment after the last character, or the last segment when full. */
  focused?: boolean;
  /** The label, as HTML. */
  label?: string;
  /** The hint, as HTML. Hidden while an `error` shows. */
  hint?: string;
  /** The error message, as HTML. Draws the field touched and invalid. */
  error?: string;
  /** The color theme name the app registers for errors, e.g. `danger` in Storybook. */
  errorColor?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  /** Unique per frame: the label and message ids derive from it. */
  id?: string;
  /** A color theme name the app registers. */
  color?: string;
  /** Forced interactions on the field. */
  force?: OtpInputMockForce | OtpInputMockForce[];
};

/** The stylesheets `otpInput()` draws with: the real `et-otp-input` and form support CSS. */
export const otpInputStyles = /* @__PURE__ */ [label, formSupport, otpInputBase].join('\n');

const forceList = (force: OtpInputMockForce | OtpInputMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

/** Draws `<et-otp-input>` as HTML, with the DOM the component renders. */
export const otpInput = (options: OtpInputMockOptions) => {
  const { id = 'otp-input', length = 6, value = '' } = options;
  const ids = { hint: `et-form-field-hint-${id}`, error: `et-form-field-error-${id}` };
  const labelId = options.label !== undefined ? `et-label-${id}` : null;
  const invalid = options.error !== undefined;
  const supportId = invalid ? ids.error : options.hint !== undefined ? ids.hint : null;
  const colorClass = invalid && options.errorColor ? options.errorColor : (options.color ?? 'inherited');
  const chars = value.slice(0, length);
  const caretIndex = options.focused ? Math.min(chars.length, length - 1) : -1;
  const force = forceList(options.force);

  const hostAttributes = [
    `class="et-otp-input et-color--${colorClass}"`,
    invalid && 'data-error="true"',
    force.length > 0 && `data-et-force="${force.join(' ')}"`,
  ].filter(Boolean);

  const segments = Array.from({ length }, (_, index) => {
    const char = chars[index];
    const attributes = [
      'class="et-otp-input-segment"',
      index === caretIndex && 'data-caret="true"',
      char !== undefined && 'data-filled="true"',
    ].filter(Boolean);
    const content =
      char !== undefined
        ? `<span class="et-otp-input-segment-char">${options.masked ? '•' : char}</span>`
        : index === caretIndex
          ? '<span class="et-otp-input-caret"></span>'
          : '';

    return `<div ${attributes.join(' ')}>${content}</div>`;
  }).join('');

  const inputAttributes = [
    'class="et-otp-input-native"',
    'autocapitalize="off"',
    'autocomplete="one-time-code"',
    'spellcheck="false"',
    `type="${options.masked ? 'password' : 'text'}"`,
    'inputmode="numeric"',
    `value="${chars}"`,
    options.required && 'required',
    options.disabled && 'disabled',
    options.readonly && 'readonly',
    labelId && `aria-labelledby="${labelId}"`,
    supportId && `aria-describedby="${supportId}"`,
    invalid && 'aria-invalid="true"',
  ].filter(Boolean);

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

  return `<et-otp-input ${hostAttributes.join(' ')}>${labelHtml}<div class="et-otp-input-field"><div class="et-otp-input-segments" aria-hidden="true">${segments}</div><input ${inputAttributes.join(' ')}></div>${support}</et-otp-input>`;
};
