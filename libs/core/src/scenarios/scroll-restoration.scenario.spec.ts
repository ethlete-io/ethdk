import { provideLocationMocks } from '@angular/common/testing';
import { inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { routerRestoreScroll, setupScrollRestoration } from '../index';
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
