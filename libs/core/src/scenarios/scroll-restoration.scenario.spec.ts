import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { inject } from '@angular/core';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom, Subject, take } from 'rxjs';
import { registerScrollRestorationState, routerRestoreScroll, setupScrollRestoration } from '../index';
import { Scenario, useScenario } from './harness';

const createScroller = () => {
  const el = document.createElement('div');
  const geometry = { top: 0, height: 0 };

  Object.defineProperties(el, {
    scrollTop: { get: () => geometry.top, set: (value: number) => (geometry.top = value) },
    scrollHeight: { get: () => geometry.height },
    clientHeight: { get: () => 100 },
  });

  return { el, geometry };
};

const navigate = async (s: Scenario, url: string, state?: Record<symbol, unknown>) => {
  const router = s.run(() => inject(Router));
  const navigation = router.navigateByUrl(url, { state });

  await s.settle();
  await navigation;
};

describe('scroll restoration scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideRouter([
        { path: 'list', children: [] },
        { path: 'detail', children: [] },
      ]),
      provideLocationMocks(),
    ],
  });

  const leaveListAt = async (s: Scenario, scroller: ReturnType<typeof createScroller>, top: number) => {
    await navigate(s, '/list');
    scroller.geometry.height = 2000;
    scroller.el.scrollTop = top;
    await navigate(s, '/detail');
    scroller.geometry.height = 0;
  };

  it('restores a marked return once the content is tall enough', async () => {
    const s = scenario();
    const scroller = createScroller();
    const c = s.consumer();

    c.run(() => setupScrollRestoration({ scrollElement: scroller.el, restore: { enabled: true } }));
    await leaveListAt(s, scroller, 600);

    expect(scroller.el.scrollTop).toBe(0);

    const router = s.run(() => inject(Router));
    const navigation = router.navigateByUrl('/list', { state: routerRestoreScroll() });

    s.tick();
    await navigation;
    s.frame(3);

    expect(scroller.el.scrollTop).toBe(0);

    scroller.geometry.height = 1000;
    s.frame();

    expect(scroller.el.scrollTop).toBe(600);

    c.destroy();
  });

  it('abandons a pending restoration and hands history.scrollRestoration back when destroyed', async () => {
    const s = scenario();
    const scroller = createScroller();
    const c = s.consumer();

    history.scrollRestoration = 'auto';
    c.run(() => setupScrollRestoration({ scrollElement: scroller.el, restore: { enabled: true } }));

    expect(history.scrollRestoration).toBe('manual');

    await leaveListAt(s, scroller, 600);

    const router = s.run(() => inject(Router));
    const navigation = router.navigateByUrl('/list', { state: routerRestoreScroll() });

    s.tick();
    await navigation;
    s.frame(2);

    expect(s.pendingFrames()).toBeGreaterThan(0);

    c.destroy();

    expect(s.pendingFrames()).toBe(0);
    expect(history.scrollRestoration).toBe('auto');

    scroller.geometry.height = 1000;
    s.flush();

    expect(scroller.el.scrollTop).toBe(0);
  });
});

describe('scroll restoration state scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideRouter([
        { path: 'list', children: [] },
        { path: 'detail', children: [] },
      ]),
      provideLocationMocks(),
    ],
  });

  it('restores the loaded page count on back navigation before it applies the offset', async () => {
    const s = scenario();
    const scroller = createScroller();
    const c = s.consumer();
    const pagesLoaded = new Subject<void>();
    let pages = 1;
    let restoredWith: number | undefined;

    scroller.geometry.height = 4000;
    s.run(() => inject(Router)).setUpLocationChangeListener();

    c.run(() => {
      setupScrollRestoration({ scrollElement: scroller.el, restore: { enabled: true } });
      registerScrollRestorationState({
        key: 'pages',
        save: () => pages,
        restore: (count) => {
          restoredWith = count;

          return pagesLoaded.pipe(take(1));
        },
      });
    });

    await navigate(s, '/list');
    pages = 3;
    scroller.el.scrollTop = 2500;
    await navigate(s, '/detail');
    pages = 1;
    scroller.el.scrollTop = 0;

    const router = s.run(() => inject(Router));
    const navigated = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd)));

    s.run(() => inject(Location)).back();
    s.tick();
    await navigated;
    s.frame(3);
    s.tick(500);

    expect(restoredWith).toBe(3);
    expect(scroller.el.scrollTop).toBe(0);

    pagesLoaded.next();
    s.flush();

    expect(scroller.el.scrollTop).toBe(2500);

    c.destroy();
  });

  it('restores offset and state after a reload of the same url', async () => {
    const s = scenario();
    const scroller = createScroller();
    const routes = [{ path: 'list', children: [] }];
    let pages = 4;
    let restoredWith: number | undefined;

    sessionStorage.clear();
    scroller.geometry.height = 4000;

    const boot = async () => {
      const app = await s.app([provideRouter(routes), provideLocationMocks()]);

      app.run(() => {
        setupScrollRestoration({ scrollElement: scroller.el, restore: { enabled: true, restoreOnReload: true } });
        registerScrollRestorationState({
          key: 'pages',
          save: () => pages,
          restore: (count: number) => {
            restoredWith = count;
          },
        });
      });

      const navigation = app.run(() => inject(Router)).navigateByUrl('/list');

      await s.settle();
      await navigation;

      return app;
    };

    const before = await boot();

    scroller.el.scrollTop = 1800;
    window.dispatchEvent(new Event('pagehide'));
    before.destroy();

    pages = 1;
    scroller.el.scrollTop = 0;

    const after = await boot();

    s.flush();

    expect(restoredWith).toBe(4);
    expect(scroller.el.scrollTop).toBe(1800);
    expect(sessionStorage.getItem('et-scroll-restoration')).toBeNull();

    after.destroy();
  });
});
