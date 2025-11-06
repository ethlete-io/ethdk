import { BreadcrumbComponent } from './components/breadcrumb';
import { BreadcrumbOutletComponent } from './components/breadcrumb-outlet';
import { BreadcrumbItemTemplateDirective } from './directives/breadcrumb-item-template.directive';
import { BreadcrumbItemDirective } from './directives/breadcrumb-item.directive';
import { BreadcrumbTemplateDirective } from './directives/breadcrumb-template.directive';

export const BreadcrumbImports = [
  BreadcrumbOutletComponent,
  BreadcrumbComponent,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbTemplateDirective,
] as const;
