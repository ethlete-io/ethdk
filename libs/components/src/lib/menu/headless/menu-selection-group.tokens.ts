import { ElementRef, InjectionToken, Signal, WritableSignal } from '@angular/core';

export const MENU_SELECTION_GROUP_TOKEN = new InjectionToken<MenuSelectionGroupDirectiveBase>(
  'MENU_SELECTION_GROUP_TOKEN',
);

export const MENU_SELECTION_GROUP_MULTIPLE = new InjectionToken<boolean>('MENU_SELECTION_GROUP_MULTIPLE');

export const MENU_SELECTION_ITEM_KIND = new InjectionToken<MenuSelectionItemKind>('MENU_SELECTION_ITEM_KIND');

export type MenuSelectionItemKind = 'radio' | 'checkbox';

export type MenuSelectionGroupItem<TValue = unknown> = {
  value: Signal<TValue | undefined>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
  elementRef: ElementRef<HTMLElement>;
};

export type MenuSelectionGroupDirectiveBase<TValue = unknown> = {
  value: WritableSignal<TValue | TValue[] | null>;
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
  items: Signal<MenuSelectionGroupItem<TValue>[]>;
  labelId: WritableSignal<string | null>;
  registerItem(item: MenuSelectionGroupItem<TValue>): void;
  unregisterItem(item: MenuSelectionGroupItem<TValue>): void;
  select(item: MenuSelectionGroupItem<TValue>): void;
  markTouched(): void;
};
