import { ElementRef, InjectionToken, Signal, WritableSignal } from '@angular/core';
import { SelectionState } from './internals/selection-state';

export const SELECTION_LIST_TOKEN = new InjectionToken<SelectionListDirectiveBase>('SELECTION_LIST_TOKEN');

export const SELECTION_LIST_MULTIPLE = new InjectionToken<boolean>('SELECTION_LIST_MULTIPLE');

export type SelectionListItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
  elementRef: ElementRef<HTMLElement>;
  /** The option's rendered text, which typeahead matches by prefix - its label must lead it. */
  label: () => string;
};

export type SelectionListDirectiveBase<TValue = unknown> = {
  value: WritableSignal<TValue | TValue[] | null>;
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
  readonly: Signal<boolean>;
  required: Signal<boolean>;
  name: Signal<string>;
  selection: SelectionState<TValue, SelectionListItem<TValue>>;
  focusItem(item: SelectionListItem<TValue>, options?: FocusOptions): void;
  /** Buffers a typed character and returns the enabled item its prefix names next after `from`. */
  findTypeaheadMatch(character: string, from: SelectionListItem<TValue>): SelectionListItem<TValue> | null;
  markTouched(): void;
};
