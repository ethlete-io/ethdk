import { MenuCheckboxGroupDirective, MenuCheckboxItemComponent } from './checkbox';
import { MenuGroupTitleDirective } from './menu-group-title.directive';
import { MenuGroupDirective } from './menu-group.directive';
import { MenuItemDirective } from './menu-item.directive';
import { MenuSearchTemplateDirective } from './menu-search-template.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';
import { MenuComponent } from './menu.component';
import { MenuRadioGroupDirective, MenuRadioItemComponent } from './radio';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MenuImports = [
  MenuGroupDirective,
  MenuCheckboxItemComponent,
  MenuRadioItemComponent,
  MenuGroupTitleDirective,
  MenuItemDirective,
  MenuTriggerDirective,
  MenuCheckboxGroupDirective,
  MenuRadioGroupDirective,
  MenuComponent,
  MenuSearchTemplateDirective,
] as const;
