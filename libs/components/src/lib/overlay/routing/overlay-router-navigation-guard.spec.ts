import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayRouter, injectOverlayRouter, provideOverlayRouter } from './overlay-router';

@Component({ template: 'page one' })
class PageOneComponent {}

@Component({ template: 'page two' })
class PageTwoComponent {}

@Component({ template: 'routed overlay' })
class RoutedOverlayComponent {
  router: OverlayRouter = injectOverlayRouter();
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** A guard chain resolves over several microtasks, so a fixed number of them would be a flaky wait. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('OverlayRouter navigation guards', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  let ref: OverlayRef<RoutedOverlayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  const open = async () => {
    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());

    ref = manager.open<RoutedOverlayComponent>(RoutedOverlayComponent, {
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: PageOneComponent },
            { path: '/two', component: PageTwoComponent },
          ],
        }),
      ],
    });

    await flushFrames();

    return (ref.componentInstance() as RoutedOverlayComponent).router;
  };

  afterEach(async () => {
    ref?.close();
    await flushFrames();
  });

  it('navigates synchronously while no guard is registered', async () => {
    const router = await open();

    router.navigate('/two');

    expect(router.currentPage()?.path).toBe('/two');
  });

  it('navigates synchronously while every registered guard answers synchronously', async () => {
    const router = await open();

    router.registerNavigationGuard(() => true);

    router.navigate('/two');

    expect(router.currentPage()?.path).toBe('/two');
  });

  it('cancels synchronously when a synchronous guard vetoes', async () => {
    const router = await open();

    router.registerNavigationGuard(() => false);

    router.navigate('/two');

    expect(router.currentPage()?.path).toBe('/');
  });

  it('goes async only from the first guard that returns a promise', async () => {
    const router = await open();
    const order: string[] = [];

    router.registerNavigationGuard(() => {
      order.push('sync');

      return true;
    });
    router.registerNavigationGuard(() => {
      order.push('async');

      return Promise.resolve(true);
    });
    router.registerNavigationGuard(() => {
      order.push('after');

      return true;
    });

    router.navigate('/two');

    expect(order).toEqual(['sync', 'async']);
    expect(router.currentPage()?.path).toBe('/');

    await flushMicrotasks();
    tick();

    expect(order).toEqual(['sync', 'async', 'after']);
    expect(router.currentPage()?.path).toBe('/two');
  });

  it('cancels the navigation when a guard resolves false', async () => {
    const router = await open();
    let calls = 0;

    const unregister = router.registerNavigationGuard(() => {
      calls++;

      return Promise.resolve(false);
    });

    router.navigate('/two');
    await flushMicrotasks();
    tick();

    expect(calls).toBe(1);
    expect(router.currentPage()?.path).toBe('/');

    unregister();
    router.navigate('/two');

    expect(router.currentPage()?.path).toBe('/two');
  });

  it('commits the navigation when a guard resolves true, and reports where it was going', async () => {
    const router = await open();
    const seen: { from: string; to: string }[] = [];

    router.registerNavigationGuard((context) => {
      seen.push(context);

      return Promise.resolve(true);
    });

    router.navigate('/two');
    await flushMicrotasks();
    tick();

    expect(seen).toEqual([{ from: '/', to: '/two' }]);
    expect(router.currentPage()?.path).toBe('/two');
  });

  it('stops at the first guard that vetoes', async () => {
    const router = await open();
    let secondGuardCalls = 0;

    router.registerNavigationGuard(() => Promise.resolve(false));
    router.registerNavigationGuard(() => {
      secondGuardCalls++;

      return Promise.resolve(true);
    });

    router.navigate('/two');
    await flushMicrotasks();
    tick();

    expect(secondGuardCalls).toBe(0);
    expect(router.currentPage()?.path).toBe('/');
  });

  it('stops consulting a guard once it is unregistered', async () => {
    const router = await open();

    const unregister = router.registerNavigationGuard(() => Promise.resolve(false));

    unregister();
    router.navigate('/two');

    expect(router.currentPage()?.path).toBe('/two');
  });

  it('does not consult guards when the target is already the current route', async () => {
    const router = await open();
    let calls = 0;

    router.registerNavigationGuard(() => {
      calls++;

      return Promise.resolve(true);
    });

    router.navigate('/');

    expect(calls).toBe(0);
  });
});
