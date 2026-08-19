import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { DATE_INPUT_ERROR_CODES } from '../date-input/date-input-errors';
import { DATE_PICKER_HOST, DatePickerSurfaceContext } from './date-picker-host';

/** The template rendered inside a date control's picker overlay pane. */
@Directive({
  selector: 'ng-template[etDatePickerSurface]',
  exportAs: 'etDatePickerSurface',
})
export class DatePickerSurfaceDirective {
  private host = inject(DATE_PICKER_HOST, { optional: true });
  public templateRef = inject<TemplateRef<DatePickerSurfaceContext>>(TemplateRef);
  private hostElement = injectHostElement<Comment>();

  constructor() {
    registerSingleton(this.host?.registeredSurface, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.host) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.SURFACE_OUTSIDE_DATE_INPUT,
            '[DatePickerSurfaceDirective] etDatePickerSurface must be placed inside a date picker host ([etDateInput], [etDateRangeInput], [etTimeInput] or [etDateTimeInput]).',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
