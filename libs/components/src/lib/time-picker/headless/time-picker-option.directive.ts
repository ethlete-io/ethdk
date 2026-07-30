import { Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TIME_PICKER_ERROR_CODES } from '../time-picker-errors';
import { TimePickerColumnDirective } from './time-picker-column.directive';
import { TimePickerOption, TimePickerDirective } from './time-picker.directive';

/**
 * One option (place it on the option's `<button>`): ARIA/data attributes,
 * selection on activation, the roving-tabindex focus pull, and keeping the
 * column scrolled to the focused option.
 */
@Directive({
  selector: 'button[etTimePickerOption]',
  exportAs: 'etTimePickerOption',
  host: {
    type: 'button',
    role: 'option',
    '[attr.aria-selected]': 'option().selected',
    // aria-disabled, not the disabled attribute: the roving tabindex needs the option focusable
    '[attr.aria-disabled]': 'option().disabled || null',
    '[attr.tabindex]': 'option().focused ? 0 : -1',
    '[attr.data-selected]': "option().selected ? '' : null",
    '[attr.data-disabled]': "option().disabled ? '' : null",
    '[attr.data-focused]': "option().focused ? '' : null",
    '(click)': 'timePicker?.selectPart(option().unit, option().value)',
  },
})
export class TimePickerOptionDirective {
  protected timePicker = inject(TimePickerDirective, { optional: true });
  private column = inject(TimePickerColumnDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public option = input.required<TimePickerOption>();

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.timePicker || !this.column) {
          throw new RuntimeError(
            TIME_PICKER_ERROR_CODES.OPTION_OUTSIDE_COLUMN,
            'An [etTimePickerOption] must be placed inside an [etTimePickerColumn].',
          );
        }
      });
    }

    // pull DOM focus along while the user keyboard-navigates the column
    effect(() => {
      if (this.option().focused && this.column?.focusIsInside()) {
        this.elementRef.nativeElement.focus({ preventScroll: true });
      }
    });

    // keep the roving target (selection, or the initial anchor) centered
    effect(() => {
      if (this.option().focused && this.column) {
        this.column.scrollOptionIntoView(this.elementRef.nativeElement);
      }
    });
  }
}
