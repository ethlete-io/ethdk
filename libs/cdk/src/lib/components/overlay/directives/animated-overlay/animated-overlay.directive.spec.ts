import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AnimatedLifecycleDirective } from '@ethlete/core';
import { NEVER } from 'rxjs';
import { AnimatedOverlayComponentBase, AnimatedOverlayDirective } from './animated-overlay.directive';

const VIEWPORT = { width: 1280, height: 720 };
const TRIGGER_RECT = { x: 1143, y: 680, width: 4, height: 12 };

@Component({ template: `<div>Menu</div>` })
class FloatingComponent implements AnimatedOverlayComponentBase {
  animatedLifecycle = signal({ enter: () => undefined, state$: NEVER } as unknown as AnimatedLifecycleDirective);
  setColorFromProvider = () => undefined;
}

@Component({
  template: `<button etAnimatedOverlay autoResize>Trigger</button>`,
  imports: [AnimatedOverlayDirective],
})
class HostComponent {}

const defineGetter = (target: object, name: string, get: () => number) =>
  Object.defineProperty(target, name, { configurable: true, get });

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

const setup = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  const triggerDebugEl = fixture.debugElement.query(By.directive(AnimatedOverlayDirective));
  const trigger = triggerDebugEl.nativeElement as HTMLElement;
  const overlay = triggerDebugEl.injector.get(AnimatedOverlayDirective<FloatingComponent>);

  const { x, y, width, height } = TRIGGER_RECT;
  trigger.getBoundingClientRect = () =>
    ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }) as DOMRect;

  const contentHeight = signal(0);

  const mount = () => {
    overlay.mount({ component: FloatingComponent });

    const floatingEl = overlay.componentRef!.location.nativeElement as HTMLElement;
    const cap = () => parseFloat(floatingEl.style.getPropertyValue('--et-floating-max-height')) || Infinity;

    defineGetter(floatingEl, 'offsetWidth', () => 100);
    defineGetter(floatingEl, 'offsetHeight', () => Math.min(contentHeight(), cap()));

    return floatingEl;
  };

  return { overlay, mount, contentHeight };
};

describe('AnimatedOverlayDirective', () => {
  beforeEach(() => {
    defineGetter(document.documentElement, 'clientWidth', () => VIEWPORT.width);
    defineGetter(document.documentElement, 'clientHeight', () => VIEWPORT.height);
  });

  afterEach(() => {
    delete (document.documentElement as unknown as Record<string, unknown>)['clientWidth'];
    delete (document.documentElement as unknown as Record<string, unknown>)['clientHeight'];
  });

  it('flips an auto-resized overlay to the top when its content grows after the first position', async () => {
    const { mount, contentHeight } = setup();
    const floatingEl = mount();

    await flush();

    expect(floatingEl.getAttribute('et-floating-placement')).toBe('bottom');

    contentHeight.set(200);
    window.dispatchEvent(new Event('resize'));
    await flush();

    expect(floatingEl.getAttribute('et-floating-placement')).toBe('top');
    expect(floatingEl.style.getPropertyValue('--et-floating-max-height')).toBe('672px');
  });

  it('positions again once the content rendered, so content that was not measured yet still flips', async () => {
    const { mount, contentHeight } = setup();
    const floatingEl = mount();

    await new Promise<void>((resolve) => setTimeout(resolve));

    expect(floatingEl.getAttribute('et-floating-placement')).toBe('bottom');

    contentHeight.set(200);
    await flush();

    expect(floatingEl.getAttribute('et-floating-placement')).toBe('top');
  });
});
