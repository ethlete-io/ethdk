import { InjectionToken, Signal, TemplateRef, WritableSignal } from '@angular/core';

/**
 * The contract a control must fulfil to host the shared date picker pieces
 * (`etDatePickerTrigger`, `etDatePickerSurface`). Implemented by the date
 * input, the date range input and the time input.
 */
export type DatePickerHost = {
  pickerOpen: Signal<boolean>;
  interactive: Signal<boolean>;
  openPicker(): void;
  closePicker(): void;
  togglePicker(): void;
  /** @internal */
  registeredTrigger: WritableSignal<DatePickerTriggerBase | null>;
  /** @internal */
  registeredSurface: WritableSignal<DatePickerSurfaceBase | null>;
};

export type DatePickerTriggerBase = {
  elementRef: { nativeElement: HTMLButtonElement };
};

export type DatePickerSurfaceBase = {
  templateRef: TemplateRef<DatePickerSurfaceContext>;
};

/** Context of the template rendered inside the picker overlay pane. */
export type DatePickerSurfaceContext = {
  $implicit: DatePickerHost;
  close: () => void;
};

export const DATE_PICKER_HOST = new InjectionToken<DatePickerHost>('DATE_PICKER_HOST');
