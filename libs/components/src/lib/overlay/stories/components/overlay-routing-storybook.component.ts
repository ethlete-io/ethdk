import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { injectOverlayManager } from '../../overlay-manager';
import { OverlayBodyComponent } from '../../overlay-body.component';
import { OverlayCloseDirective } from '../../overlay-close.directive';
import { OverlayFooterDirective } from '../../overlay-footer.directive';
import { OverlayHeaderDirective } from '../../overlay-header.directive';
import { OverlayHeaderTemplateDirective } from '../../overlay-header-template.directive';
import { OverlayMainDirective } from '../../overlay-main.directive';
import { OverlayTitleDirective } from '../../overlay-title.directive';
import {
  OverlayBackOrCloseDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  OverlayRouterOutletDisabledTemplateDirective,
  provideOverlayRouter,
} from '../../routing';
import { OverlaySidebarComponent, SidebarOverlayService, provideSidebarOverlay } from '../../sidebar';
import { dialogOverlayStrategy, transformingFullScreenDialogToDialogOverlayStrategy } from '../../strategies';

// ─── Multi-step routing demo: pages ──────────────────────────────────────────

@Component({
  selector: 'et-sb-rt-page-1',
  template: `
    <ng-template etOverlayHeaderTemplate>Home</ng-template>
    <p class="text-medium text-white/70">
      The <strong class="font-semibold text-white">first step</strong> of the routing demo. The overlay has its own
      internal router — navigation never touches Angular's application router. Each page supplies its header title via
      <code class="rounded bg-white/10 px-1 py-0.5 text-small">etOverlayHeaderTemplate</code>.
    </p>
    <p class="mt-4 text-medium text-white/70">Use the footer buttons to move between steps.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage1Component {}

@Component({
  selector: 'et-sb-rt-page-2',
  template: `
    <ng-template etOverlayHeaderTemplate>Step 2</ng-template>
    <p class="text-medium text-white/70">Second step. Any content can live here — forms, confirmations, previews.</p>
    <ul class="mt-3 list-disc pl-6 text-medium text-white/70">
      <li>Item one</li>
      <li>Item two</li>
      <li>Item three</li>
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage2Component {}

@Component({
  selector: 'et-sb-rt-page-3',
  template: `
    <ng-template etOverlayHeaderTemplate>Step 3</ng-template>
    <p class="text-medium text-white/70">Final step. Close the overlay or navigate back to any previous step.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage3Component {}

@Component({
  selector: 'et-sb-rt-overlay',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" etOverlayTitle>
          <et-overlay-route-header-template-outlet />
        </h2>
      </div>

      <et-overlay-body dividers="static">
        <et-overlay-router-outlet [disabled]="outletDisabled()">
          <ng-template etOverlayRouterOutletDisabledTemplate>
            <ng-template etOverlayHeaderTemplate>Navigating…</ng-template>
            <div class="flex flex-col items-center gap-2 py-6 text-small text-white/60">Loading…</div>
          </ng-template>
        </et-overlay-router-outlet>
      </et-overlay-body>

      <div class="flex flex-wrap gap-2" etOverlayFooter>
        <button et-button etOverlayRouterLink="/" size="sm" variant="outline">Home</button>
        <button et-button etOverlayRouterLink="/page-2" size="sm" variant="outline">Step 2</button>
        <button et-button etOverlayRouterLink="/page-3" size="sm" variant="outline">Step 3</button>
        <button (click)="outletDisabled.set(!outletDisabled())" et-button size="sm" variant="transparent">
          {{ outletDisabled() ? 'Enable outlet' : 'Disable outlet' }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayRouterOutletDisabledTemplateDirective,
    OverlayHeaderTemplateDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  styles: `
    et-sb-rt-overlay {
      display: block;
      width: 480px;
      max-width: 100vw;
    }
  `,
})
export class RoutingDemoOverlayComponent {
  public outletDisabled = signal(false);
}

// ─── URL-synced routing demo (syncUrl: true) ─────────────────────────────────
// Reuses the routing pages, but the router mirrors each step into the browser URL (?ovr=…) so
// deep-linking and browser back/forward work. The header "←" uses etOverlayBackOrClose, which
// defers to the browser history when URL sync is on.

@Component({
  selector: 'et-sb-url-rt-overlay',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <div class="flex items-center gap-2">
          <button aria-label="Back" et-button etOverlayBackOrClose size="sm" variant="transparent">←</button>
          <h2 class="text-h6 font-title" etOverlayTitle>
            <et-overlay-route-header-template-outlet />
          </h2>
        </div>
      </div>

      <et-overlay-body dividers="static">
        <et-overlay-router-outlet />
      </et-overlay-body>

      <div class="flex flex-wrap gap-2" etOverlayFooter>
        <button et-button etOverlayRouterLink="/" size="sm" variant="outline">Home</button>
        <button et-button etOverlayRouterLink="/page-2" size="sm" variant="outline">Step 2</button>
        <button et-button etOverlayRouterLink="/page-3" size="sm" variant="outline">Step 3</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayBackOrCloseDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  styles: `
    et-sb-url-rt-overlay {
      display: block;
      width: 480px;
      max-width: 100vw;
    }
  `,
})
export class UrlRoutingDemoOverlayComponent {}

// ─── Sidebar navigation demo: pages ──────────────────────────────────────────

@Component({
  selector: 'et-sb-sb-page-1',
  template: `
    <et-overlay-header>
      <div class="flex items-center gap-2">
        @if (!sidebar.renderSidebar()) {
          <button et-button etOverlayRouterLink="/sidebar" size="sm" variant="transparent">☰ Menu</button>
        }
        <h3 class="text-h6 font-title" etOverlayTitle>Home</h3>
      </div>
    </et-overlay-header>
    <et-overlay-body dividers="dynamic">
      <p class="text-medium text-white/70">Home page. On narrow viewports the sidebar collapses into a "☰ Menu" page.</p>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/settings" size="sm">Go to Settings →</button>
      </et-overlay-footer>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class SidebarDemoPage1Component {
  protected sidebar = inject(SidebarOverlayService);
}

@Component({
  selector: 'et-sb-sb-page-2',
  template: `
    <et-overlay-header>
      <div class="flex items-center gap-2">
        @if (!sidebar.renderSidebar()) {
          <button et-button etOverlayRouterLink="/sidebar" size="sm" variant="transparent">☰ Menu</button>
        }
        <h3 class="text-h6 font-title" etOverlayTitle>Settings</h3>
      </div>
    </et-overlay-header>
    <et-overlay-body dividers="dynamic">
      <p class="text-medium text-white/70">Settings page. Adjust preferences or navigate to another section.</p>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/" size="sm" variant="outline">← Home</button>
        <button et-button etOverlayRouterLink="/about" size="sm">About →</button>
      </et-overlay-footer>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class SidebarDemoPage2Component {
  protected sidebar = inject(SidebarOverlayService);
}

@Component({
  selector: 'et-sb-sb-page-3',
  template: `
    <et-overlay-header>
      <div class="flex items-center gap-2">
        @if (!sidebar.renderSidebar()) {
          <button et-button etOverlayRouterLink="/sidebar" size="sm" variant="transparent">☰ Menu</button>
        }
        <h3 class="text-h6 font-title" etOverlayTitle>About</h3>
      </div>
    </et-overlay-header>
    <et-overlay-body dividers="dynamic">
      <p class="text-medium text-white/70">About page. Starts full-screen on mobile and becomes a dialog on larger screens.</p>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/settings" size="sm" variant="outline">← Settings</button>
      </et-overlay-footer>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class SidebarDemoPage3Component {
  protected sidebar = inject(SidebarOverlayService);
}

@Component({
  selector: 'et-sb-sb-overlay',
  template: `
    <et-overlay-sidebar>
      <ng-template etOverlayHeaderTemplate>Navigation</ng-template>
      <p class="mb-3 text-small font-semibold uppercase tracking-widest text-white/50">Menu</p>
      <nav class="mb-auto flex flex-col gap-1">
        <button et-button etOverlayRouterLink="/" size="sm" variant="transparent">Home</button>
        <button et-button etOverlayRouterLink="/settings" size="sm" variant="transparent">Settings</button>
        <button et-button etOverlayRouterLink="/about" size="sm" variant="transparent">About</button>
      </nav>
      <button class="mt-4" et-button etOverlayClose size="sm" variant="outline">Close</button>
    </et-overlay-sidebar>

    <et-overlay-router-outlet />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlaySidebarComponent,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayHeaderTemplateDirective,
    OverlayCloseDirective,
  ],
  styles: `
    /* !important overrides the overlay container's single-column grid so the sidebar and outlet sit side by side */
    et-sb-sb-overlay {
      display: flex !important;
      min-height: 100%;
    }

    /* the sidebar host only occupies a column when it is actually rendering (wide viewports);
       on mobile it collapses and the menu is reached via the /sidebar page */
    et-sb-sb-overlay .et-overlay-sidebar-host {
      display: none;
    }

    et-sb-sb-overlay .et-overlay-sidebar-host.et-overlay-sidebar--visible {
      display: flex;
      flex: 0 0 auto;
      inline-size: 200px;
      flex-direction: column;
      border-right: 1px solid rgb(255 255 255 / 0.1);
      padding: 16px;
    }

    et-sb-sb-overlay et-overlay-router-outlet {
      flex: 1 1 auto;
      min-inline-size: 0;
    }
  `,
})
export class SidebarDemoOverlayComponent {}

// ─── Story host ──────────────────────────────────────────────────────────────

@Component({
  selector: 'et-sb-overlay-routing',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Overlay Routing</h2>
        <p class="text-small text-white/60">
          An internal router for multi-step flows — no dependency on Angular's application router.
        </p>
      </header>

      <div class="flex flex-wrap gap-4">
        <button (click)="openWithRouting()" et-button size="sm">Multi-step routing</button>
        <button (click)="openWithUrlRouting()" et-button size="sm" variant="outline">URL-synced routing</button>
        <button (click)="openWithSidebar()" et-button size="sm" variant="tonal">Sidebar navigation</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS],
  styles: `
    .et-sb-routing-panel {
      background-color: #1c1c1f;
      color: #fafafa;
    }
    .et-overlay--dialog.et-sb-routing-panel {
      border-radius: 12px;
    }
  `,
})
export class OverlayRoutingStorybookComponent {
  private overlayManager = injectOverlayManager();

  public openWithRouting() {
    this.overlayManager.open(RoutingDemoOverlayComponent, {
      strategies: dialogOverlayStrategy(),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: RoutingDemoPage1Component },
            { path: '/page-2', component: RoutingDemoPage2Component },
            { path: '/page-3', component: RoutingDemoPage3Component },
          ],
        }),
      ],
    });
  }

  public openWithUrlRouting() {
    this.overlayManager.open(UrlRoutingDemoOverlayComponent, {
      strategies: dialogOverlayStrategy(),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          syncUrl: true,
          routes: [
            { path: '/', component: RoutingDemoPage1Component },
            { path: '/page-2', component: RoutingDemoPage2Component },
            { path: '/page-3', component: RoutingDemoPage3Component },
          ],
        }),
      ],
    });
  }

  public openWithSidebar() {
    this.overlayManager.open(SidebarDemoOverlayComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy({
        dialog: { width: '550px', height: '500px' },
      }),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: SidebarDemoPage1Component },
            { path: '/settings', component: SidebarDemoPage2Component },
            { path: '/about', component: SidebarDemoPage3Component },
          ],
        }),
        provideSidebarOverlay({ renderSidebarFrom: 480 }),
      ],
    });
  }
}
