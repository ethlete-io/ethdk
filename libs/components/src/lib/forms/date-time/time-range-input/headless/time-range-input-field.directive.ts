import { Directive, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { INPUT_MASK_HOST } from '../../../masked-input/headless/input-mask-host';
import { DateRangePickerInputFieldDirective } from '../../internals/date-range-picker-input-field.directive';
import { TIME_RANGE_INPUT_ERROR_CODES } from '../time-range-input-errors';
import { TimeRangeInputDirective } from './time-range-input.directive';

/**
 * One side of a time range input: shows the committed side value in the display format, commits typed
 * text (strict-then-lenient) on blur/Enter, keeps unparseable text visible, and opens the picker on
 * Alt+ArrowDown. Hosts the range input's opt-in typing mask (`INPUT_MASK_HOST`) - each side is its own
 * mask host.
 */
@Directive({
  selector: 'input[etTimeRangeInputField]',
  exportAs: 'etTimeRangeInputField',
  providers: [{ provide: INPUT_MASK_HOST, useExisting: TimeRangeInputFieldDirective }],
})
export class TimeRangeInputFieldDirective extends DateRangePickerInputFieldDirective {
  // eslint-disable-next-line ethlete/inject-member-accessibility -- referenced from the base class's host bindings
  protected rangeInput = inject(TimeRangeInputDirective, { optional: true });

  constructor() {
    super();

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.rangeInput) {
          throw new RuntimeError(
            TIME_RANGE_INPUT_ERROR_CODES.FIELD_OUTSIDE_TIME_RANGE_INPUT,
            '[TimeRangeInputFieldDirective] etTimeRangeInputField must be placed inside an [etTimeRangeInput] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
