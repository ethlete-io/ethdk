import { Component, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON } from '../icon/headless/chevron-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';

/**
 * The chevron a menu item shows when it also opens a submenu. `MenuItemComponent` stamps it, so its
 * styles only reach a document that renders a submenu trigger.
 *
 * Never move the `provideIcons` up onto the item: it shadows the app's registry for everything below
 * it, which would hide the consumer's own icons projected into the same row.
 *
 * @internal
 */
@Component({
  selector: 'et-menu-item-submenu-icon',
  template: `<i etIcon="et-chevron"></i>`,
  styleUrl: './menu-item-submenu-icon.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHEVRON_ICON)],
  host: {
    class: 'et-menu-item-submenu-icon',
    'aria-hidden': 'true',
  },
})
export class MenuItemSubmenuIconComponent {}
