import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { NavTabsOutletDirective } from './headless/nav-tabs-outlet.directive';

@Component({
  selector: 'et-nav-tabs-outlet',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [NavTabsOutletDirective],
  host: {
    class: 'et-nav-tabs-outlet',
  },
  styles: `
    .et-nav-tabs-outlet {
      display: block;
    }
  `,
})
export class NavTabsOutletComponent {}
