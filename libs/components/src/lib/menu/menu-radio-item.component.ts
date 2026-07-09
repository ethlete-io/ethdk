import { Component, ViewEncapsulation } from '@angular/core';
import { MENU_SELECTION_ITEM_KIND, MenuItemDirective, MenuSelectionItemDirective } from './headless';

@Component({
  selector: 'et-menu-radio-item',
  templateUrl: './menu-selection-item.component.html',
  styleUrl: './menu-selection-item.component.css',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: MENU_SELECTION_ITEM_KIND, useValue: 'radio' }],
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['closeOnActivate'],
      outputs: ['activated'],
    },
    {
      directive: MenuSelectionItemDirective,
      inputs: ['value', 'checked', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-menu-item et-menu-selection-item et-menu-radio-item',
  },
})
export class MenuRadioItemComponent {}
