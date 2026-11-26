import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterOutlet, Routes } from '@angular/router';
import { TabImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-nav-route-one',
  template: `<h3>One</h3>`,
  encapsulation: ViewEncapsulation.None,
})
export class CdkNavRouteOneComponent {}

@Component({
  selector: 'app-cdk-nav-route-two',
  template: `<h3>Two</h3>`,
  encapsulation: ViewEncapsulation.None,
})
export class CdkNavRouteTwoComponent {}

@Component({
  selector: 'app-cdk-nav-route-three',
  template: `<h3>Three</h3>`,
  encapsulation: ViewEncapsulation.None,
})
export class CdkNavRouteThreeComponent {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'one' },
  { path: 'one', component: CdkNavRouteOneComponent },
  { path: 'two', component: CdkNavRouteTwoComponent },
  { path: 'three', component: CdkNavRouteThreeComponent },
];

@Component({
  selector: 'app-cdk-nav-tabs-default-example',
  template: `
    <nav [tabOutlet]="tabOutlet" et-nav-tabs>
      <a et-nav-tab-link routerLink="/one">Tab One</a>
      <a et-nav-tab-link routerLink="/two">Other Tab</a>
      <a et-nav-tab-link routerLink="/three">One more Tab</a>
      <a et-nav-tab-link disabled>Disabled Tab</a>
    </nav>

    <et-nav-tabs-outlet #tabOutlet>
      <router-outlet />
    </et-nav-tabs-outlet>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TabImports, RouterLink, RouterOutlet],
})
export class CdkNavTabsDefaultExampleComponent {}
