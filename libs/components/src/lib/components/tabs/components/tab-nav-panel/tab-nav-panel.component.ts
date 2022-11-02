import { Component, ViewEncapsulation, ChangeDetectionStrategy, Input, HostBinding } from '@angular/core';

let nextUniqueId = 0;

@Component({
  selector: 'et-tab-nav-panel',
  template: '<ng-content></ng-content>',
  styleUrls: ['tab-nav-panel.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'et-tab-nav-panel',
  },
})
export class TabNavPanelComponent {
  @Input()
  id = `et-tab-nav-panel-${nextUniqueId++}`;

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
