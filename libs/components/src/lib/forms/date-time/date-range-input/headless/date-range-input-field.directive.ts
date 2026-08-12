import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DateRangePickerInputFieldDirective } from '../../internals/date-range-picker-input-field.directive';
import { DATE_RANGE_INPUT_ERROR_CODES } from '../date-range-input-errors';
import { DateRangeInputDirective } from './date-range-input.directive';

/**
 * One side of a date range input: shows the committed side value in the
 * display format, commits typed text strictly on blur/Enter, keeps
 * unparseable text visible, and opens the picker on Alt+ArrowDown. Hosts the
 * range input's opt-in typing mask (`INPUT_MASK_HOST`) - each side is its own
 * mask host.
 */
@Directive({
  selector: 'input[etDateRangeInputField]',
  exportAs: 'etDateRangeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: DateRangeInputFieldDirective }],
})
export class DateRangeInputFieldDirective extends DateRangePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected rangeInput = inject(DateRangeInputDirective, { optional: true });

  constructor() {
    super();

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.rangeInput) {
          throw new RuntimeError(
            DATE_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_DATE_RANGE_INPUT,
            '[DateRangeInputFieldDirective] etDateRangeInputField must be placed inside an [etDateRangeInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
