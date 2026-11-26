import { Component, inject, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  dialogOverlayStrategy,
  injectOverlayManager,
  injectOverlayRouter,
  mountNavTabLinkStyles,
  NAV_TAB_IMPORTS,
  NAV_TABS_TOKEN,
  NavTabLinkComponent,
  NavTabLinkDirective,
  NavTabLinkStylesComponent,
  NavTabsComponent,
  NavTabsDirective,
  NavTabsOutletComponent,
  NavTabsOutletDirective,
  OVERLAY_NAV_TAB_IMPORTS,
  OverlayNavTabLinkComponent,
  OverlayRouterOutletComponent,
  provideOverlay,
  provideOverlayRouter,
  TAB_ERROR_CODES,
  TabBarDirective,
  TabBarTriggerDirective,
} from '../index';
import { fakeElementScroll } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({ selector: 'et-scenario-page', template: '<p class="page">{{ name }}</p>' })
class PageComponent {
  name = inject(Router).url;
}

let allowReports = true;

const ROUTES = [
  { path: '', pathMatch: 'full' as const, redirectTo: 'overview' },
  { path: 'overview', component: PageComponent },
  { path: 'members', component: PageComponent },
  { path: 'reports', component: PageComponent, canActivate: [() => allowReports] },
  { path: 'settings', component: PageComponent },
];

@Component({
  selector: 'et-scenario-team-nav',
  imports: [NAV_TAB_IMPORTS, RouterOutlet],
  template: `
    <et-nav-tabs>
      <a et-nav-tab-link="/overview">Overview</a>
      <a [queryParams]="{ sort: 'name' }" et-nav-tab-link="/members">Members</a>
      <a et-nav-tab-link="/reports">Reports</a>
      <a [disabled]="settingsLocked()" et-nav-tab-link="/settings">Settings</a>
    </et-nav-tabs>
    <et-nav-tabs-outlet>
      <router-outlet />
    </et-nav-tabs-outlet>
  `,
})
class TeamNavComponent {
  settingsLocked = signal(true);
  tabs = viewChild.required(NavTabsComponent);
  links = viewChild.required(NavTabLinkComponent);
  outlet = viewChild.required(NavTabsOutletComponent);
}

@Component({
  selector: 'et-scenario-pill-link',
  hostDirectives: [TabBarTriggerDirective, NavTabLinkDirective],
  template: '<ng-content />',
  host: { class: 'pill-link et-nav-tab-link' },
})
class PillLinkComponent {
  navTabs = inject(NAV_TABS_TOKEN);
  link = inject(NavTabLinkDirective);
  styles = mountNavTabLinkStyles();
}

@Component({
  selector: 'et-scenario-headless-nav',
  imports: [
    NavTabsDirective,
    NavTabsOutletDirective,
    TabBarDirective,
    TabBarTriggerDirective,
    NavTabLinkDirective,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    PillLinkComponent,
  ],
  template: `
    <nav class="pills" etNavTabs etTabBar>
      <a class="pill" etNavTabLink etTabBarTrigger routerLink="/overview" routerLinkActive="is-active">Overview</a>
      <a class="pill" etNavTabLink etTabBarTrigger routerLink="/members" routerLinkActive="is-active">Members</a>
      <a class="pill" etNavTabLink etTabBarTrigger routerLink="/reports" routerLinkActive="is-active">Reports</a>
    </nav>
    <main class="content" etNavTabsOutlet><router-outlet /></main>
  `,
})
class HeadlessNavComponent {
  links = viewChild.required(NavTabLinkDirective);
  bar = viewChild.required(TabBarDirective);
  navTabs = viewChild.required(NavTabsDirective);
  outlet = viewChild.required(NavTabsOutletDirective);
}

@Component({
  selector: 'et-scenario-pill-nav',
  imports: [NavTabsComponent, PillLinkComponent, RouterLinkActive],
  template: `
    <et-nav-tabs>
      <et-scenario-pill-link routerLinkActive="on">Pill</et-scenario-pill-link>
    </et-nav-tabs>
  `,
})
class PillNavComponent {
  pill = viewChild.required(PillLinkComponent);
}

@Component({
  selector: 'et-scenario-stray-nav-link',
  imports: [TabBarDirective, TabBarTriggerDirective, NavTabLinkDirective],
  template: '<div etTabBar><button etNavTabLink etTabBarTrigger type="button">Lost</button></div>',
})
class StrayNavLinkComponent {}

@Component({
  selector: 'et-scenario-stray-outlet',
  imports: [NavTabsOutletComponent],
  template: '<et-nav-tabs-outlet>Lost</et-nav-tabs-outlet>',
})
class StrayOutletComponent {}

@Component({ selector: 'et-scenario-email-page', template: '<p class="overlay-page">Email</p>' })
class EmailPageComponent {}

@Component({ selector: 'et-scenario-privacy-page', template: '<p class="overlay-page">Privacy</p>' })
class PrivacyPageComponent {}

