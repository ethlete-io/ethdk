import { Component, ViewEncapsulation } from '@angular/core';
import {
  OverlayRouterService,
  OverlayWithRoutingImports,
  dialogOverlayStrategy,
  injectOverlayManager,
  provideOverlayRouterConfig,
} from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-overlay-routing-details',
  template: `
    <ng-template etOverlayHeaderTemplate>Create workspace</ng-template>
    <p>This flow runs on the overlay's own router, so the application route stays put.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayWithRoutingImports],
})
export class CdkOverlayRoutingDetailsComponent {}

@Component({
  selector: 'app-cdk-overlay-routing-members',
  template: `
    <ng-template etOverlayHeaderTemplate>Invite members</ng-template>
    <p>Ada Lovelace, Grace Hopper and Alan Turing.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayWithRoutingImports],
})
export class CdkOverlayRoutingMembersComponent {}

@Component({
  selector: 'app-cdk-overlay-routing-review',
  template: `
    <ng-template etOverlayHeaderTemplate>Review and create</ng-template>
    <p>You are about to create a workspace and invite 3 members.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayWithRoutingImports],
})
export class CdkOverlayRoutingReviewComponent {}

@Component({
  selector: 'app-cdk-overlay-routing-shell',
  template: `
    <div etOverlayHeader>
      <button etOverlayBackOrClose type="button">Back</button>
      <h2 etOverlayTitle>
        <et-overlay-route-header-template-outlet />
      </h2>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet />
    </et-overlay-body>

    <div etOverlayFooter>
      <button etOverlayRouterLink="/" type="button">Details</button>
      <button etOverlayRouterLink="/members" type="button">Members</button>
      <button etOverlayRouterLink="/review" type="button">Review</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayWithRoutingImports],
  providers: [OverlayRouterService],
})
export class CdkOverlayRoutingShellComponent {}

@Component({
  selector: 'app-cdk-overlay-routing-example',
  template: `<button (click)="open()" type="button">Open multi-step overlay</button>`,
  encapsulation: ViewEncapsulation.None,
})
export class CdkOverlayRoutingExampleComponent {
  private manager = injectOverlayManager();

  protected open() {
    this.manager.open(CdkOverlayRoutingShellComponent, {
      strategies: dialogOverlayStrategy({ maxWidth: '440px' }),
      providers: [
        provideOverlayRouterConfig({
          routes: [
            { path: '/', component: CdkOverlayRoutingDetailsComponent },
            { path: '/members', component: CdkOverlayRoutingMembersComponent },
            { path: '/review', component: CdkOverlayRoutingReviewComponent },
          ],
        }),
      ],
    });
  }
}
