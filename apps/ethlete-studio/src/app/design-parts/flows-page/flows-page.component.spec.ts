import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FlowsPageComponent } from './flows-page.component';

class SilentResizeObserver {
  public observe() {
    return undefined;
  }

  public unobserve() {
    return undefined;
  }

  public disconnect() {
    return undefined;
  }
}

const render = async () => {
  vi.stubGlobal('ResizeObserver', SilentResizeObserver);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
  });
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(FlowsPageComponent);

  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const viewport = element.querySelector<HTMLElement>('ethlete-canvas-viewport');
  const world = viewport?.firstElementChild as HTMLElement | null;

  return { fixture, element, viewport, world };
};

describe('FlowsPageComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts at 100 % instead of fitting the flow', async () => {
    const { element, world } = await render();

    expect(world?.style.transform).toBe('translate(0px, 0px) scale(1)');
    expect(element.querySelector('[aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe('100 %');
  });

  it('pans the flow by the wheel', async () => {
    const { viewport, world } = await render();

    viewport?.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, deltaY: 40, cancelable: true }));

    expect(world?.style.transform).toBe('translate(-300px, -40px) scale(1)');
  });

  it('zooms with the zoom chip', async () => {
    const { fixture, element, world } = await render();

    element.querySelector<HTMLButtonElement>('[aria-label="Vergrößern"]')?.click();
    await fixture.whenStable();

    expect(world?.style.transform).toContain('scale(1.5)');
    expect(element.querySelector('[aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe('150 %');
  });
});
