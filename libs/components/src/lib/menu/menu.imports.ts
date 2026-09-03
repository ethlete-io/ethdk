import {
  MenuContextTriggerDirective,
  MenuDirective,
  MenuItemDirective,
  MenuPanelDirective,
  MenuSelectionGroupDirective,
  MenuSelectionItemDirective,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from './headless';
import { MenuSearchDirective } from './headless/menu-search.directive';
import { MenuCheckboxGroupComponent } from './menu-checkbox-group.component';
import { MenuCheckboxItemComponent } from './menu-checkbox-item.component';
import { MenuGroupLabelComponent } from './menu-group-label.component';
import { MenuItemComponent } from './menu-item.component';
import { MenuItemShortcutComponent } from './menu-item-shortcut.component';
import { MenuRadioGroupComponent } from './menu-radio-group.component';
import { MenuRadioItemComponent } from './menu-radio-item.component';
import { MenuSeparatorComponent } from './menu-separator.component';
import { MenuComponent } from './menu.component';

export const MENU_IMPORTS = [
  MenuDirective,
  MenuTriggerDirective,
  MenuContextTriggerDirective,
  MenuSurfaceDirective,
  MenuPanelDirective,
  MenuItemDirective,
  MenuSelectionGroupDirective,
  MenuSelectionItemDirective,
  MenuComponent,
  MenuItemComponent,
  MenuItemShortcutComponent,
  MenuSeparatorComponent,
  MenuGroupLabelComponent,
  MenuRadioGroupComponent,
  MenuRadioItemComponent,
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
] as const;

/** Search input, loading indicator and custom scrollbar chrome for a menu. */
export const MENU_SEARCH_IMPORTS = [MenuSearchDirective] as const;
