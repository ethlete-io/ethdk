import { Component, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';
import { ProvideColorDirective, injectErrorTheme } from '@ethlete/core';
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
  hostDirectives: [
    {
      directive: MenuItemDirective,
      inputs: ['disabled', 'closeOnActivate'],
      outputs: ['activated'],
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

  public variant = input<MenuItemVariant>(MENU_ITEM_VARIANTS.DEFAULT);

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
