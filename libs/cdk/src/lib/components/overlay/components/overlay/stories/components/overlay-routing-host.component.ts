import { ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { ProgressSpinnerComponent } from '../../../../../progress-spinner';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayHeaderTemplateDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from '../../common';
import { injectOverlayManager } from '../../overlay-manager';
import {
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  OverlayRouterOutletDisabledTemplateDirective,
  OverlayRouterService,
  provideOverlayRouterConfig,
} from '../../routing';
import { OverlaySidebarComponent, provideSidebarOverlayConfig, SidebarOverlayService } from '../../sidebar';
import { dialogOverlayStrategy, transformingFullScreenDialogToDialogOverlayStrategy } from '../../strategies';
import { OVERLAY_PANEL_STYLES, STORY_HOST_STYLES } from './story-styles';

// ─── Catch-all route component (used by provideRouter in the story) ──────────

import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'et-sb-routing-story-route',
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
})
export class RoutingStorybookRouteComponent {}

// ─── Multi-step routing demo: page components ─────────────────────────────────

@Component({
  selector: 'et-sb-rt-page-1',
  template: `
    <ng-template etOverlayHeaderTemplate>Home</ng-template>
    <div class="rt-page">
      <p class="rt-page-text">
        This is the <strong>first step</strong> of the routing demo. The overlay has its own internal router —
        navigation never touches Angular's application router. The header title is supplied by each page via
        <code>etOverlayHeaderTemplate</code> and rendered through <code>et-overlay-route-header-template-outlet</code>.
      </p>
      <p class="rt-page-text">Use the footer buttons to move between steps.</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage1Component {}

@Component({
  selector: 'et-sb-rt-page-2',
  template: `
    <ng-template etOverlayHeaderTemplate>Step 2</ng-template>
    <div class="rt-page">
      <p class="rt-page-text">Second step. Any content can live here — forms, confirmations, data previews, etc.</p>
      <ul class="rt-page-list">
        <li>Item one</li>
        <li>Item two</li>
        <li>Item three</li>
      </ul>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage2Component {}

@Component({
  selector: 'et-sb-rt-page-3',
  template: `
    <ng-template etOverlayHeaderTemplate>Step 3</ng-template>
    <div class="rt-page">
      <p class="rt-page-text">Final step. Close the overlay or navigate back to any previous step.</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage3Component {}

// ─── Multi-step routing demo: shell ──────────────────────────────────────────

const RT_STYLES = `
  et-sb-rt-overlay {
    display: flex;
    flex-direction: column;
    width: 480px;
    max-width: 100vw;
  }

  et-sb-rt-overlay .et-overlay-header h3 { margin: 0; }

  et-sb-rt-overlay .et-overlay-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .rt-page { padding: 0.125rem 0; }

  .rt-page-text {
    color: #a1a1aa;
    font-size: 0.875rem;
    line-height: 1.6;
    margin: 0 0 0.625rem;
  }
  .rt-page-text:last-child { margin-bottom: 0; }

  .rt-page-text strong { color: #e4e4e7; font-weight: 600; }
  .rt-page-text code {
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    color: #e4e4e7;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.8125em;
    padding: 1px 4px;
  }

  .rt-page-list {
    color: #a1a1aa;
    font-size: 0.875rem;
    margin: 0.375rem 0 0;
    padding-left: 1.25rem;
  }
  .rt-page-list li { margin-bottom: 0.25rem; }

  .rt-nav-btn {
    background: #3f3f46;
    border: 1px solid #52525b;
    border-radius: 5px;
    color: #f4f4f5;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    padding: 5px 12px;
    transition: background 0.15s;
  }
  .rt-nav-btn:hover { background: #52525b; }

  .rt-nav-btn--ghost {
    background: transparent;
    border-color: #3f3f46;
    color: #71717a;
  }
  .rt-nav-btn--ghost:hover { background: #27272a; color: #f4f4f5; }

  .rt-loading {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem 0;
  }
  .rt-loading p { color: #a1a1aa; font-size: 0.875rem; margin: 0; }
`;

@Component({
  selector: 'et-sb-rt-overlay',
  template: `
    <div etOverlayHeader>
      <h3 etOverlayTitle>
        <et-overlay-route-header-template-outlet />
      </h3>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet [disabled]="outletDisabled()">
        <ng-template etOverlayRouterOutletDisabledTemplate>
          <ng-template etOverlayHeaderTemplate>Navigating…</ng-template>
          <div class="rt-loading">
            <et-spinner diameter="28" strokeWidth="2" />
            <p>Loading…</p>
          </div>
        </ng-template>
      </et-overlay-router-outlet>
    </et-overlay-body>

    <div etOverlayFooter>
      <button class="rt-nav-btn" etOverlayRouterLink="/" type="button">Home</button>
      <button class="rt-nav-btn" etOverlayRouterLink="/page-2" type="button">Step 2</button>
      <button class="rt-nav-btn" etOverlayRouterLink="/page-3" type="button">Step 3</button>
      <button (click)="outletDisabled.set(!outletDisabled())" class="rt-nav-btn rt-nav-btn--ghost" type="button">
        {{ outletDisabled() ? 'Enable outlet' : 'Disable outlet' }}
      </button>
    </div>
  `,
  styles: [OVERLAY_PANEL_STYLES, RT_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [OverlayMainDirective],
  providers: [OverlayRouterService],
  imports: [
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayRouterOutletDisabledTemplateDirective,
    OverlayHeaderTemplateDirective,
    ProgressSpinnerComponent,
  ],
})
export class RoutingDemoOverlayComponent {
  readonly outletDisabled = signal(false);
}

// ─── Sidebar navigation demo: page components ────────────────────────────────

@Component({
  selector: 'et-sb-sb-page-1',
  template: `
    <et-overlay-header>
      <h3 etOverlayTitle>Home</h3>
    </et-overlay-header>

    <et-overlay-body dividers="dynamic">
      <p class="sb-page-text">
        Home page of the sidebar demo. The sidebar is driven by
        <code>OverlaySidebarComponent</code> and toggles based on overlay width.
      </p>
      <p class="sb-page-text">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero sint ipsam totam minus molestiae accusantium hic
        consequuntur expedita eligendi quaerat.
      </p>
    </et-overlay-body>

    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button class="sb-footer-btn" etOverlayRouterLink="/settings" type="button">Go to Settings →</button>
      </et-overlay-footer>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [OverlayMainDirective],
  imports: [
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
})
export class SidebarDemoPage1Component {
  readonly sidebar = inject(SidebarOverlayService);
}

@Component({
  selector: 'et-sb-sb-page-2',
  template: `
    <et-overlay-header>
      <h3 etOverlayTitle>Settings</h3>
    </et-overlay-header>

    <et-overlay-body dividers="dynamic">
      <p class="sb-page-text">Settings page. Adjust preferences or navigate to another section.</p>
      <p class="sb-page-text">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Architecto consequatur natus animi laborum molestias
        facilis possimus ipsum officiis quis vitae?
      </p>
    </et-overlay-body>

    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button class="sb-footer-btn" etOverlayRouterLink="/" type="button">← Home</button>
        <button class="sb-footer-btn" etOverlayRouterLink="/about" type="button">About →</button>
      </et-overlay-footer>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [OverlayMainDirective],
  imports: [
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
})
export class SidebarDemoPage2Component {
  readonly sidebar = inject(SidebarOverlayService);
}

@Component({
  selector: 'et-sb-sb-page-3',
  template: `
    <et-overlay-header>
      <h3 etOverlayTitle>About</h3>
    </et-overlay-header>

    <et-overlay-body dividers="dynamic">
      <p class="sb-page-text">
        About page. Uses <code>transformingFullScreenDialogToDialogOverlayStrategy</code> so the overlay starts
        full-screen on mobile and becomes a dialog on larger screens.
      </p>
    </et-overlay-body>

    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button class="sb-footer-btn" etOverlayRouterLink="/settings" type="button">← Settings</button>
      </et-overlay-footer>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [OverlayMainDirective],
  imports: [
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayRouterLinkDirective,
  ],
})
export class SidebarDemoPage3Component {
  readonly sidebar = inject(SidebarOverlayService);
}

// ─── Sidebar navigation demo: shell ─────────────────────────────────────────

const SB_STYLES = `
  et-sb-sb-overlay .et-overlay-sidebar-host {
    border-right: 1px solid #27272a;
    padding: 1rem;
  }

  .sb-sidebar-title {
    color: #71717a;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    margin: 0 0 0.75rem;
    text-transform: uppercase;
  }

  .sb-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: auto;
  }

  .sb-nav-btn {
    background: transparent;
    border: none;
    border-radius: 5px;
    color: #a1a1aa;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    padding: 6px 10px;
    text-align: left;
    transition: background 0.15s, color 0.15s;
    width: 100%;
  }
  .sb-nav-btn:hover { background: #27272a; color: #f4f4f5; }

  .sb-close-btn {
    background: transparent;
    border: 1px solid #3f3f46;
    border-radius: 5px;
    color: #71717a;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    margin-top: 1rem;
    padding: 5px 10px;
    transition: background 0.15s, color 0.15s;
    width: 100%;
  }
  .sb-close-btn:hover { background: #27272a; color: #f4f4f5; }

  .sb-page-text {
    color: #a1a1aa;
    font-size: 0.875rem;
    line-height: 1.6;
    margin: 0 0 0.625rem;
  }
  .sb-page-text:last-child { margin-bottom: 0; }
  .sb-page-text code {
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    color: #e4e4e7;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.8125em;
    padding: 1px 4px;
  }

  .sb-footer-btn {
    background: #3f3f46;
    border: 1px solid #52525b;
    border-radius: 5px;
    color: #f4f4f5;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    padding: 5px 12px;
    transition: background 0.15s;
  }
  .sb-footer-btn:hover { background: #52525b; }
`;

@Component({
  selector: 'et-sb-sb-overlay',
  template: `
    <et-overlay-sidebar>
      <ng-template etOverlayHeaderTemplate>Navigation</ng-template>
      <p class="sb-sidebar-title">Menu</p>
      <nav class="sb-nav">
        <button class="sb-nav-btn" etOverlayRouterLink="/" type="button">Home</button>
        <button class="sb-nav-btn" etOverlayRouterLink="/settings" type="button">Settings</button>
        <button class="sb-nav-btn" etOverlayRouterLink="/about" type="button">About</button>
      </nav>
      <button class="sb-close-btn" etOverlayClose type="button">Close</button>
    </et-overlay-sidebar>

    <et-overlay-router-outlet />
  `,
  styles: [OVERLAY_PANEL_STYLES, SB_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [OverlayRouterService, SidebarOverlayService],
  imports: [
    OverlaySidebarComponent,
    OverlayRouterOutletComponent,
    OverlayRouterLinkDirective,
    OverlayHeaderTemplateDirective,
    OverlayCloseDirective,
  ],
})
export class SidebarDemoOverlayComponent {}

// ─── Story host ──────────────────────────────────────────────────────────────

@Component({
  selector: 'et-sb-overlay-routing-host',
  template: `
    <div class="et-sb-host">
      <h2 class="et-sb-heading">Overlay Routing</h2>
      <p class="et-sb-subheading">
        Overlays support an internal router for multi-step flows without depending on Angular's application router.
      </p>

      <div class="et-sb-card-grid">
        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Multi-step routing</h3>
          <p class="et-sb-card-text">
            An overlay with its own router outlet. Navigate between steps without closing the overlay. The header title
            updates per page.
          </p>
          <button (click)="openWithRouting()" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Sidebar navigation</h3>
          <p class="et-sb-card-text">
            A collapsible sidebar drives navigation between overlay pages. Combines with the transforming full-screen
            strategy for responsive behaviour.
          </p>
          <button (click)="openWithSidebar()" class="et-sb-btn" type="button">Open</button>
        </div>
      </div>
    </div>
  `,
  styles: [STORY_HOST_STYLES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayRoutingHostComponent {
  private readonly _manager = injectOverlayManager();

  openWithRouting() {
    this._manager.open(RoutingDemoOverlayComponent, {
      strategies: dialogOverlayStrategy(),
      providers: [
        provideOverlayRouterConfig({
          routes: [
            { path: '/', component: RoutingDemoPage1Component },
            { path: '/page-2', component: RoutingDemoPage2Component },
            { path: '/page-3', component: RoutingDemoPage3Component },
          ],
        }),
      ],
    });
  }

  openWithSidebar() {
    this._manager.open(SidebarDemoOverlayComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy({
        dialog: { width: '550px', height: '500px' },
      }),
      providers: [
        provideOverlayRouterConfig({
          routes: [
            { path: '/', component: SidebarDemoPage1Component },
            { path: '/settings', component: SidebarDemoPage2Component },
            { path: '/about', component: SidebarDemoPage3Component },
          ],
        }),
        provideSidebarOverlayConfig({}),
      ],
    });
  }
}
