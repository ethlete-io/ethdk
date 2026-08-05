import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';
import { SelectItem, SelectOptionData } from './select.tokens';

export type SelectOptionTemplateContext = {
  /** The option's source entry from the `options` input - extra fields included. */
  $implicit: SelectOptionData;
  item: SelectItem;
};

/**
 * Custom render template for the rows of a data-driven (`options` input) select. When
 * present, `et-select` renders this template as each option's label content instead of the
 * plain label text. Only applies to data-driven rows - projected `et-select-option`s carry
 * their own content.
 */
@Directive({
  selector: 'ng-template[etSelectOptionTemplate]',
  exportAs: 'etSelectOptionTemplate',
})
export class SelectOptionTemplateDirective {
  private readonly hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectOptionTemplateContext>>(TemplateRef);

  constructor() {
    registerSingleton(this.select?.registeredOptionTemplate, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.select) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.OPTION_TEMPLATE_OUTSIDE_SELECT,
            '[SelectOptionTemplateDirective] etSelectOptionTemplate must be placed inside an [etSelect] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  // static on purpose (the lint ban excepts it): Angular's template type checker requires
  // the context guard to be static - it types the `let-` bindings of the host ng-template
  public static ngTemplateContextGuard(
    _directive: SelectOptionTemplateDirective,
    _context: unknown,
  ): _context is SelectOptionTemplateContext {
    return true;
  }
}
