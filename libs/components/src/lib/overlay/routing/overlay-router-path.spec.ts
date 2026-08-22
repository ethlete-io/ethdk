import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayRouter, injectOverlayRouter, provideOverlayRouter } from './overlay-router';

@Component({ template: 'root' })
class RootComponent {}

@Component({ template: 'a' })
class AComponent {}

@Component({ template: 'b' })
class BComponent {}

@Component({ template: 'c' })
class CComponent {}

@Component({ template: 'routed overlay' })
class RoutedOverlayComponent {
  router: OverlayRouter = injectOverlayRouter();
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('OverlayRouter resolvePath', () => {
  let ref: OverlayRef<RoutedOverlayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  const open = async (initialRoute: string) => {
    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());

    ref = manager.open<RoutedOverlayComponent>(RoutedOverlayComponent, {
      providers: [
        provideOverlayRouter({
          initialRoute,
          routes: [
            { path: '/', component: RootComponent },
            { path: '/a', component: AComponent },
            { path: '/a/b', component: BComponent },
            { path: '/a/b/c', component: CComponent },
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

  it('resolves the forward form relative to the current route', async () => {
    const router = await open('/a/b');

    expect(router.resolvePath('c')).toEqual({ route: '/a/b/c', type: 'forward' });
  });

  it('resolves the replace-current form by swapping the last segment of the current route', async () => {
    const router = await open('/a/b');

    expect(router.resolvePath('./sibling')).toEqual({ route: '/a/sibling', type: 'replace-current' });
  });

  it('resolves the back form by stepping up out of the current route', async () => {
    const router = await open('/a/b/c');

    expect(router.resolvePath('../up')).toEqual({ route: '/a/b/up', type: 'back' });
  });

  it('resolves the absolute form untouched', async () => {
    const router = await open('/a');

    expect(router.resolvePath('/a/b/c')).toEqual({ route: '/a/b/c', type: 'absolute' });
  });

  it('steps back past the root when the path runs out of segments to pop', async () => {
    const router = await open('/a');

    expect(router.resolvePath('../')).toEqual({ route: '/', type: 'back' });
  });

  it('treats "/" as the back type even though it is also a valid absolute path', async () => {
    const router = await open('/a/b');

    expect(router.resolvePath('/')).toEqual({ route: '/', type: 'back' });
  });

  it('joins a (string | number)[] path before resolving it', async () => {
    const router = await open('/a');

    expect(router.resolvePath(['b', 2, 'c'])).toEqual({ route: '/a/b/2/c', type: 'forward' });
  });
});
