import { provideLocationMocks } from '@angular/common/testing';
import { Component, effect, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import {
  ET_PROPERTY_REMOVED,
  injectFragment,
  injectIsRouterInitialized,
  injectPathParam,
  injectPathParamChanges,
  injectPathParams,
  injectQueryParam,
  injectQueryParamChanges,
  injectQueryParams,
  injectRoute,
  injectRouteData,
  injectRouteDataItem,
  injectRouterEvent,
  injectRouterNavigationState,
  injectRouterState,
  injectRouteTitle,
  injectUrl,
} from '../index';
import { Scenario, useScenario } from './harness';

type NavState = { fromList: boolean };

const log: {
  pages: MatchPageComponent[];
  matchIds: (number | null)[];
  pathChanges: Record<string, unknown>[];
  queryChanges: Record<string, unknown>[];
} = { pages: [], matchIds: [], pathChanges: [], queryChanges: [] };

@Component({ selector: 'et-scenario-shell', imports: [RouterOutlet], template: '<router-outlet />' })
class ShellComponent {
  initialized = injectIsRouterInitialized();
}

@Component({ selector: 'et-scenario-match-page', template: '' })
class MatchPageComponent {
  lang = injectPathParam('lang');
  matchId = injectPathParam('matchId', { transform: (value) => (value === null ? null : Number(value)) });
  page = injectQueryParam('page', { transform: (value) => Number(value ?? 1) });
  pathParams = injectPathParams();
  queryParams = injectQueryParams();
  route = injectRoute();
  url = injectUrl();
  fragment = injectFragment();
  data = injectRouteData();
  section = injectRouteDataItem<string>('section');
  title = injectRouteTitle();
  state = injectRouterState();
  event = injectRouterEvent();
  navState = injectRouterNavigationState<NavState>();

  routeInConstructor = this.route();
  langInConstructor = this.lang();

  constructor() {
    log.pages.push(this);

    const pathChanges = injectPathParamChanges();
    const queryChanges = injectQueryParamChanges();

    effect(() => log.matchIds.push(this.matchId()));
    effect(() => log.pathChanges.push(pathChanges()));
    effect(() => log.queryChanges.push(queryChanges()));
  }
}

const navigate = async (s: Scenario, url: string, state?: NavState) => {
  const router = s.run(() => inject(Router));
  const navigation = router.navigateByUrl(url, { state });

  await s.settle();
  await navigation;
  s.tick();
};

const mountShell = (s: Scenario) => {
  const shell = TestBed.createComponent(ShellComponent);

  s.tick();

  return shell;
};

const unmount = (shell: ComponentFixture<ShellComponent>) => {
  shell.destroy();
  document.head.querySelector('title')?.remove();
};

const page = () => {
  const current = log.pages.at(-1);

  if (!current) throw new Error('match page not mounted');

  return current;
};

describe('router state scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideRouter([
        {
          path: ':lang/matches/:matchId',
          component: MatchPageComponent,
          data: { section: 'matches' },
          title: 'Match',
        },
        { path: ':lang/table', children: [], data: { section: 'table' } },
      ]),
      provideLocationMocks(),
    ],
  });

  beforeEach(() => {
    log.pages = [];
    log.matchIds = [];
    log.pathChanges = [];
    log.queryChanges = [];
  });

  it('reads the committed route in the constructor of a component the navigation activates', async () => {
    const s = scenario();
    const shell = mountShell(s);

    expect(shell.componentInstance.initialized()).toBe(false);

    await navigate(s, '/en/matches/1?page=2#lineup', { fromList: true });

    const p = page();

    expect(shell.componentInstance.initialized()).toBe(true);
    expect(p.routeInConstructor).toBe('/en/matches/1');
    expect(p.langInConstructor).toBe('en');
    expect(p.navState).toEqual({ fromList: true });
    expect(p.url()).toBe('/en/matches/1?page=2#lineup');
    expect(p.route()).toBe('/en/matches/1');
    expect(p.fragment()).toBe('lineup');
    expect(p.page()).toBe(2);
    expect(p.pathParams()).toEqual({ lang: 'en', matchId: '1' });
    expect(p.queryParams()).toEqual({ page: '2' });
    expect(p.data()).toMatchObject({ section: 'matches' });
    expect(p.section()).toBe('matches');
    expect(p.title()).toBe('Match');
    expect(p.state().pathParams).toEqual({ lang: 'en', matchId: '1' });
    expect(document.title).toBe('Match');

    unmount(shell);
  });

  it('updates the params of a reused component on every param change, once each', async () => {
    const s = scenario();
    const shell = mountShell(s);

    await navigate(s, '/en/matches/1');
    await navigate(s, '/en/matches/2');
    await navigate(s, '/en/matches/3?page=4');
    await navigate(s, '/de/matches/3?page=4');

    expect(log.pages).toHaveLength(1);
    expect(log.matchIds).toEqual([1, 2, 3]);

    const p = page();

    expect(p.lang()).toBe('de');
    expect(p.page()).toBe(4);
    expect(p.route()).toBe('/de/matches/3');
    expect(p.navState).toBeNull();

    unmount(shell);
  });

  it('reports only the params that changed, and removed ones as ET_PROPERTY_REMOVED', async () => {
    const s = scenario();
    const shell = mountShell(s);

    await navigate(s, '/en/matches/1?page=2&sort=date');
    await navigate(s, '/en/matches/2?page=2');
    await navigate(s, '/en/matches/2?page=3');

    expect(log.pathChanges.at(-2)).toEqual({ matchId: '2' });
    expect(log.queryChanges.at(-2)).toEqual({ sort: ET_PROPERTY_REMOVED });
    expect(log.queryChanges.at(-1)).toEqual({ page: '3' });

    unmount(shell);
  });

  it('keeps a signal read outside the routed component in step with navigations', async () => {
    const s = scenario();
    const shell = mountShell(s);
    const c = s.consumer();
    const section = c.run(() => injectRouteDataItem<string>('section'));
    const route = c.run(() => injectRoute());

    await navigate(s, '/en/matches/1');

    expect(section()).toBe('matches');

    await navigate(s, '/en/table');

    expect(section()).toBe('table');
    expect(route()).toBe('/en/table');

    await navigate(s, '/en/matches/5');

    expect(section()).toBe('matches');
    expect(log.pages).toHaveLength(2);

    c.destroy();
    unmount(shell);
  });
});
