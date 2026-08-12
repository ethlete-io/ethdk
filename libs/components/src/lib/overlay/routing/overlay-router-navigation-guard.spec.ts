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
