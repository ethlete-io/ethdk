import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NavTabLinkDirective, NavTabsOutletComponent } from '../../../partials';
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
      <router-outlet></router-outlet>
    </et-nav-tabs-outlet>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NavTabsComponent, NavTabsOutletComponent, NavTabLinkDirective, RouterModule],
})
export class TabNavPanelStorybookComponent implements OnInit {
  constructor(private _router: Router) {}

  ngOnInit(): void {
    this._router.navigate(['./one']);
  }
}
