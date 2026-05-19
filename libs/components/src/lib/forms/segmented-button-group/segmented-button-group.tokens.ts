import { InjectionToken, Signal, WritableSignal } from '@angular/core';

export const SEGMENTED_BUTTON_GROUP_TOKEN = new InjectionToken<SegmentedButtonGroupDirectiveBase>(
  'SEGMENTED_BUTTON_GROUP_TOKEN',
);

export type SegmentedButtonItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
};

export type SegmentedButtonGroupDirectiveBase<TValue = unknown> = {
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
  registerItem(item: SegmentedButtonItem<TValue>): void;
  unregisterItem(item: SegmentedButtonItem<TValue>): void;
  select(item: SegmentedButtonItem<TValue>): void;
};
