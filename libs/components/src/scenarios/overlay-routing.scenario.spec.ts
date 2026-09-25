import { Component, HostAttributeToken, inject, model, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import {
  createOverlayOpener,
  defineQueryParamOverlay,
  dialogOverlayStrategy,
  injectOverlayManager,
  injectOverlayRouter,
  injectSidebarOverlay,
  OVERLAY_BACK_OR_CLOSE_TOKEN,
  OVERLAY_HEADER_TEMPLATE_TOKEN,
  OVERLAY_QUERY_PARAM_INPUT_NAME,
  OVERLAY_ROUTER_CONFIG_TOKEN,
  OVERLAY_ROUTER_LINK_TOKEN,
  OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN,
  OVERLAY_ROUTER_OUTLET_TOKEN,
  OVERLAY_ROUTER_TOKEN,
  OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN,
  OverlayBackOrCloseDirective,
  OverlayHeaderDirective,
  OverlayHeaderTemplateDirective,
  OverlayMainDirective,
  OverlayRouteHeaderTemplateOutletComponent,
  OverlayRouterLinkDirective,
  OverlayRouterOutletComponent,
  OverlayRouterOutletDisabledTemplateDirective,
  OverlaySharedRouteTemplateDirective,
  OverlaySharedRouteTemplateOutletComponent,
  OverlaySidebarComponent,
  OverlaySidebarPageComponent,
  provideOverlay,
  provideOverlayRouter,
  provideOverlayRouterConfig,
  provideOverlayRouterService,
  provideSidebarOverlay,
  provideSidebarOverlayConfig,
  provideSidebarOverlayService,
  QueryParamOverlayLinkDirective,
  SIDEBAR_OVERLAY_CONFIG,
  SIDEBAR_OVERLAY_TOKEN,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({ selector: 'et-scenario-token-probe', template: '' })
class TokenProbeComponent {
  static created: TokenProbeComponent[] = [];
  name = inject(new HostAttributeToken('name'));
  backOrClose = inject(OVERLAY_BACK_OR_CLOSE_TOKEN, { optional: true });
  headerTemplate = inject(OVERLAY_HEADER_TEMPLATE_TOKEN, { optional: true });
  disabledTemplate = inject(OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN, { optional: true });
  outlet = inject(OVERLAY_ROUTER_OUTLET_TOKEN, { optional: true });
  sharedTemplate = inject(OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN, { optional: true });
  link = inject(OVERLAY_ROUTER_LINK_TOKEN, { optional: true });

  constructor() {
    TokenProbeComponent.created.push(this);
  }
}

const probe = (name: string) => {
  const found = TokenProbeComponent.created.find((entry) => entry.name === name);

  if (!found) throw new Error(`no probe ${name}`);

  return found;
};

@Component({
  selector: 'et-scenario-general-page',
  imports: [
    OverlayHeaderTemplateDirective,
    OverlayRouterLinkDirective,
    OverlaySharedRouteTemplateOutletComponent,
    TokenProbeComponent,
  ],
  template: `
    <ng-template etOverlayHeaderTemplate
      ><span class="page-title">General</span><et-scenario-token-probe name="header"
    /></ng-template>
    <et-overlay-shared-route-template-outlet />
    <et-scenario-token-probe name="page" />
    <button class="to-members" etOverlayRouterLink="/members" type="button">
      Members<et-scenario-token-probe name="link" />
    </button>
  `,
})
class GeneralPageComponent {}

@Component({
  selector: 'et-scenario-members-page',
  imports: [
    OverlayHeaderTemplateDirective,
    OverlayBackOrCloseDirective,
    OverlayRouterLinkDirective,
    TokenProbeComponent,
  ],
  template: `
    <ng-template etOverlayHeaderTemplate><span class="page-title">Members</span></ng-template>
    <p class="members">{{ team() }}</p>
    <button class="back" etOverlayBackOrClose type="button">Back<et-scenario-token-probe name="back" /></button>
    <button class="to-general" etOverlayRouterLink="/" type="button">General</button>
  `,
})
class MembersPageComponent {
  team = model('');
  router = injectOverlayRouter();
}

@Component({
  selector: 'et-scenario-settings-overlay',
  imports: [
    OverlayMainDirective,
    OverlayHeaderDirective,
    OverlayRouteHeaderTemplateOutletComponent,
    OverlayRouterOutletComponent,
    OverlaySharedRouteTemplateDirective,
    OverlayRouterOutletDisabledTemplateDirective,
    TokenProbeComponent,
  ],
  template: `
    <div etOverlayMain>
      <div etOverlayHeader><et-overlay-route-header-template-outlet /></div>
      <et-overlay-router-outlet [disabled]="locked()">
        <ng-template etOverlaySharedRouteTemplate
          ><p class="shared">Shared</p>
          <et-scenario-token-probe name="shared"
        /></ng-template>
        <ng-template etOverlayRouterOutletDisabledTemplate
          ><p class="locked">Locked</p>
          <et-scenario-token-probe name="disabled"
        /></ng-template>
      </et-overlay-router-outlet>
    </div>
  `,
})
class SettingsOverlayComponent {
  locked = signal(false);
  router = injectOverlayRouter();
  routerByToken = inject(OVERLAY_ROUTER_TOKEN);
  config = inject(OVERLAY_ROUTER_CONFIG_TOKEN);
}

@Component({
  selector: 'et-scenario-sidebar-settings-overlay',
  imports: [OverlayRouterOutletComponent, OverlaySidebarComponent, OverlayHeaderTemplateDirective],
  template: `
    <et-overlay-sidebar>
      <ng-template etOverlayHeaderTemplate>Settings</ng-template>
      <nav class="sidebar-nav">nav</nav>
    </et-overlay-sidebar>
    <et-overlay-router-outlet />
  `,
})
class SidebarSettingsOverlayComponent {
  router = injectOverlayRouter();
  sidebar = injectSidebarOverlay();
  sidebarByToken = inject(SIDEBAR_OVERLAY_TOKEN);
  sidebarConfig = inject(SIDEBAR_OVERLAY_CONFIG);
}

const ROUTES = [
  { path: '/', component: GeneralPageComponent },
  { path: '/members', component: MembersPageComponent, inputs: { team: 'Core team' } },
] as const;

const query = (selector: string, root: ParentNode = document) => {
  const element = root.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const openSettings = <T extends object = SettingsOverlayComponent>(
  s: Scenario,
  providers: ReturnType<typeof provideOverlayRouter>,
  component: Type<T> = SettingsOverlayComponent as Type<T>,
) => {
  const ref = s.run(() =>
    injectOverlayManager().open<T>(component, {
      strategies: dialogOverlayStrategy(),
      autoFocus: false,
      providers: [...providers],
    }),
  );

  s.flush();

  const settings = ref.componentInstance();

  if (!settings) throw new Error('settings overlay did not mount');

  return { ref, settings };
};

const closeSettings = (s: Scenario, ref: { close: () => void }) => {
  ref.close();
  s.flush();
  expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
};

const pageTitle = () => document.querySelector('.page-title')?.textContent;

@Component({ selector: 'et-scenario-product-overlay', template: '<p class="product">{{ overlayQueryParam() }}</p>' })
class ProductOverlayComponent {
  overlayQueryParam = model<string>();
}

const productOverlay = defineQueryParamOverlay({
  component: ProductOverlayComponent,
  queryParamKey: 'product',
  strategies: dialogOverlayStrategy(),
  autoFocus: false,
});

@Component({
  selector: 'et-scenario-shop-page',
  imports: [QueryParamOverlayLinkDirective],
  template: `<a [etQueryParamOverlayLink]="productOverlay" class="product-link" etQueryParamOverlayLinkValue="42"
    >42</a
  >`,
})
class ShopPageComponent {
  productOverlay = productOverlay;
  product = createOverlayOpener(productOverlay);
}

describe('overlay routing scenarios', () => {
  describe('inside an overlay', () => {
    const scenario = useScenario({ providers: [provideOverlay()] });

    it('navigates between pages by link, swaps the route header and goes back', () => {
      const s = scenario();
      const { ref, settings } = openSettings(s, provideOverlayRouter({ routes: [...ROUTES] }));

      expect(settings.router).toBe(settings.routerByToken);
      expect(settings.config.routes).toHaveLength(2);
      expect(settings.router.currentRoute()).toBe('/');
      expect(pageTitle()).toBe('General');
      expect(query('.shared').textContent).toBe('Shared');
      expect(query('.to-members').getAttribute('aria-current')).toBeNull();

      query('.to-members').click();
      s.flush();

      expect(settings.router.currentRoute()).toBe('/members');
      expect(settings.router.canGoBack()).toBe(true);
      expect(query('.members').textContent).toBe('Core team');
      expect(pageTitle()).toBe('Members');

      query('.back').click();
      s.flush();
      expect(settings.router.currentRoute()).toBe('/');
      expect(pageTitle()).toBe('General');

      closeSettings(s, ref);
    });

    it('closes the overlay from back-or-close when there is no history', () => {
      const s = scenario();
      const { ref } = openSettings(s, provideOverlayRouter({ routes: [...ROUTES], initialRoute: '/members' }));
      const results: unknown[] = [];

      ref.afterClosedEvent().subscribe((event) => results.push(event.source));
      expect(query('.to-general').getAttribute('aria-current')).toBeNull();

      query('.back').click();
      s.flush();

      expect(results).toEqual(['api']);
      expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
    });

    it('lets a navigation guard veto a route change and reports pending navigations', async () => {
      const s = scenario();
      const { ref, settings } = openSettings(s, [
        ...provideOverlayRouterConfig({ routes: [...ROUTES] }),
        ...provideOverlayRouterService(),
      ]);
      const asked: string[] = [];
      let allow = false;

      const unregister = settings.router.registerNavigationGuard(({ from, to }) => {
        asked.push(`${from}->${to}`);

        return Promise.resolve(allow);
      });

      settings.router.navigate('/members');
      expect(settings.router.navigationPending()).toBe(true);
      await s.settle();
      expect(settings.router.currentRoute()).toBe('/');
      expect(asked).toEqual(['/->/members']);

      allow = true;
      settings.router.navigate('/members');
      await s.settle();
      expect(settings.router.currentRoute()).toBe('/members');
      expect(settings.router.navigationPending()).toBe(false);

      unregister();
      settings.router.navigate('/');
      s.flush();
      expect(settings.router.currentRoute()).toBe('/');
      expect(asked).toHaveLength(2);

      closeSettings(s, ref);
    });

    it('shows the disabled template while the outlet is disabled', () => {
      const s = scenario();
      const { ref, settings } = openSettings(s, provideOverlayRouter({ routes: [...ROUTES] }));

      expect(document.querySelector('.locked')).toBeNull();

      settings.locked.set(true);
      s.flush();
      expect(query('.locked').textContent).toBe('Locked');
      expect(document.querySelector('.to-members')).toBeNull();

      settings.locked.set(false);
      s.flush();
      expect(document.querySelector('.locked')).toBeNull();
      expect(query('.to-members')).toBeTruthy();

      closeSettings(s, ref);
    });

    it('collapses the sidebar into a route of its own when the pane is narrow', () => {
      const s = scenario();
      const { ref, settings } = openSettings(
        s,
        [
          ...provideOverlayRouter({ routes: [...ROUTES] }),
          ...provideSidebarOverlayConfig({ sidebarPageRoute: '/menu', renderSidebarFrom: 'md' }),
          ...provideSidebarOverlayService(),
        ],
        SidebarSettingsOverlayComponent,
      );

      expect(settings.sidebar).toBe(settings.sidebarByToken);
      expect(settings.sidebarConfig.sidebarPageRoute).toBe('/menu');
      expect(settings.sidebar.renderSidebar()).toBe(false);
      expect(settings.router.routes().map((route) => route.path)).toContain('/menu');

      settings.router.navigate('/menu');
      s.flush();

      expect(query('et-overlay-sidebar-page')).toBeTruthy();
      expect(query('.sidebar-nav').textContent).toBe('nav');
      expect(settings.router.routes().find((route) => route.path === '/menu')?.component).toBe(
        OverlaySidebarPageComponent,
      );

      closeSettings(s, ref);
    });

    it('renders the sidebar page with the sidebar header when provided in one call', () => {
      const s = scenario();
      const { ref, settings } = openSettings(
        s,
        [...provideOverlayRouter({ routes: [...ROUTES] }), ...provideSidebarOverlay()],
        SidebarSettingsOverlayComponent,
      );

      expect(settings.sidebarConfig).toEqual({});
      settings.router.navigate('/sidebar');
      s.flush();
      expect(query('et-overlay-sidebar-page').textContent).toContain('Settings');

      closeSettings(s, ref);
    });

    it('lets content inside each routing piece inject it', () => {
      const s = scenario();

      TokenProbeComponent.created = [];

      const { ref, settings } = openSettings(s, provideOverlayRouter({ routes: [...ROUTES] }));

      expect(probe('header').headerTemplate).toBeInstanceOf(OverlayHeaderTemplateDirective);
      expect(probe('shared').sharedTemplate).toBeInstanceOf(OverlaySharedRouteTemplateDirective);
      expect(probe('page').outlet).toBeInstanceOf(OverlayRouterOutletComponent);
      expect(probe('link').link).toBeInstanceOf(OverlayRouterLinkDirective);

      settings.router.navigate('/members');
      s.flush();
      expect(probe('back').backOrClose).toBeInstanceOf(OverlayBackOrCloseDirective);

      settings.locked.set(true);
      s.flush();
      expect(probe('disabled').disabledTemplate).toBeInstanceOf(OverlayRouterOutletDisabledTemplateDirective);

      closeSettings(s, ref);
    });
  });

  describe('driven by a query param', () => {
    const scenario = useScenario({
      providers: [provideOverlay(), provideRouter([{ path: '**', children: [] }]), provideLocationMocks()],
    });

    it('opens from a link, mirrors the param into the model and clears it on close', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ShopPageComponent);
      const router = TestBed.inject(Router);

      await s.settle();

      expect(OVERLAY_QUERY_PARAM_INPUT_NAME).toBe('overlayQueryParam');
      expect(query('.product-link', fixture.nativeElement).getAttribute('href')).toBe('/?product=42');

      query('.product-link', fixture.nativeElement).click();
      await s.settle();

      expect(router.url).toBe('/?product=42');
      expect(query('.product').textContent).toBe('42');

      fixture.componentInstance.product.open('7');
      await s.settle();
      expect(query('.product').textContent).toBe('7');

      s.keydown('Escape');
      await s.settle();

      expect(router.url).toBe('/');
      expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
    });
  });
});
