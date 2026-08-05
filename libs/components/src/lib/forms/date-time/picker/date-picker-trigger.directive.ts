import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
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
    // keep focus on the field through the toggle: without this, the mousedown blurs the input
    // (dropping the field's focused style and the value's clear button) a frame before the click
    // opens the picker and restores it - a visible flicker. The picker still autofocuses on open.
    '(mousedown)': '$event.preventDefault()',
  },
})
export class DatePickerTriggerDirective {
  protected host = inject(DATE_PICKER_HOST, { optional: true });
  public elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  constructor() {
    registerSingleton(this.host?.registeredTrigger, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.host) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_DATE_INPUT,
            '[DatePickerTriggerDirective] etDatePickerTrigger must be placed inside a date picker host ([etDateInput], [etDateRangeInput], [etTimeInput] or [etDateTimeInput]).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
