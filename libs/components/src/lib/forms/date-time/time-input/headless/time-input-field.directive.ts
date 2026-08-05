import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../../form-field/headless';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DatePickerInputFieldDirective } from '../../internals/date-picker-input-field.directive';
import { TIME_INPUT_ERROR_CODES } from '../time-input-errors';
import { TimeInputDirective } from './time-input.directive';

/**
 * The text field of a time input: shows the committed value in the display
 * format, commits typed text (strict-then-lenient) on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown. Hosts the
 * time input's opt-in typing mask (`INPUT_MASK_HOST`).
 */
@Directive({
  selector: 'input[etTimeInputField]',
  exportAs: 'etTimeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: TimeInputFieldDirective }],
})
export class TimeInputFieldDirective extends DatePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected pickerInput = inject(TimeInputDirective, { optional: true });

  constructor() {
    super();

    registerSingleton(this.pickerInput?.registeredField, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.pickerInput) {
          throw new RuntimeError(
            TIME_INPUT_ERROR_CODES.FIELD_OUTSIDE_TIME_INPUT,
            '[TimeInputFieldDirective] etTimeInputField must be placed inside an [etTimeInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
