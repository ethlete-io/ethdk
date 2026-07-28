import { Directive, inject } from '@angular/core';
import { BreadcrumbItemTemplateDirective } from './breadcrumb-templates.directive';

/**
 * The crumb itself, inside an `etBreadcrumbItemTemplate` — an anchor, a `<button>`, or a plain `<span>`
 * for the page you're on. It carries the crumb styling and marks the last crumb `aria-current="page"`,
 * which is how a screen reader knows where in the trail the user actually is.
 *
 * Optional: a crumb template renders whatever it contains. Use it and you get the default look and the
 * `aria-current` wiring for free.
 */
@Directive({
  selector: '[etBreadcrumbItem]',
  exportAs: 'etBreadcrumbItem',
  host: {
    class: 'et-breadcrumb-item',
    '[attr.aria-current]': 'isCurrent() ? "page" : null',
  },
})
export class BreadcrumbItemDirective {
  // Available because the crumb sits inside the `ng-template[etBreadcrumbItemTemplate]` that declares it,
  // whose directive is therefore in the element injector chain — wherever the breadcrumb renders it.
  private itemTemplate = inject(BreadcrumbItemTemplateDirective, { optional: true });

  protected isCurrent() {
    return this.itemTemplate?.isLast() ?? false;
  }
}
