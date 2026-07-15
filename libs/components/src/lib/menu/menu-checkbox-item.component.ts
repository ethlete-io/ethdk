import { Component, input, ViewEncapsulation } from '@angular/core';
import { IconDirective } from '../icon';
import { MENU_SELECTION_ITEM_KIND, MenuItemDirective, MenuSelectionItemDirective } from './headless';

@Component({
  selector: 'et-menu-checkbox-item',
  templateUrl: './menu-selection-item.component.html',
  styleUrl: './menu-selection-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [{ provide: MENU_SELECTION_ITEM_KIND, useValue: 'checkbox' }],
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['closeOnActivate'],
      outputs: ['activate'],
    },
    {
      directive: MenuSelectionItemDirective,
      inputs: ['value', 'checked', 'indeterminate', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'indeterminateChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-menu-item et-menu-selection-item et-menu-checkbox-item',
    '[class.et-menu-selection-item--has-icon]': '!!icon()',
  },
})
export class MenuCheckboxItemComponent {
  public icon = input<string | null>(null);
}
