import { BreadcrumbComponent } from './components/breadcrumb';
import { BreadcrumbOutletComponent } from './components/breadcrumb-outlet';
import { BreadcrumbItemTemplateDirective } from './directives/breadcrumb-item-template.directive';
import { BreadcrumbItemDirective } from './directives/breadcrumb-item.directive';
import { BreadcrumbTemplateDirective } from './directives/breadcrumb-template.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BreadcrumbImports = [
  BreadcrumbOutletComponent,
  BreadcrumbComponent,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbTemplateDirective,
] as const;
