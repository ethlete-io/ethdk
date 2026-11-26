import { booleanAttribute, Directive, input } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etBreadcrumbItemTemplate]',
  host: {
    class: 'et-breadcrumb-item et-legacy',
  },
})
export class BreadcrumbItemTemplateDirective {
  templateRef = injectTemplateRef();
  loading = input(false, { transform: booleanAttribute });
}
