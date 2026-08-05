import { Directive, TemplateRef, afterNextRender, inject, input } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectDirective } from './select.directive';
import { SelectItem, SelectOptionData } from './select.tokens';

export type SelectOptionTemplateContext<TOption extends SelectOptionData = SelectOptionData> = {
  /** The option's source entry from the `options` input - extra fields included. */
  $implicit: TOption;
  item: SelectItem;
};

/**
 * Custom render template for the rows of a data-driven (`options` input) select. When
 * present, `et-select` renders this template as each option's label content instead of the
 * plain label text. Only applies to data-driven rows - projected `et-select-option`s carry
 * their own content.
 *
 * `let-option`'s type widens to the base `SelectOptionData` unless this directive's own
 * `[options]` is also bound to the same array passed to the select's `[options]` - e.g.
 * `<ng-template etSelectOptionTemplate [options]="managers()" let-option>` - which carries the
 * array's element type into the template context, extra fields included.
 */
@Directive({
  selector: 'ng-template[etSelectOptionTemplate]',
  exportAs: 'etSelectOptionTemplate',
})
export class SelectOptionTemplateDirective<TOption extends SelectOptionData = SelectOptionData> {
  private readonly hostElement = injectHostElement();

  private select = inject(SelectDirective, { optional: true });
  public templateRef = inject<TemplateRef<SelectOptionTemplateContext<TOption>>>(TemplateRef);

  /** Type witness only, to type `let-option` - bind the same array passed to the select's `[options]`. Never read. */
  public options = input<readonly TOption[] | undefined>(undefined);

  constructor() {
    // erases TOption - the registry only needs the base shape (`registeredOptionTemplate` is
    // unparameterized), while `this` here is generic-invariant because of the `options` input
    registerSingleton(this.select?.registeredOptionTemplate, this as unknown as SelectOptionTemplateDirective);

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
  public static ngTemplateContextGuard<TOption extends SelectOptionData>(
    _directive: SelectOptionTemplateDirective<TOption>,
    _context: unknown,
  ): _context is SelectOptionTemplateContext<TOption> {
    return true;
  }
}
