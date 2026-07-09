import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-menu-separator',
  template: ``,
  styleUrl: './menu-separator.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-separator',
    role: 'separator',
    'aria-orientation': 'horizontal',
  },
})
export class MenuSeparatorComponent {}
