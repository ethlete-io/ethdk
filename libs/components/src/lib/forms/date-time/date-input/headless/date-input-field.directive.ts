import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../../form-field/headless';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DatePickerInputFieldDirective } from '../../internals/date-picker-input-field.directive';
import { DATE_INPUT_ERROR_CODES } from '../date-input-errors';
import { DateInputDirective } from './date-input.directive';

/**
 * The text field of a date input: shows the committed value in the display
 * format, commits typed text strictly on blur/Enter, keeps unparseable text
 * visible, and opens the picker on Alt+ArrowDown. Hosts the date input's opt-in
 * typing mask (`INPUT_MASK_HOST`).
 */
@Directive({
  selector: 'input[etDateInputField]',
  exportAs: 'etDateInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: DateInputFieldDirective }],
})
export class DateInputFieldDirective extends DatePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected pickerInput = inject(DateInputDirective, { optional: true });

  constructor() {
    super();

    registerSingleton(this.pickerInput?.registeredField, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.pickerInput) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_INPUT,
            '[DateInputFieldDirective] etDateInputField must be placed inside an [etDateInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
