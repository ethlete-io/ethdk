import { MenuCheckboxItemComponent, MenuComponent, MenuRadioItemComponent } from './components';
import {
  MenuCheckboxGroupDirective,
  MenuGroupDirective,
  MenuGroupTitleDirective,
  MenuItemDirective,
  MenuRadioGroupDirective,
  MenuTriggerDirective,
} from './directives';

export const MenuImports = [
  MenuCheckboxGroupDirective,
  MenuGroupDirective,
  MenuGroupTitleDirective,
  MenuItemDirective,
  MenuRadioGroupDirective,
  MenuTriggerDirective,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuRadioItemComponent,
] as const;
