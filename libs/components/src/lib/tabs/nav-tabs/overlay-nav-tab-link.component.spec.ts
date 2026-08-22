import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { injectOverlayManager } from '../../overlay/overlay-manager';
import { OverlayRef } from '../../overlay/overlay-ref';
import { OverlayRouter, injectOverlayRouter, provideOverlayRouter } from '../../overlay/routing/overlay-router';
import { NavTabsComponent } from './nav-tabs.component';
import { OverlayNavTabLinkComponent } from './overlay-nav-tab-link.component';

@Component({ template: 'page one' })
class PageOneComponent {}

@Component({ template: 'page two' })
class PageTwoComponent {}

@Component({
  template: `
    <et-nav-tabs orientation="vertical">
      <button et-overlay-nav-tab-link="/">One</button>
      <button et-overlay-nav-tab-link="/two">Two</button>
    </et-nav-tabs>
  `,
  imports: [NavTabsComponent, OverlayNavTabLinkComponent],
})
class TabbedOverlayComponent {
  router: OverlayRouter = injectOverlayRouter();
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('OverlayNavTabLinkComponent', () => {
  const tick = () => TestBed.inject(ApplicationRef).tick();

  let ref: OverlayRef<TabbedOverlayComponent>;

  const links = () => Array.from(document.querySelectorAll('.et-nav-tab-link') as NodeListOf<HTMLButtonElement>);

  const activeLabels = () =>
    links()
      .filter((l) => l.classList.contains('et-nav-tab-link--active'))
      .map((l) => l.textContent?.trim());

  const selectedLabels = () =>
    links()
      .filter((l) => l.getAttribute('aria-selected') === 'true')
      .map((l) => l.textContent?.trim());

  let originalMatchMedia: typeof window.matchMedia;
  let originalAnimate: PropertyDescriptor | undefined;
  let underlineFlips = 0;

  beforeEach(() => {
    underlineFlips = 0;
    originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: () => {
        underlineFlips++;

        return {
          cancel: () => undefined,
          finish: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        };
      },
    });

    // The underline plays a FLIP animation whenever the active tab moves, which reads reduced-motion.
    originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    })) as typeof window.matchMedia;

    TestBed.configureTestingModule({});
  });

  const open = async () => {
    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());

    ref = manager.open<TabbedOverlayComponent>(TabbedOverlayComponent, {
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
    tick();

    return (ref.componentInstance() as TabbedOverlayComponent).router;
  };

  afterEach(async () => {
    ref?.close();
    await flushFrames();
    window.matchMedia = originalMatchMedia;

    if (originalAnimate) {
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    } else {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

  it('marks the link matching the overlay router as active', async () => {
    await open();

    expect(activeLabels()).toEqual(['One']);
  });

  it('navigates the overlay router on click and moves the active link', async () => {
    const router = await open();

    links()[1]!.click();
    await flushFrames();
    tick();

    expect(router.currentPage()?.path).toBe('/two');
    expect(activeLabels()).toEqual(['Two']);
  });

  it('leaves the underline on the active link while a guard is still deciding', async () => {
    const router = await open();

    let allow!: (mayLeave: boolean) => void;
    router.registerNavigationGuard(() => new Promise<boolean>((resolve) => (allow = resolve)));

    underlineFlips = 0;

    links()[1]!.click();
    await flushMicrotasks();
    await flushFrames();
    tick();

    expect(selectedLabels()).toEqual(['One']);
    expect(underlineFlips).toBe(0);

    allow(true);
    await flushMicrotasks();
    await flushFrames();
    tick();

    expect(router.currentPage()?.path).toBe('/two');
    expect(selectedLabels()).toEqual(['Two']);
    expect(underlineFlips).toBe(1);
  });

  it('leaves the selection on the active link when a guard vetoes the navigation', async () => {
    const router = await open();

    router.registerNavigationGuard(() => Promise.resolve(false));

    links()[1]!.click();
    await flushMicrotasks();
    await flushFrames();
    tick();

    expect(router.currentPage()?.path).toBe('/');
    expect(activeLabels()).toEqual(['One']);
    expect(selectedLabels()).toEqual(['One']);
  });
});
