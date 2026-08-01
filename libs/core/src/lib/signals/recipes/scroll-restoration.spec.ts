import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, NavigationSkipped, Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  SetupScrollRestorationConfig,
  holdScrollRestoration,
  routerDisableScrollTop,
  setupScrollRestoration,
} from './scroll-restoration';

@Component({ selector: 'et-list-page', template: 'list' })
class ListPage {}

@Component({ selector: 'et-detail-page', template: 'detail' })
class DetailPage {}

/**
 * jsdom has no layout, so `scrollHeight` / `clientHeight` are always 0 and `scrollTop` never
 * sticks. Back the geometry the restoration logic reads with a plain object - it only ever touches
 * these three properties.
 */
const createScrollElement = (clientHeight = 500) => {
  const el = { scrollTop: 0, scrollHeight: 0, clientHeight };

  return {
    el: el as unknown as HTMLElement,
    /** Grow the content so that `contentHeight - clientHeight` becomes the reachable maximum. */
    setContentHeight: (height: number) => (el.scrollHeight = height),
    get scrollTop() {
      return el.scrollTop;
    },
    set scrollTop(value: number) {
      el.scrollTop = value;
    },
  };
};

const ROUTES: Routes = [
  { path: 'list', component: ListPage },
  { path: 'detail', component: DetailPage },
];

const setup = async (config: SetupScrollRestorationConfig, routes: Routes = ROUTES) => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideLocationMocks()] });

  const harness = await RouterTestingHarness.create();

  // The harness navigates imperatively and never calls `initialNavigation()`, so the router does not
  // listen to the mocked location - without this, `Location.back()` would not produce a popstate.
  TestBed.inject(Router).setUpLocationChangeListener();

  runInInjectionContext(TestBed.inject(Injector), () => setupScrollRestoration(config));

  return harness;
};

/** Lets queued macrotasks + animation frames run. Restoration needs a few of both. */
const settle = async (ms = 60) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

/** Drives the mocked history backwards and resolves once the resulting navigation finished. */
const goBack = async () => {
  const router = TestBed.inject(Router);

  const navigated = new Promise<void>((resolve) => {
    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationEnd || event instanceof NavigationSkipped || event instanceof NavigationCancel) {
        subscription.unsubscribe();
        resolve();
      }
    });
  });

  TestBed.inject(Location).back();

  await navigated;
};

describe('setupScrollRestoration - restore on history navigation', () => {
  it('restores the saved offset once the content is tall enough to reach it', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 500 } });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    // The detail page is short, and the list's content is gone.
    scroller.setContentHeight(600);
    expect(scroller.scrollTop).toBe(0);

    await goBack();

    // Still on the loading frame: the list is empty again, so the offset is unreachable.
    scroller.setContentHeight(600);
    await settle(30);
    expect(scroller.scrollTop).toBe(0);

    // Data arrives, the list renders its real height.
    scroller.setContentHeight(4000);
    await settle();

    expect(scroller.scrollTop).toBe(1200);
  });

  it('clamps to the reachable maximum when the content never gets tall enough', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 50 } });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.scrollTop = 0;

    await goBack();

    // The list came back with fewer rows: max offset is 900 - 500 = 400.
    scroller.setContentHeight(900);
    await settle(200);

    expect(scroller.scrollTop).toBe(400);
  });

  it('leaves the offset alone on timeout when clampOnTimeout is false', async () => {
    const scroller = createScrollElement();
    const harness = await setup({
      scrollElement: () => scroller.el,
      restore: { enabled: true, timeout: 50, clampOnTimeout: false },
    });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.scrollTop = 0;

    await goBack();
    scroller.setContentHeight(900);
    await settle(200);

    expect(scroller.scrollTop).toBe(0);
  });

  it('keeps waiting past the timeout while a hold reports pending', async () => {
    const scroller = createScrollElement();
    const isLoading = signal(true);

    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 40 } });

    runInInjectionContext(TestBed.inject(Injector), () => holdScrollRestoration(() => isLoading()));

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.scrollTop = 0;

    await goBack();
    scroller.setContentHeight(600);

    // Well past `timeout` - without the hold this would have clamped to 100 by now.
    await settle(200);
    expect(scroller.scrollTop).toBe(0);

    isLoading.set(false);
    scroller.setContentHeight(4000);
    await settle();

    expect(scroller.scrollTop).toBe(1200);
  });

  it('abandons a pending restoration when the user scrolls', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 500 } });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.scrollTop = 0;

    await goBack();
    scroller.setContentHeight(600);
    await settle(30);

    document.dispatchEvent(new Event('wheel'));

    scroller.setContentHeight(4000);
    await settle();

    expect(scroller.scrollTop).toBe(0);
  });

  it('drops a pending restoration when a new navigation supersedes it', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true, timeout: 500 } });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);
    scroller.scrollTop = 0;

    await goBack();
    // The list is still loading, so the restoration is queued rather than applied.
    scroller.setContentHeight(600);

    // The user navigates on before the list settled.
    await harness.navigateByUrl('/detail', DetailPage);
    scroller.setContentHeight(4000);
    await settle();

    // The list's offset must not be applied to the detail page.
    expect(scroller.scrollTop).toBe(0);
  });

  it('scrolls to top on a forward navigation, not to a saved offset', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, restore: { enabled: true } });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 1200;

    await harness.navigateByUrl('/detail', DetailPage);

    expect(scroller.scrollTop).toBe(0);
  });

  it('scrolls to top on history navigation while restore is disabled', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el });

    await harness.navigateByUrl('/list', ListPage);
    await harness.navigateByUrl('/detail', DetailPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 900;

    await goBack();
    await settle();

    expect(scroller.scrollTop).toBe(0);
  });
});

describe('setupScrollRestoration - existing behavior', () => {
  it('scrolls to top when a trigger query param changes on the same route', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, queryParamTriggerList: ['page'] });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 800;

    await harness.navigateByUrl('/list?page=2', ListPage);

    expect(scroller.scrollTop).toBe(0);
  });

  it('does not scroll to top when a non trigger query param changes', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el, queryParamTriggerList: ['page'] });

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 800;

    await harness.navigateByUrl('/list?sort=name', ListPage);

    expect(scroller.scrollTop).toBe(800);
  });

  it('honors routerDisableScrollTop on the target route', async () => {
    const scroller = createScrollElement();
    const harness = await setup({ scrollElement: () => scroller.el }, [
      { path: 'list', component: ListPage },
      { path: 'detail', component: DetailPage, data: routerDisableScrollTop() },
    ]);

    await harness.navigateByUrl('/list', ListPage);
    scroller.setContentHeight(4000);
    scroller.scrollTop = 800;

    await harness.navigateByUrl('/detail', DetailPage);

    expect(scroller.scrollTop).toBe(800);
  });
});
