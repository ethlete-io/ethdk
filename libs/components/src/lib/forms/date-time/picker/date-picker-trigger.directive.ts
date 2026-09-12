import { Directive, ElementRef, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { DATE_INPUT_ERROR_CODES } from '../date-input/date-input-errors';
import { DATE_PICKER_HOST } from './date-picker-host';

/** The suffix button toggling a date control's picker overlay. */
@Directive({
  selector: 'button[etDatePickerTrigger]',
  exportAs: 'etDatePickerTrigger',
  host: {
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'host?.pickerOpen() || false',
    '[disabled]': 'host ? !host.interactive() : false',
    '(click)': 'host?.togglePicker()',
    // keep focus on the field through the toggle: the mousedown would otherwise blur the input a
    // frame before the click reopens it, which flickers the focused style and the clear button
    '(mousedown)': '$event.preventDefault()',
  },
})
export class DatePickerTriggerDirective {
  protected host = inject(DATE_PICKER_HOST, { optional: true });
  public elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  constructor() {
    registerSingleton(this.host?.registeredTrigger, this);

    if (ngDevMode && !this.host) {
      throw new RuntimeError(
        DATE_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_DATE_INPUT,
        '[DatePickerTriggerDirective] etDatePickerTrigger must be placed inside a date picker host ([etDateInput], [etDateRangeInput], [etTimeInput], [etDateTimeInput], [etTimeRangeInput] or [etDateTimeRangeInput]).',
        { element: this.elementRef.nativeElement },
      );
    }
  }
}
