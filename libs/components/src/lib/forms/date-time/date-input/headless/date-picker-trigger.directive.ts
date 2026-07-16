import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { DATE_INPUT_ERROR_CODES } from '../date-input-errors';
import { DateInputDirective } from './date-input.directive';

/** The suffix button toggling a date input's picker overlay. */
@Directive({
  selector: 'button[etDatePickerTrigger]',
  exportAs: 'etDatePickerTrigger',
  host: {
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'dateInput?.pickerOpen() || false',
    '[disabled]': 'dateInput ? !dateInput.interactive() : false',
    '(click)': 'dateInput?.togglePicker()',
  },
})
export class DatePickerTriggerDirective {
  protected dateInput = inject(DateInputDirective, { optional: true });
  public elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.dateInput?.registeredTrigger.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.dateInput?.registeredTrigger() === this) {
        this.dateInput.registeredTrigger.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.dateInput) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_DATE_INPUT,
            '[DatePickerTriggerDirective] etDatePickerTrigger must be placed inside an [etDateInput] element.',
          );
        }
      });
    }
  }
}
