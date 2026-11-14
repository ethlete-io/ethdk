import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { IconDirective } from '../icon';
import { SpinnerComponent } from '../loader';
import { MENU_SELECTION_ITEM_KIND, MenuItemDirective, MenuSelectionItemDirective } from './headless';

@Component({
  selector: 'et-menu-radio-item',
  templateUrl: './menu-selection-item.component.html',
  styleUrl: './menu-selection-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, SpinnerComponent],
  providers: [{ provide: MENU_SELECTION_ITEM_KIND, useValue: 'radio' }],
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['loading', 'closeOnActivate'],
      outputs: ['activate'],
    },
    {
      directive: MenuSelectionItemDirective,
      inputs: ['value', 'checked', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['checkedChange', 'touchedChange', 'touch'],
    },
  ],
  host: {
    class: 'et-menu-item et-menu-selection-item et-menu-radio-item',
    '[class.et-menu-selection-item--has-icon]': '!!icon()',
  },
})
export class MenuRadioItemComponent {
  protected item = inject(MenuItemDirective);

  public icon = input<string | null>(null);
}
