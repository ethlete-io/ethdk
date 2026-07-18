import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectSelectedEntry } from './select.tokens';
import { SelectDirective } from './select.directive';

export type SelectValueContext = {
  /**
   * One entry per selected value — `label` is the resolved display label and `item` the live
   * option (or `null`, e.g. while an external filter hides it). Look up your own option data
   * by `entry.value` to render rich content such as flags.
   */
  $implicit: SelectSelectedEntry[];
  select: SelectDirective;
};

/**
 * Custom render template for the trigger's value area. When present, `et-select` renders
 * this template instead of its default single label / chips display, with the currently
 * selected items as context.
 */
@Directive({
  selector: 'ng-template[etSelectValue]',
  exportAs: 'etSelectValue',
})
export class SelectValueDirective {
  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectValueContext>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredValueTemplate, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.VALUE_OUTSIDE_SELECT,
            '[SelectValueDirective] etSelectValue must be placed inside an [etSelect] element.',
          );
        }
      });
    }
  }
}
