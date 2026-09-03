import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DateRangePickerInputFieldDirective } from '../../internals/date-range-picker-input-field.directive';
import { DATE_TIME_RANGE_INPUT_ERROR_CODES } from '../date-time-range-input-errors';
import { DateTimeRangeInputDirective } from './date-time-range-input.directive';

/**
 * One side of a date & time range input: shows the committed side value in the combined display
 * format, commits typed text (strict-then-lenient) on blur/Enter, keeps unparseable text visible,
 * and opens the picker on Alt+ArrowDown. Hosts the range input's opt-in typing mask
 * (`INPUT_MASK_HOST`) - each side is its own mask host.
 */
@Directive({
  selector: 'input[etDateTimeRangeInputField]',
  exportAs: 'etDateTimeRangeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: DateTimeRangeInputFieldDirective }],
})
export class DateTimeRangeInputFieldDirective extends DateRangePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected rangeInput = inject(DateTimeRangeInputDirective, { optional: true });

  constructor() {
    super();

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.rangeInput) {
          throw new RuntimeError(
            DATE_TIME_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_TIME_RANGE_INPUT,
            '[DateTimeRangeInputFieldDirective] etDateTimeRangeInputField must be placed inside an [etDateTimeRangeInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** @internal */
  public duplicateFieldError(side: 'start' | 'end') {
    return new RuntimeError(
      DATE_TIME_RANGE_INPUT_ERROR_CODES.DUPLICATE_FIELD,
      `[DateTimeRangeInputFieldDirective] An [etDateTimeRangeInput] accepts only one etDateTimeRangeInputField for its "${side}" side.`,
      { element: this.elementRef.nativeElement },
    );
  }
}
