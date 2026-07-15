import { Component, input, ViewEncapsulation } from '@angular/core';
import { IconDirective } from '../icon';
import { MENU_SELECTION_ITEM_KIND, MenuItemDirective, MenuSelectionItemDirective } from './headless';

@Component({
  selector: 'et-menu-radio-item',
  templateUrl: './menu-selection-item.component.html',
  styleUrl: './menu-selection-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [{ provide: MENU_SELECTION_ITEM_KIND, useValue: 'radio' }],
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['closeOnActivate'],
      outputs: ['activate'],
    },
    {
      directive: MenuSelectionItemDirective,
      inputs: ['value', 'checked', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-menu-item et-menu-selection-item et-menu-radio-item',
    '[class.et-menu-selection-item--has-icon]': '!!icon()',
  },
})
export class MenuRadioItemComponent {
  public icon = input<string | null>(null);
}
