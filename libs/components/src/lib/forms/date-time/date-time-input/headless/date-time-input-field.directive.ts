import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../../form-field/headless';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DatePickerInputFieldDirective } from '../../internals/date-picker-input-field.directive';
import { DATE_TIME_INPUT_ERROR_CODES } from '../date-time-input-errors';
import { DateTimeInputDirective } from './date-time-input.directive';

/**
 * The text field of a date-time input: shows the committed value in the display
 * format, commits typed text (strict-then-lenient) on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown. Hosts the
 * date-time input's opt-in typing mask (`INPUT_MASK_HOST`).
 */
@Directive({
  selector: 'input[etDateTimeInputField]',
  exportAs: 'etDateTimeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: DateTimeInputFieldDirective }],
})
export class DateTimeInputFieldDirective extends DatePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected pickerInput = inject(DateTimeInputDirective, { optional: true });

  constructor() {
    super();

    registerSingleton(this.pickerInput?.registeredField, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.pickerInput) {
          throw new RuntimeError(
            DATE_TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_TIME_INPUT,
            '[DateTimeInputFieldDirective] etDateTimeInputField must be placed inside an [etDateTimeInput] element.',
          );
        }
      });
    }
  }
}
