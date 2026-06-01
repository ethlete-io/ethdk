import { InjectionToken, Signal, WritableSignal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

export const FORM_FIELD_CONTROL_TYPES = {
  TEXT_INPUT: 'text-input',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  SEGMENTED_BUTTON: 'segmented-button',
  SELECTION_LIST: 'selection-list',
} as const;

export type FormFieldControlType = (typeof FORM_FIELD_CONTROL_TYPES)[keyof typeof FORM_FIELD_CONTROL_TYPES];

export type FormFieldControl = {
  touched: Signal<boolean>;
  invalid: Signal<boolean>;
  errors: Signal<readonly ValidationError.WithOptionalFieldTree[]>;
  name: Signal<string>;
  required?: Signal<boolean>;
  disabled?: Signal<boolean>;
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
  activate(): void;
};

export type LabelDirectiveBase = {
  id: Signal<string>;
};
