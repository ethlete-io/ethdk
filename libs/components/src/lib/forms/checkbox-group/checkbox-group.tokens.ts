import { InjectionToken, Signal, WritableSignal } from '@angular/core';

export const CHECKBOX_GROUP_TOKEN = new InjectionToken<CheckboxGroupDirectiveBase>('CHECKBOX_GROUP_TOKEN');

export type CheckboxGroupItem = {
  checked: WritableSignal<boolean>;
  indeterminate?: WritableSignal<boolean>;
};

export type CheckboxGroupDirectiveBase = {
  registerItem(item: CheckboxGroupItem): void;
  unregisterItem(item: CheckboxGroupItem): void;
  allChecked: Signal<boolean>;
  someChecked: Signal<boolean>;
  noneChecked: Signal<boolean>;
  toggleAll(): void;
};
