import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { DATE_INPUT_ERROR_CODES } from '../date-input-errors';
import { DateInputDirective, DatePickerSurfaceContext } from './date-input.directive';

/** The template rendered inside the date input's picker overlay pane. */
@Directive({
  selector: 'ng-template[etDatePickerSurface]',
  exportAs: 'etDatePickerSurface',
})
export class DatePickerSurfaceDirective {
  private dateInput = inject(DateInputDirective, { optional: true });
  public templateRef = inject<TemplateRef<DatePickerSurfaceContext>>(TemplateRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.dateInput?.registeredSurface.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.dateInput?.registeredSurface() === this) {
        this.dateInput.registeredSurface.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.dateInput) {
          throw new RuntimeError(
            DATE_INPUT_ERROR_CODES.SURFACE_OUTSIDE_DATE_INPUT,
            '[DatePickerSurfaceDirective] etDatePickerSurface must be placed inside an [etDateInput] element.',
          );
        }
      });
    }
  }
}
