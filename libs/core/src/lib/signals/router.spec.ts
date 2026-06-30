import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

/**
 * Each test re-imports the router signals on a fresh module graph. The signals
 * are wrapped in `memoizeSignal`, whose cache lives at module scope and binds to
 * the injector of the first test that reads it. Since the testbed is destroyed
 * after every test, that cache would otherwise leak a signal bound to a dead
 * injector into the next test.
 */
const loadRouterSignals = async () => {
  vi.resetModules();
  return import('./router');
};

const configure = (routes: Routes) => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
};

describe('injectRoute', () => {
  it('returns the route being navigated to inside a constructor, not the previous route', async () => {
    const { injectRoute } = await loadRouterSignals();

    @Component({ template: '' })
    class Home {}

    @Component({ template: '' })
    class Dashboard {
      // Read synchronously in the constructor (field initializer).
      readonly routeAtConstruction = injectRoute()();
    }

    configure([
      { path: '', component: Home },
      { path: 'dashboard', component: Dashboard },
    ]);

    const harness = await RouterTestingHarness.create();

    // Create + cache the memoized signal while we are still on "/" so it already
    // holds the previous route, mirroring the real-world timing problem.
    const injector = TestBed.inject(Injector);
    const route = runInInjectionContext(injector, () => injectRoute());
    expect(route()).toBe('/');

    const cmp = await harness.navigateByUrl('/dashboard', Dashboard);

    // The constructor must observe the new route, not the stale "/".
    expect(cmp.routeAtConstruction).toBe('/dashboard');
    // ...and the previously created signal must have updated too.
    expect(route()).toBe('/dashboard');
  });

  it('strips query params and the fragment', async () => {
    const { injectRoute } = await loadRouterSignals();

    @Component({ template: '' })
    class Page {
      readonly route = injectRoute()();
    }

    configure([{ path: 'page', component: Page }]);

    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/page?foo=1&bar=2#section', Page);

    expect(cmp.route).toBe('/page');
  });

  it('stays reactive across repeated navigation', async () => {
    const { injectRoute } = await loadRouterSignals();

    @Component({ template: '' })
    class Page {}

    configure([
      { path: 'a', component: Page },
      { path: 'b', component: Page },
    ]);

    const harness = await RouterTestingHarness.create();
    const route = runInInjectionContext(TestBed.inject(Injector), () => injectRoute());

    await harness.navigateByUrl('/a', Page);
    expect(route()).toBe('/a');

    await harness.navigateByUrl('/b', Page);
    expect(route()).toBe('/b');
  });
});

describe('injectUrl', () => {
  it('includes query params and the fragment at construction time during navigation', async () => {
    const { injectUrl } = await loadRouterSignals();

    @Component({ template: '' })
    class Page {
      readonly url = injectUrl()();
    }

    configure([{ path: 'page', component: Page }]);

    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/page?foo=1#section', Page);

    expect(cmp.url).toBe('/page?foo=1#section');
  });
});

describe('injectPathParam', () => {
  it('resolves the path param inside the constructor during navigation', async () => {
    const { injectPathParam } = await loadRouterSignals();

    @Component({ template: '' })
    class Detail {
      readonly id = injectPathParam('id')();
    }

    configure([{ path: 'detail/:id', component: Detail }]);

    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/detail/42', Detail);

    expect(cmp.id).toBe('42');
  });
});

describe('injectQueryParam', () => {
  it('resolves the query param inside the constructor during navigation', async () => {
    const { injectQueryParam } = await loadRouterSignals();

    @Component({ template: '' })
    class Page {
      readonly q = injectQueryParam('q')();
    }

    configure([{ path: 'page', component: Page }]);

    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/page?q=hello', Page);

    expect(cmp.q).toBe('hello');
  });
});

describe('injectRouteDataItem', () => {
  it('resolves route data inside the constructor during navigation', async () => {
    const { injectRouteDataItem } = await loadRouterSignals();

    @Component({ template: '' })
    class Page {
      readonly flag = injectRouteDataItem<boolean>('flag')();
    }

    configure([{ path: 'page', component: Page, data: { flag: true } }]);

    const harness = await RouterTestingHarness.create();
    const cmp = await harness.navigateByUrl('/page', Page);

    expect(cmp.flag).toBe(true);
  });
});