@Component({
  selector: 'et-scenario-preferences-overlay',
  imports: [OVERLAY_NAV_TAB_IMPORTS, OverlayRouterOutletComponent],
  template: `
    <et-nav-tabs orientation="vertical">
      <button et-overlay-nav-tab-link="/email" type="button">Email</button>
      <button et-overlay-nav-tab-link="/privacy" type="button">Privacy</button>
    </et-nav-tabs>
    <et-overlay-router-outlet />
  `,
})
class PreferencesOverlayComponent {
  router = injectOverlayRouter();
  links = viewChildren(OverlayNavTabLinkComponent);
}

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const tab = (label: string, root: ParentNode = document) => {
  const found = queryAll('[role="tab"]', root).find((element) => element.textContent?.trim() === label);

  if (!found) throw new Error(`no tab ${label}`);

  return found;
};

const selectedLabels = (root: ParentNode = document) =>
  queryAll('[role="tab"][aria-selected="true"]', root).map((element) => element.textContent?.trim());

const navigate = async (s: Scenario, url: string) => {
  await TestBed.inject(Router).navigateByUrl(url);
  await s.settle();
};

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('nav tabs scenarios', () => {
  beforeEach(() => {
    allowReports = true;
    fakeElementScroll();
  });

  describe('with the Angular router', () => {
    const scenario = useScenario({ providers: [provideRouter(ROUTES), provideLocationMocks()] });

    it('selects the tab of the current route and navigates by click', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;
      const router = TestBed.inject(Router);

      await navigate(s, '/members?sort=name');

      expect(query('et-nav-tabs', host).getAttribute('role')).toBe('tablist');
      expect(tab('Members', host).getAttribute('href')).toBe('/members?sort=name');
      expect(selectedLabels(host)).toEqual(['Members']);
      expect(tab('Members', host).classList.contains('et-nav-tab-link--active')).toBe(true);
      expect(query('.page', host).textContent).toBe('/members?sort=name');

      const outlet = query('et-nav-tabs-outlet', host);

      expect(outlet.getAttribute('role')).toBe('tabpanel');
      expect(outlet.getAttribute('aria-labelledby')).toBe(tab('Members', host).id);

      tab('Reports', host).click();
      await s.settle();

      expect(router.url).toBe('/reports');
      expect(selectedLabels(host)).toEqual(['Reports']);
      expect(outlet.getAttribute('aria-labelledby')).toBe(tab('Reports', host).id);
      expect(query('.page', host).textContent).toBe('/reports');
      expect(fixture.componentInstance.tabs()).toBeInstanceOf(NavTabsComponent);
      expect(fixture.componentInstance.outlet()).toBeInstanceOf(NavTabsOutletComponent);
    });

    it('leaves the selection alone when a guard vetoes the navigation', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;

      await navigate(s, '/overview');
      allowReports = false;

      tab('Reports', host).click();
      await s.settle();

      expect(TestBed.inject(Router).url).toBe('/overview');
      expect(selectedLabels(host)).toEqual(['Overview']);
    });

    it('follows a navigation that did not come from a tab', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;

      await navigate(s, '/overview');
      await navigate(s, '/reports');

      expect(selectedLabels(host)).toEqual(['Reports']);
    });

    it('keeps a link with query params active when the URL carries other query params', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;

      await navigate(s, '/members');
      expect(selectedLabels(host)).toEqual(['Members']);

      await navigate(s, '/members?sort=age&page=2');
      expect(selectedLabels(host)).toEqual(['Members']);
    });

    it('lets a consumer-supplied routerLinkActiveOptions win over the default', async () => {
      @Component({
        imports: [NAV_TAB_IMPORTS],
        template: `
          <et-nav-tabs>
            <a et-nav-tab-link="/overview">Overview</a>
            <a [queryParams]="{ sort: 'name' }" [routerLinkActiveOptions]="{ exact: true }" et-nav-tab-link="/members"
              >Members</a
            >
          </et-nav-tabs>
        `,
      })
      class ExactNavComponent {}

      const s = scenario();
      const fixture = TestBed.createComponent(ExactNavComponent);
      const host = fixture.nativeElement as HTMLElement;

      await navigate(s, '/members?sort=name');
      expect(tab('Members', host).classList.contains('et-nav-tab-link--active')).toBe(true);

      await navigate(s, '/members');
      expect(tab('Members', host).classList.contains('et-nav-tab-link--active')).toBe(false);
    });

    it('drops the href of a disabled link and keeps it out of the roving tab order', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;

      await navigate(s, '/overview');

      const settings = tab('Settings', host);

      expect(settings.hasAttribute('href')).toBe(false);
      expect(settings.getAttribute('aria-disabled')).toBe('true');
      expect(settings.classList.contains('et-nav-tab-link--disabled')).toBe(true);

      s.keydown(' ', settings);
      await s.settle();
      expect(TestBed.inject(Router).url).toBe('/overview');

      fixture.componentInstance.settingsLocked.set(false);
      await s.settle();
      expect(settings.getAttribute('href')).toBe('/settings');
    });

    it('moves focus with the arrow keys and navigates on Space and Enter', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(TeamNavComponent);
      const host = fixture.nativeElement as HTMLElement;
      const router = TestBed.inject(Router);

      await navigate(s, '/overview');

      tab('Overview', host).focus();
      s.keydown('ArrowRight');
      expect(document.activeElement).toBe(tab('Members', host));

      const space = s.keydown(' ');

      await s.settle();
      expect(space.defaultPrevented).toBe(true);
      expect(router.url).toBe('/members?sort=name');
      expect(selectedLabels(host)).toEqual(['Members']);

      s.keydown('End');
      expect(document.activeElement).toBe(tab('Reports', host));
      s.keydown('Enter');
      await s.settle();
      expect(router.url).toBe('/reports');
      expect(selectedLabels(host)).toEqual(['Reports']);
    });

    it('builds nav tabs from the headless directives with a sibling outlet', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(HeadlessNavComponent);
      const host = fixture.nativeElement as HTMLElement;
      const app = fixture.componentInstance;

      await navigate(s, '/reports');

      expect(query('.pills', host).getAttribute('role')).toBe('tablist');
      expect(selectedLabels(host)).toEqual(['Reports']);
      expect(tab('Reports', host).classList.contains('is-active')).toBe(true);
      expect(app.bar().activeTrigger()?.getElement()).toBe(tab('Reports', host));
      expect(app.links().isActive()).toBe(false);
      expect(app.navTabs()).toBeInstanceOf(NavTabsDirective);

      const content = query('.content', host);

      expect(content.getAttribute('role')).toBe('tabpanel');
      expect(content.id).toBe(app.outlet().ID);
      expect(content.getAttribute('aria-labelledby')).toBe(tab('Reports', host).id);

      tab('Overview', host).click();
      await s.settle();
      expect(selectedLabels(host)).toEqual(['Overview']);
      expect(app.links().isActive()).toBe(true);
      expect(content.getAttribute('aria-labelledby')).toBe(tab('Overview', host).id);
    });

    it('lets a custom link reach its nav tabs and share the nav link styles', async () => {
      const s = scenario();
      const fixture = TestBed.createComponent(PillNavComponent);

      await navigate(s, '/overview');

      const pill = fixture.componentInstance.pill();
      const shared = s.run(() => mountNavTabLinkStyles());

      expect(pill.navTabs).toBeInstanceOf(NavTabsDirective);
      expect(pill.styles.instance).toBeInstanceOf(NavTabLinkStylesComponent);
      expect(shared).toBe(pill.styles);
      expect(queryAll('.et-style-manager et-nav-tab-link-styles')).toHaveLength(1);
      expect(query('et-scenario-pill-link').getAttribute('role')).toBe('tab');
    });

    it.each([
      ['a nav tab link outside nav tabs', StrayNavLinkComponent],
      ['a nav tabs outlet without nav tabs', StrayOutletComponent],
    ])('reports a runtime error for %s', async (_label, component) => {
      const s = scenario();

      TestBed.createComponent(component);
      await s.settle();

      takeRuntimeError(s, TAB_ERROR_CODES.MISSING_NAV_TABS);
    });
  });

  describe('inside an overlay', () => {
    const scenario = useScenario({ providers: [provideOverlay()] });

    it('switches overlay routes from overlay nav tab links', async () => {
      const s = scenario();
      const ref = s.run(() =>
        injectOverlayManager().open(PreferencesOverlayComponent, {
          strategies: dialogOverlayStrategy(),
          autoFocus: false,
          providers: [
            ...provideOverlayRouter({
              routes: [
                { path: '/email', component: EmailPageComponent },
                { path: '/privacy', component: PrivacyPageComponent },
              ],
              initialRoute: '/email',
            }),
          ],
        }),
      );

      s.flush();

      const overlay = ref.componentInstance();

      expect(query('.overlay-page').textContent).toBe('Email');
      expect(selectedLabels()).toEqual(['Email']);
      expect(tab('Email').getAttribute('aria-current')).toBe('page');
      expect(query('et-nav-tabs').getAttribute('aria-orientation')).toBe('vertical');

      tab('Privacy').click();
      await s.settle();

      expect(overlay?.router.currentRoute()).toBe('/privacy');
      expect(overlay?.links()).toHaveLength(2);
      expect(query('.overlay-page').textContent).toBe('Privacy');
      expect(selectedLabels()).toEqual(['Privacy']);
      expect(tab('Privacy').classList.contains('et-nav-tab-link--active')).toBe(true);

      tab('Email').focus();
      s.keydown(' ');
      await s.settle();
      expect(overlay?.router.currentRoute()).toBe('/email');
      expect(selectedLabels()).toEqual(['Email']);

      ref.close();
      s.flush();
      expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
    });
  });
});
