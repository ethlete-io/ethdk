import { Component, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';
import { ProvideColorDirective, injectErrorTheme } from '@ethlete/core';
import { MenuItemDirective } from './headless';
import { MenuItemSubmenuIconComponent } from './menu-item-submenu-icon.component';

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
  imports: [MenuItemSubmenuIconComponent],
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['disabled', 'closeOnActivate'],
      outputs: ['activate'],
    },
    ProvideColorDirective,
  ],
  host: {
    class: 'et-menu-item',
    '[attr.data-variant]': 'variant()',
  },
})
export class MenuItemComponent {
  private provideColor = inject(ProvideColorDirective);
  private errorColorTheme = injectErrorTheme();
  private item = inject(MenuItemDirective);

  public variant = input<MenuItemVariant>(MENU_ITEM_VARIANTS.DEFAULT);

  // static: the host directive resolves `submenu` in its own constructor, which runs before this one
  protected isSubmenuTrigger = this.item.submenu !== null;

  constructor() {
    effect(() => {
      const isDestructive = this.variant() === MENU_ITEM_VARIANTS.DESTRUCTIVE;

      untracked(() => {
        if (isDestructive) {
          this.provideColor.forceColor(this.errorColorTheme);

          return;
        }

        this.provideColor.clearForcedColor();
      });
    });
  }
}
