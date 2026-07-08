import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { MenuItemDirective } from './headless';

export const MENU_ITEM_VARIANTS = {
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
} as const;

export type MenuItemVariant = (typeof MENU_ITEM_VARIANTS)[keyof typeof MENU_ITEM_VARIANTS];

@Component({
  selector: 'button[et-menu-item], a[et-menu-item]',
  templateUrl: './menu-item.component.html',
  styleUrl: './menu-item.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['disabled', 'closeOnActivate'],
      outputs: ['activated'],
    },
  ],
  host: {
    class: 'et-menu-item',
    '[attr.data-variant]': 'variant()',
  },
})
export class MenuItemComponent {
  public variant = input<MenuItemVariant>(MENU_ITEM_VARIANTS.DEFAULT);
}
