import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { OverlayBodyComponent } from '../../overlay-body.component';
import { OverlayCloseDirective } from '../../overlay-close.directive';
import { OverlayFooterDirective } from '../../overlay-footer.directive';
import { OverlayHeaderTemplateDirective } from '../../overlay-header-template.directive';
import { OverlayHeaderDirective } from '../../overlay-header.directive';
import { OverlayMainDirective } from '../../overlay-main.directive';
import { injectOverlayManager } from '../../overlay-manager';
import { OverlayTitleDirective } from '../../overlay-title.directive';
import {
  OverlayBackOrCloseDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  OverlayRouterOutletDisabledTemplateDirective,
  provideOverlayRouter,
} from '../../routing';
import { OverlaySidebarComponent, injectSidebarOverlay, provideSidebarOverlay } from '../../sidebar';
import { dialogOverlayStrategy, transformingFullScreenDialogToDialogOverlayStrategy } from '../../strategies';

// ─── Multi-step routing demo: pages ──────────────────────────────────────────

@Component({
  selector: 'et-sb-rt-page-1',
  template: `
    <ng-template etOverlayHeaderTemplate>Create workspace</ng-template>
    <p class="text-base text-white/80">
      Workspaces group your team's projects, members and billing in one place. This wizard runs on the overlay's own
      router — moving between steps never touches Angular's application router.
    </p>
    <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base">
      <dt class="text-white/50">Name</dt>
      <dd>Ethlete HQ</dd>
      <dt class="text-white/50">Plan</dt>
      <dd>Team — 14-day trial</dd>
      <dt class="text-white/50">Region</dt>
      <dd>eu-central</dd>
    </dl>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage1Component {}

@Component({
  selector: 'et-sb-rt-page-2',
  template: `
    <ng-template etOverlayHeaderTemplate>Invite members</ng-template>
    <p class="text-base text-white/80">Everyone below receives an invite email once the workspace is created.</p>
    <ul class="mt-4 flex flex-col divide-y divide-white/10">
      @for (member of MEMBERS; track member.email) {
        <li class="flex items-center justify-between gap-4 py-3">
          <span class="flex flex-col">
            <span class="text-base">{{ member.name }}</span>
            <span class="text-small text-white/50">{{ member.email }}</span>
          </span>
          <span class="text-small text-white/60">{{ member.role }}</span>
        </li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage2Component {
  protected readonly MEMBERS = [
    { name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
    { name: 'Grace Hopper', email: 'grace@example.com', role: 'Editor' },
    { name: 'Alan Turing', email: 'alan@example.com', role: 'Viewer' },
  ];
}

@Component({
  selector: 'et-sb-rt-page-3',
  template: `
    <ng-template etOverlayHeaderTemplate>Review &amp; create</ng-template>
    <p class="text-base text-white/80">
      You are about to create <strong class="font-semibold text-white">Ethlete HQ</strong> in
      <strong class="font-semibold text-white">eu-central</strong> and invite
      <strong class="font-semibold text-white">3 members</strong>.
    </p>
    <p class="mt-4 text-base text-white/60">
      The trial converts to the Team plan after 14 days. You can downgrade or delete the workspace at any time from the
      billing settings.
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHeaderTemplateDirective],
})
export class RoutingDemoPage3Component {}

@Component({
  selector: 'et-sb-rt-overlay',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h6 font-title" etOverlayTitle>
        <et-overlay-route-header-template-outlet />
      </h2>
    </div>

    <et-overlay-body dividers="static">
      <et-overlay-router-outlet [disabled]="outletDisabled()">
        <ng-template etOverlayRouterOutletDisabledTemplate>
          <ng-template etOverlayHeaderTemplate>Hang tight…</ng-template>
          <div class="flex flex-col items-center justify-center gap-2 py-10 text-base text-white/60">
            Creating your workspace…
          </div>
        </ng-template>
      </et-overlay-router-outlet>
    </et-overlay-body>

    <div class="flex flex-wrap gap-2" etOverlayFooter>
      <button et-button etOverlayRouterLink="/" size="sm" variant="outline">Details</button>
      <button et-button etOverlayRouterLink="/members" size="sm" variant="outline">Members</button>
      <button et-button etOverlayRouterLink="/review" size="sm" variant="outline">Review</button>
      <button (click)="outletDisabled.set(!outletDisabled())" et-button size="sm" variant="transparent">
        {{ outletDisabled() ? 'Enable outlet' : 'Disable outlet' }}
      </button>
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
      <button et-button etOverlayRouterLink="/" size="sm" variant="outline">Details</button>
      <button et-button etOverlayRouterLink="/members" size="sm" variant="outline">Members</button>
      <button et-button etOverlayRouterLink="/review" size="sm" variant="outline">Review</button>
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
        <h3 class="text-h6 font-title" etOverlayTitle>General</h3>
      </div>
    </et-overlay-header>
    <et-overlay-body dividers="dynamic">
      <div class="flex flex-col divide-y divide-white/10">
        <div class="flex items-center justify-between gap-4 py-3">
          <span class="flex flex-col">
            <span class="text-base">Workspace name</span>
            <span class="text-small text-white/50">Shown in invites and notifications</span>
          </span>
          <span class="text-base text-white/70">Ethlete HQ</span>
        </div>
        <div class="flex items-center justify-between gap-4 py-3">
          <span class="flex flex-col">
            <span class="text-base">Language</span>
            <span class="text-small text-white/50">Applies to every member</span>
          </span>
          <span class="text-base text-white/70">English</span>
        </div>
        <div class="flex items-center justify-between gap-4 py-3">
          <span class="flex flex-col">
            <span class="text-base">Time zone</span>
            <span class="text-small text-white/50">Used for schedules and reports</span>
          </span>
          <span class="text-base text-white/70">Europe/Berlin</span>
        </div>
      </div>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/notifications" size="sm">Notifications →</button>
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
  protected sidebar = injectSidebarOverlay();
}

@Component({
  selector: 'et-sb-sb-page-2',
  template: `
    <et-overlay-header>
      <div class="flex items-center gap-2">
        @if (!sidebar.renderSidebar()) {
          <button et-button etOverlayRouterLink="/sidebar" size="sm" variant="transparent">☰ Menu</button>
        }
        <h3 class="text-h6 font-title" etOverlayTitle>Notifications</h3>
      </div>
    </et-overlay-header>
    <et-overlay-body dividers="dynamic">
      <p class="text-base text-white/80">Choose what your team gets notified about.</p>
      <ul class="mt-4 flex flex-col divide-y divide-white/10">
        @for (rule of RULES; track rule.label) {
          <li class="flex items-center justify-between gap-4 py-3">
            <span class="flex flex-col">
              <span class="text-base">{{ rule.label }}</span>
              <span class="text-small text-white/50">{{ rule.hint }}</span>
            </span>
            <span [class]="rule.enabled ? 'text-emerald-400' : 'text-white/40'" class="text-small">
              {{ rule.enabled ? 'On' : 'Off' }}
            </span>
          </li>
        }
      </ul>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/" size="sm" variant="outline">← General</button>
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
  protected sidebar = injectSidebarOverlay();

  protected readonly RULES = [
    { label: 'Match results', hint: 'Posted right after a match ends', enabled: true },
    { label: 'Roster changes', hint: 'When members join or leave a team', enabled: true },
    { label: 'Weekly digest', hint: 'A summary every Monday morning', enabled: false },
  ];
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
      <p class="text-base text-white/80">
        This dialog is full-screen on narrow viewports and becomes a fixed-size dialog on larger screens. The sidebar
        collapses into a navigable page whenever the dialog itself is narrower than 480px.
      </p>
      <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base">
        <dt class="text-white/50">Version</dt>
        <dd>5.0.0-next</dd>
        <dt class="text-white/50">Channel</dt>
        <dd>next</dd>
      </dl>
    </et-overlay-body>
    @if (!sidebar.renderSidebar()) {
      <et-overlay-footer>
        <button et-button etOverlayRouterLink="/notifications" size="sm" variant="outline">← Notifications</button>
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
  protected sidebar = injectSidebarOverlay();
}

@Component({
  selector: 'et-sb-sb-overlay',
  template: `
    <et-overlay-sidebar>
      <ng-template etOverlayHeaderTemplate>Settings</ng-template>
      <p class="mb-3 text-small font-semibold uppercase tracking-widest text-white/50">Settings</p>
      <nav class="mb-auto flex flex-col gap-1">
        <button et-button etOverlayRouterLink="/" size="sm" variant="transparent">General</button>
        <button et-button etOverlayRouterLink="/notifications" size="sm" variant="transparent">Notifications</button>
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
      border: 1px solid rgb(255 255 255 / 0.14);
      border-radius: 12px;
    }
  `,
})
export class OverlayRoutingStorybookComponent {
  private overlayManager = injectOverlayManager();

  public openWithRouting() {
    this.overlayManager.open(RoutingDemoOverlayComponent, {
      // routing overlays get a static height — pages scroll inside the outlet instead of resizing the dialog
      strategies: dialogOverlayStrategy({ width: 480, height: 'min(520px, 80vh)' }),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: RoutingDemoPage1Component },
            { path: '/members', component: RoutingDemoPage2Component },
            { path: '/review', component: RoutingDemoPage3Component },
          ],
        }),
      ],
    });
  }

  public openWithUrlRouting() {
    this.overlayManager.open(UrlRoutingDemoOverlayComponent, {
      strategies: dialogOverlayStrategy({ width: 480, height: 'min(520px, 80vh)' }),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          syncUrl: true,
          routes: [
            { path: '/', component: RoutingDemoPage1Component },
            { path: '/members', component: RoutingDemoPage2Component },
            { path: '/review', component: RoutingDemoPage3Component },
          ],
        }),
      ],
    });
  }

  public openWithSidebar() {
    this.overlayManager.open(SidebarDemoOverlayComponent, {
      strategies: transformingFullScreenDialogToDialogOverlayStrategy({
        dialog: { width: '620px', height: '520px' },
      }),
      panelClass: 'et-sb-routing-panel',
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: SidebarDemoPage1Component },
            { path: '/notifications', component: SidebarDemoPage2Component },
            { path: '/about', component: SidebarDemoPage3Component },
          ],
        }),
        provideSidebarOverlay({ renderSidebarFrom: 480 }),
      ],
    });
  }
}
