import { InjectionToken, Signal, TemplateRef, WritableSignal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { FieldWarningResult } from './field-warnings';

export const FORM_FIELD_CONTROL_TYPES = {
  TEXT_INPUT: 'text-input',
  NUMBER_INPUT: 'number-input',
  PASSWORD_INPUT: 'password-input',
  COLOR_INPUT: 'color-input',
  TEXTAREA: 'textarea',
  RICH_TEXT: 'rich-text',
  SELECT: 'select',
  CASCADER: 'cascader',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  SEGMENTED_BUTTON: 'segmented-button',
  SELECTION_LIST: 'selection-list',
  RATING: 'rating',
  SLIDER: 'slider',
  RANGE_SLIDER: 'range-slider',
  OTP_INPUT: 'otp-input',
  TAG_INPUT: 'tag-input',
  PHONE_INPUT: 'phone-input',
  DATE_INPUT: 'date-input',
  DATE_RANGE_INPUT: 'date-range-input',
  TIME_INPUT: 'time-input',
  TIME_RANGE_INPUT: 'time-range-input',
  DATE_TIME_INPUT: 'date-time-input',
  DATE_TIME_RANGE_INPUT: 'date-time-range-input',
  DURATION_INPUT: 'duration-input',
  DROPZONE: 'dropzone',
} as const;

export type FormFieldControlType = (typeof FORM_FIELD_CONTROL_TYPES)[keyof typeof FORM_FIELD_CONTROL_TYPES];

export type FormFieldControl = {
  touched: Signal<boolean>;
  invalid: Signal<boolean>;
  errors: Signal<readonly ValidationError.WithOptionalFieldTree[]>;
  /**
   * Advisories the control was given directly, for a field with no signal-forms binding to carry
   * `warn()` rules. They never reach validity.
   */
  warnings?: Signal<FieldWarningResult>;
  name: Signal<string>;
  required?: Signal<boolean>;
  disabled?: Signal<boolean>;
  readonly?: Signal<boolean>;
  /** Signal-forms `hidden` status - when true the whole field is visually removed. */
  hidden?: Signal<boolean>;
  effectiveDisabled?: Signal<boolean>;
  describedBy: WritableSignal<string | null>;
  controlType: Signal<FormFieldControlType>;
  focused?: Signal<boolean>;
  /**
   * True while the control's own popup (a date picker, select/cascader panel, …) is open. The
   * field keeps its focused styling while set.
   */
  expanded?: Signal<boolean>;
  hasValue?: Signal<boolean>;
  /** True while the committed text can't be parsed (date/time/duration typed entry). */
  parseError?: Signal<boolean>;
  /**
   * User-facing message shown when `parseError` is set and there is no validation error - the control's
   * own `parseErrorMessage` input if it has one, else `DATE_TIME_LABELS`.
   */
  resolvedParseErrorMessage?: Signal<string>;
  /**
   * True when the control carries an author-supplied accessible name (its own `aria-label` /
   * `aria-labelledby`) independent of a projected `<et-label>`. Controls that only support
   * `<et-label>` for labelling leave this unset.
   */
  hasCustomAccessibleName?: Signal<boolean>;
  /** The control's current value. */
  value?: Signal<unknown>;
  /**
   * The bound field's `maxLength()` limit. Signal forms binds this automatically into any control
   * that declares a `maxLength` input.
   */
  maxLength?: Signal<number | undefined>;
  /**
   * True while an async validator is in flight for the bound field - bound automatically by signal
   * forms into any control declaring a `pending` input.
   */
  pending?: Signal<boolean>;
  activate(): void;
  /**
   * Moves focus into the control's focusable element - the native input, the trigger, the first
   * thumb, whatever the control actually focuses.
   *
   * Unlike {@link activate}, this only focuses - it never toggles, opens a panel, or selects.
   */
  focus?(options?: FocusOptions): void;
};

export type HintComponentBase = object;

/** A projected `et-counter`. */
export type CounterComponentBase = object;

/**
 * A control's own in-field affordances (clear button, picker trigger, reveal toggle), handed to the
 * field to render in its suffix slot.
 */
export type ControlSuffixBase = {
  templateRef: TemplateRef<void>;
};

export const FORM_FIELD_TOKEN = new InjectionToken<FormFieldDirectiveBase>('FORM_FIELD_TOKEN');

export type FormFieldDirectiveBase = {
  registerControl(control: FormFieldControl): void;
  unregisterControl(control: FormFieldControl): void;
  registerHint(hint: HintComponentBase): void;
  unregisterHint(hint: HintComponentBase): void;
  registerCounter(counter: CounterComponentBase): void;
  unregisterCounter(counter: CounterComponentBase): void;
  unregisterLabel(label: LabelDirectiveBase): void;
  registeredControl: WritableSignal<FormFieldControl | null>;
  registeredHint: WritableSignal<HintComponentBase | null>;
  registeredCounter: WritableSignal<CounterComponentBase | null>;
  registeredLabel: WritableSignal<LabelDirectiveBase | null>;
  registeredControlSuffix: WritableSignal<ControlSuffixBase | null>;
  /** The registered control's value, for the counter to measure. */
  controlValue: Signal<unknown>;
  /** The registered control's validation errors - the counter reads its over-limit state from them. */
  errors: Signal<readonly ValidationError.WithOptionalFieldTree[]>;
  /** The bound field's schema `maxLength()`, when it has one. */
  controlMaxLength: Signal<number | undefined>;
  /** The field's visible control frame - the box overlay-based controls anchor their panels to. */
  controlFrameElement: WritableSignal<HTMLElement | null>;
  /** The field's own element, chrome included - what scrolling to this field targets. */
  element: HTMLElement;
  activate(): void;
};

export type LabelDirectiveBase = {
  id: Signal<string>;
};
