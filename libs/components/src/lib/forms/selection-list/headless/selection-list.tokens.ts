import { ElementRef, InjectionToken, Signal, WritableSignal } from '@angular/core';

export const SELECTION_LIST_TOKEN = new InjectionToken<SelectionListDirectiveBase>('SELECTION_LIST_TOKEN');

export const SELECTION_LIST_MULTIPLE = new InjectionToken<boolean>('SELECTION_LIST_MULTIPLE');

export type SelectionListItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
  elementRef: ElementRef<HTMLElement>;
};

export type SelectionListDirectiveBase<TValue = unknown> = {
  value: WritableSignal<TValue | TValue[] | null>;
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
  required: Signal<boolean>;
  name: Signal<string>;
  items: Signal<SelectionListItem<TValue>[]>;
  allSelected: Signal<boolean>;
  someSelected: Signal<boolean>;
  registerItem(item: SelectionListItem<TValue>): void;
  unregisterItem(item: SelectionListItem<TValue>): void;
  select(item: SelectionListItem<TValue>): void;
  focusItem(item: SelectionListItem<TValue>): void;
  markTouched(): void;
  toggleAll(): void;
};
