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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts at 100 % instead of fitting the flow', async () => {
    const { element, world } = await render();

    expect(world?.style.transform).toBe('translate(0px, 0px) scale(1)');
    expect(element.querySelector('[aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe('100 %');
  });

  it('starts the flow at the top left of the stage below the header, not at its page offset', async () => {
    const rectOf = (left: number, top: number) => ({ left, top, right: left, bottom: top, width: 0, height: 0 });
    const original = Element.prototype.getBoundingClientRect;

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.tagName === 'ETHLETE-CANVAS-VIEWPORT') return rectOf(300, 40) as DOMRect;
      if (this.classList.contains('min-h-0') && this.classList.contains('flex-1')) return rectOf(364, 72) as DOMRect;

      return original.call(this);
    });

    const { world } = await render();

    expect(world?.style.transform).toBe('translate(64px, 32px) scale(1)');
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

  it('names the preset select', async () => {
    const { element } = await render();

    expect(element.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe('Bildschirmgröße');
  });

  it('resets the camera when another flow is picked', async () => {
    const { fixture, viewport, world } = await render();

    viewport?.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, deltaY: 40, cancelable: true }));
    expect(world?.style.transform).toBe('translate(-300px, -40px) scale(1)');

    fixture.componentRef.setInput('selected', 'Kommentar beantworten');
    await fixture.whenStable();

    expect(world?.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('sizes each frame box by the ratio', async () => {
    const { fixture, element } = await render();
    const boxHeight = () => element.querySelector<HTMLElement>('[data-et-projected="shot"]')?.style.height;

    expect(boxHeight()).toBe('162px');

    fixture.componentRef.setInput('ratio', 844 / 390);
    await fixture.whenStable();

    expect(parseFloat(boxHeight() ?? '0')).toBeCloseTo(259.2 * (844 / 390), 1);
  });

  it('draws each note at its canvas point and deletes one by its button', async () => {
    const { fixture, element } = await render();
    const deleted: string[] = [];

    fixture.componentInstance.noteDelete.subscribe((id) => deleted.push(id));
    fixture.componentRef.setInput('notes', [
      { id: 'a', text: 'Eine sehr lange Notiz über den fehlenden Rückweg aus dem System', x: 12, y: 340 },
      { id: 'b', text: 'Zweite', x: -200, y: 0 },
      { id: 'c', text: 'Dritte', x: 900, y: 40 },
    ]);
    await fixture.whenStable();

    const notes = [...element.querySelectorAll<HTMLElement>('[data-flow-note]')];

    expect(notes.map((note) => note.querySelector('p')?.textContent?.trim())).toEqual([
      'Eine sehr lange Notiz über den fehlenden Rückweg aus dem System',
      'Zweite',
      'Dritte',
    ]);
    expect(notes[1]?.style.left).toBe('-200px');

    notes[2]?.querySelector<HTMLButtonElement>('button[aria-label="Notiz löschen"]')?.click();

    expect(deleted).toEqual(['c']);
  });

  it('opens a new note with its empty field and drops it on Enter or Escape while empty', async () => {
    const { fixture, element } = await render();
    const written: unknown[] = [];
    const deleted: string[] = [];

    fixture.componentInstance.noteText.subscribe((text) => written.push(text));
    fixture.componentInstance.noteDelete.subscribe((id) => deleted.push(id));
    fixture.componentRef.setInput('notes', [{ id: 'draft', text: '', x: 0, y: 0 }]);
    await fixture.whenStable();

    const field = () => element.querySelector<HTMLTextAreaElement>('[data-flow-note] textarea');

    expect(field()?.getAttribute('placeholder')).toBe('Notiz schreiben');

    field()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.componentRef.setInput('notes', [{ id: 'other', text: '', x: 0, y: 0 }]);
    await fixture.whenStable();
    field()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(deleted).toEqual(['draft', 'other']);
    expect(written).toEqual([]);
  });
});
