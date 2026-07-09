import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-menu-item-shortcut',
  template: `<ng-content />`,
  styleUrl: './menu-item-shortcut.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-item-shortcut',
    'aria-hidden': 'true',
  },
})
export class MenuItemShortcutComponent {}
