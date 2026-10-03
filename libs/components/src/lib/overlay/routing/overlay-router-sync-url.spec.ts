import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayRouter, injectOverlayRouter, provideOverlayRouter } from './overlay-router';

@Component({ template: 'page' })
class PageComponent {}

@Component({ template: 'routed overlay' })
class RoutedOverlayComponent {
  router: OverlayRouter = injectOverlayRouter();
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await flushFrames();
  }
};

describe('OverlayRouter with syncUrl', () => {
  let ref: OverlayRef<RoutedOverlayComponent>;
  let router: Router;
  let location: Location;
  let releaseGuard: (allowed: boolean) => void;

  beforeEach(() => {
    const guard = () => new Promise<boolean>((resolve) => (releaseGuard = resolve));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'guarded', canActivate: [guard], children: [] },
          { path: '**', children: [] },
        ]),
        provideLocationMocks(),
      ],
    });
  });

  const open = async () => {
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    router.setUpLocationChangeListener();
    await router.navigateByUrl('/page');

    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());

    ref = manager.open<RoutedOverlayComponent>(RoutedOverlayComponent, {
      providers: [
        provideOverlayRouter({
          routes: [
            { path: '/', component: PageComponent },
            { path: '/two', component: PageComponent },
            { path: '/three', component: PageComponent },
          ],
          syncUrl: true,
        }),
      ],
    });

    await settle();

    return (ref.componentInstance() as RoutedOverlayComponent).router;
  };

  const goTo = async (overlayRouter: OverlayRouter, path: string) => {
    overlayRouter.navigate(path);
    await settle();
  };

  const browser = async (step: 'back' | 'forward') => {
    location[step]();
    await settle();
  };

  const closeAndExpectPageEntry = async () => {
    ref.close();
    await settle();

    expect(router.url).toBe('/page');

    await browser('back');

    expect(router.url).toBe('/');
  };

  it('follows browser Back and Forward between routes', async () => {
    const overlayRouter = await open();

    await goTo(overlayRouter, '/two');
    await goTo(overlayRouter, '/three');

    await browser('back');
    expect(overlayRouter.currentPage()?.path).toBe('/two');
    expect(overlayRouter.navigationDirection()).toBe('backward');

    await browser('forward');
    expect(overlayRouter.currentPage()?.path).toBe('/three');
    expect(overlayRouter.navigationDirection()).toBe('forward');

    await closeAndExpectPageEntry();
  });

  it('steps a vetoed browser Back forward again and keeps the forward history', async () => {
    const overlayRouter = await open();

    await goTo(overlayRouter, '/two');
    await goTo(overlayRouter, '/three');
    await browser('back');

    const vetoedUrl = router.url;
    let vetoing = true;

    overlayRouter.registerNavigationGuard(() => !vetoing);

    await browser('back');

    expect(overlayRouter.currentPage()?.path).toBe('/two');
    expect(router.url).toBe(vetoedUrl);

    vetoing = false;
    await browser('forward');

    expect(overlayRouter.currentPage()?.path).toBe('/three');
    expect(overlayRouter.navigationDirection()).toBe('forward');

    await closeAndExpectPageEntry();
  });

  it('steps a vetoed browser Forward back again', async () => {
    const overlayRouter = await open();

    await goTo(overlayRouter, '/two');
    await browser('back');

    let vetoing = true;

    overlayRouter.registerNavigationGuard(() => !vetoing);

    await browser('forward');

    expect(overlayRouter.currentPage()?.path).toBe('/');

    vetoing = false;
    await browser('forward');

    expect(overlayRouter.currentPage()?.path).toBe('/two');

    await closeAndExpectPageEntry();
  });

  it('leaves a navigation that closed the overlay alone when it is destroyed before the navigation ends', async () => {
    const overlayRouter = await open();

    await goTo(overlayRouter, '/two');

    const overlayUrl = router.url;
    const sources: string[] = [];
    ref.afterClosedEvent().subscribe(({ source }) => sources.push(source));

    const navigation = router.navigateByUrl('/guarded');
    await settle();

    expect(sources).toEqual(['navigation']);

    releaseGuard(true);

    await expect(navigation).resolves.toBe(true);
    await settle();

    expect(router.url).toBe('/guarded');
    expect(location.path()).toBe('/guarded');

    await browser('back');

    expect(router.url).toBe(overlayUrl);
  });

  it('clears its url param when a guard cancels the navigation that closed the overlay', async () => {
    const overlayRouter = await open();

    await goTo(overlayRouter, '/two');

    const navigation = router.navigateByUrl('/guarded');
    await settle();

    releaseGuard(false);

    await expect(navigation).resolves.toBe(false);
    await settle();

    expect(ref.componentInstance()).toBeNull();
    expect(router.url).toBe('/page');
    expect(location.path()).toBe('/page');

    await browser('back');

    expect(router.url).toBe('/');
  });
});
