import { ChangeDetectionStrategy, Component, HostBinding, Input, ViewEncapsulation } from '@angular/core';

let nextUniqueId = 0;

@Component({
  selector: 'et-nav-tabs-outlet',
  template: '<ng-content />',
  styleUrls: ['nav-tabs-outlet.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,

  host: {
    class: 'et-nav-tabs-outlet',
  },
})
export class NavTabsOutletComponent {
  @Input()
  id = `et-nav-tabs-outlet-${nextUniqueId++}`;

  @HostBinding('attr.aria-labelledby')
  get _attrAriaLabelledBy() {
    return this._activeTabId;
  }

  @HostBinding('attr.role')
  get _attrRole() {
    return 'tabpanel';
  }

  @HostBinding('attr.id')
  get _attrId() {
    return this.id;
  }

  _activeTabId?: string;
}
