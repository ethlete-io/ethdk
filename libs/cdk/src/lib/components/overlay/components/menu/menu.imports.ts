import { MenuComponent } from './components/menu';
import { MenuGroupDirective } from './directives/menu-group';
import { MenuGroupTitleDirective } from './directives/menu-group-title';
import { MenuItemDirective } from './directives/menu-item';
import { MenuTriggerDirective } from './directives/menu-trigger';

export const MenuImports = [
  MenuGroupDirective,
  MenuGroupTitleDirective,
  MenuItemDirective,
  MenuTriggerDirective,
  MenuComponent,
] as const;
