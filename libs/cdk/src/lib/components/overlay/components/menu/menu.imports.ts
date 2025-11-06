import { MenuComponent } from './components/menu';
import { MenuCheckboxItemComponent } from './components/menu-checkbox-item';
import { MenuRadioItemComponent } from './components/menu-radio-item';
import { MenuCheckboxGroupDirective } from './directives/menu-checkbox-group';
import { MenuGroupDirective } from './directives/menu-group';
import { MenuGroupTitleDirective } from './directives/menu-group-title';
import { MenuItemDirective } from './directives/menu-item';
import { MenuRadioGroupDirective } from './directives/menu-radio-group';
import { MenuSearchTemplateDirective } from './directives/menu-search-template';
import { MenuTriggerDirective } from './directives/menu-trigger';

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
