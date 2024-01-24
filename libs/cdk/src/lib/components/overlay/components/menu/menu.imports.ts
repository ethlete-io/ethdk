import { MenuComponent } from './components';
import { MenuGroupDirective, MenuGroupTitleDirective, MenuItemDirective, MenuTriggerDirective } from './directives';

export const MenuImports = [
  MenuGroupDirective,
  MenuGroupTitleDirective,
  MenuItemDirective,
  MenuTriggerDirective,
  MenuComponent,
] as const;
