import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

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
  DATE_TIME_INPUT: 'date-time-input',
  DURATION_INPUT: 'duration-input',
  DROPZONE: 'dropzone',
} as const;

export type FormFieldControlType = (typeof FORM_FIELD_CONTROL_TYPES)[keyof typeof FORM_FIELD_CONTROL_TYPES];

export type FormFieldControl = {
  touched: Signal<boolean>;
  invalid: Signal<boolean>;
  errors: Signal<readonly ValidationError.WithOptionalFieldTree[]>;
  name: Signal<string>;
  required?: Signal<boolean>;
  disabled?: Signal<boolean>;
  readonly?: Signal<boolean>;
  effectiveDisabled?: Signal<boolean>;
  describedBy: WritableSignal<string | null>;
  controlType: Signal<FormFieldControlType>;
  focused?: Signal<boolean>;
  hasValue?: Signal<boolean>;
  activate(): void;
};

export type HintComponentBase = object;

export const FORM_FIELD_TOKEN = new InjectionToken<FormFieldDirectiveBase>('FORM_FIELD_TOKEN');

export type FormFieldDirectiveBase = {
  registerControl(control: FormFieldControl): void;
  unregisterControl(control: FormFieldControl): void;
  registerHint(hint: HintComponentBase): void;
  unregisterHint(hint: HintComponentBase): void;
  unregisterLabel(label: LabelDirectiveBase): void;
  registeredControl: WritableSignal<FormFieldControl | null>;
  registeredHint: WritableSignal<HintComponentBase | null>;
  registeredLabel: WritableSignal<LabelDirectiveBase | null>;
  /** The field's visible control frame — the box overlay-based controls anchor their panels to. */
  controlFrameElement: WritableSignal<HTMLElement | null>;
  activate(): void;
};

export type LabelDirectiveBase = {
  id: Signal<string>;
};
