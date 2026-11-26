import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  dialogOverlayStrategy,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  OverlayBackOrCloseDirective,
  OverlayMainDirective,
  OverlayHeaderTemplateDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  provideOverlayRouter,
} from '@ethlete/components';

@Component({
  selector: 'app-overlay-routing-details-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Create workspace</ng-template>
    <p>
      Workspaces group your team's projects, members and billing in one place. This wizard runs on the overlay's own
      router, so moving between steps never touches the application router.
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class OverlayRoutingDetailsPageComponent {}

@Component({
  selector: 'app-overlay-routing-members-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Invite members</ng-template>
    <ul>
      @for (member of MEMBERS; track member.email) {
        <li>{{ member.name }} ({{ member.email }})</li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class OverlayRoutingMembersPageComponent {
  protected readonly MEMBERS = [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' },
    { name: 'Alan Turing', email: 'alan@example.com' },
  ];
}

@Component({
  selector: 'app-overlay-routing-review-page',
  template: `
    <ng-template etOverlayHeaderTemplate>Review and create</ng-template>
    <p>You are about to create a workspace and invite 3 members.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class OverlayRoutingReviewPageComponent {}

@Component({
  selector: 'app-overlay-routing-shell',
  template: `
    <div etOverlayHeader>
      <button aria-label="Back" et-button etOverlayBackOrClose size="sm" variant="transparent">&larr;</button>
      <h2 et-overlay-title>
        <et-overlay-route-header-template-outlet />
      </h2>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet />
    </et-overlay-body>

    <div etOverlayFooter>
      <button et-button etOverlayRouterLink="/" size="sm" variant="outline">Details</button>
      <button et-button etOverlayRouterLink="/members" size="sm" variant="outline">Members</button>
      <button et-button etOverlayRouterLink="/review" size="sm" variant="outline">Review</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    OVERLAY_CONTENT_IMPORTS,
    OverlayBackOrCloseDirective,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayRouteHeaderTemplateOutletComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class OverlayRoutingShellComponent {}

@Component({
  selector: 'app-overlay-routing-example',
  template: `<button (click)="open()" et-button>Multi-step routing</button>`,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayRoutingExampleComponent {
  private overlayManager = injectOverlayManager();

  protected open() {
    this.overlayManager.open(OverlayRoutingShellComponent, {
      strategies: dialogOverlayStrategy({ width: 480, height: 'min(520px, 80vh)' }),
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: OverlayRoutingDetailsPageComponent },
            { path: '/members', component: OverlayRoutingMembersPageComponent },
            { path: '/review', component: OverlayRoutingReviewPageComponent },
          ],
        }),
      ],
    });
  }
}
