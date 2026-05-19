import { ElementRef, InjectionToken, Signal, WritableSignal } from '@angular/core';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirectiveBase>('RADIO_GROUP_TOKEN');

export type RadioGroupItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  elementRef: ElementRef<HTMLElement>;
};

export type RadioGroupLabelBase = {
  id: Signal<string>;
};

export type RadioGroupDirectiveBase<TValue = unknown> = {
  value: WritableSignal<TValue | null>;
  disabled: Signal<boolean>;
  required: Signal<boolean>;
  name: Signal<string>;
  items: Signal<RadioGroupItem<TValue>[]>;
  registeredLabel: WritableSignal<RadioGroupLabelBase | null>;
  registerItem(item: RadioGroupItem<TValue>): void;
  unregisterItem(item: RadioGroupItem<TValue>): void;
  unregisterLabel(label: RadioGroupLabelBase): void;
  select(item: RadioGroupItem<TValue>): void;
  focusItem(item: RadioGroupItem<TValue>): void;
  markTouched(): void;
};
