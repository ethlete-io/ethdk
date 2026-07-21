import { Component, Input, ViewEncapsulation } from '@angular/core';

let nextUniqueId = 0;

@Component({
  selector: 'et-nav-tabs-outlet',
  template: '<ng-content />',
  styleUrls: ['nav-tabs-outlet.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-nav-tabs-outlet et-legacy',
    role: 'tabpanel',
    '[attr.id]': 'id',
    '[attr.aria-labelledby]': '_activeTabId',
  },
})
export class NavTabsOutletComponent {
  @Input()
  id = `et-nav-tabs-outlet-${nextUniqueId++}`;

  _activeTabId?: string;
}
