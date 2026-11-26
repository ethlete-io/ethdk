import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet, Routes } from '@angular/router';
import {
  GRID_2X2_ICON,
  IconDirective,
  NAV_TAB_IMPORTS,
  PENCIL_ICON,
  PLUS_ICON,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-nav-route-one',
  template: `<p class="example-tab-content">Route One Content</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class NavRouteOneComponent {}

@Component({
  selector: 'app-nav-route-two',
  template: `<p class="example-tab-content">Route Two Content</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class NavRouteTwoComponent {}

@Component({
  selector: 'app-nav-route-three',
  template: `<p class="example-tab-content">Route Three Content</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class NavRouteThreeComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'one' },
  { path: 'one', component: NavRouteOneComponent },
  { path: 'two', component: NavRouteTwoComponent },
  { path: 'three', component: NavRouteThreeComponent },
];

@Component({
  selector: 'app-nav-tabs-default-example',
  template: `
    <et-nav-tabs color="brand">
      <a et-nav-tab-link="/one"><i etIcon="et-grid-2x2"></i> One</a>
      <a et-nav-tab-link="/two"><i etIcon="et-pencil"></i> Two</a>
      <a et-nav-tab-link="/three"><i etIcon="et-plus"></i> Three</a>
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
export class NavTabsDefaultExampleComponent {}
