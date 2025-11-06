import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NavTabLinkComponent } from '../../../partials/nav-tabs/nav-tab-link';
import { NavTabsOutletComponent } from '../../../partials/nav-tabs/nav-tabs-outlet';
import { NavTabsComponent } from '../nav-tabs.component';

@Component({
  selector: 'et-nav-tabs-outlet-storybook',
  template: `
    <nav [tabOutlet]="tabOutlet" et-nav-tabs>
      <a et-nav-tab-link routerLink="./one"> Tab One</a>
      <a et-nav-tab-link routerLink="./two"> Other Tab</a>
      <a et-nav-tab-link routerLink="./three"> One more Tab</a>
      <a et-nav-tab-link routerLink="./four">Tab</a>
      <a et-nav-tab-link disabled>Disabled Tab</a>
    </nav>

    <et-nav-tabs-outlet #tabOutlet>
      <router-outlet />
    </et-nav-tabs-outlet>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavTabsComponent, NavTabsOutletComponent, NavTabLinkComponent, RouterModule],
})
export class TabNavPanelStorybookComponent implements OnInit {
  private _router = inject(Router);

  ngOnInit(): void {
    this._router.navigate(['./one']);
  }
}
