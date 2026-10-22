import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  GRID_2X2_ICON,
  IconDirective,
  NAV_TAB_IMPORTS,
  PENCIL_ICON,
  PLUS_ICON,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-nav-tab-page',
  template: `<p class="example-tab-content"><ng-content /></p>`,
  encapsulation: ViewEncapsulation.None,
})
export class NavTabPageComponent {}

@Component({
  selector: 'app-nav-route-one',
  template: `<app-nav-tab-page>Route One Content</app-nav-tab-page>`,
  encapsulation: ViewEncapsulation.None,
  imports: [NavTabPageComponent],
})
export class NavRouteOneComponent {}

@Component({
  selector: 'app-nav-route-two',
  template: `<app-nav-tab-page>Route Two Content</app-nav-tab-page>`,
  encapsulation: ViewEncapsulation.None,
  imports: [NavTabPageComponent],
})
export class NavRouteTwoComponent {}

@Component({
  selector: 'app-nav-route-three',
  template: `<app-nav-tab-page>Route Three Content</app-nav-tab-page>`,
  encapsulation: ViewEncapsulation.None,
  imports: [NavTabPageComponent],
})
export class NavRouteThreeComponent {}

@Component({
  selector: 'app-nav-tabs-default-example',
  template: `
    <et-nav-tabs color="brand">
      <a et-nav-tab-link="/one" queryParamsHandling="preserve"><i etIcon="et-grid-2x2"></i> One</a>
      <a et-nav-tab-link="/two" queryParamsHandling="preserve"><i etIcon="et-pencil"></i> Two</a>
      <a et-nav-tab-link="/three" queryParamsHandling="preserve"><i etIcon="et-plus"></i> Three</a>
      <a et-nav-tab-link="/four" disabled>Four</a>
    </et-nav-tabs>

    <et-nav-tabs-outlet>
      <router-outlet />
    </et-nav-tabs-outlet>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NAV_TAB_IMPORTS, RouterOutlet, IconDirective],
  providers: [provideIcons(GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON)],
  styles: `
    .example-tab-content {
      padding: 16px;
    }
  `,
})
export class NavTabsDefaultExampleComponent {
  constructor() {
    const router = inject(Router);

    router.resetConfig([
      { path: 'one', component: NavRouteOneComponent },
      { path: 'two', component: NavRouteTwoComponent },
      { path: 'three', component: NavRouteThreeComponent },
    ]);
    router.navigate(['/one'], { queryParamsHandling: 'preserve' });
  }
}
