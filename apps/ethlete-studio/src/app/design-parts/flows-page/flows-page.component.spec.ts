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
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(FlowsPageComponent);

  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const viewport = element.querySelector<HTMLElement>('ethlete-design-canvas');
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
      if (this.tagName === 'ETHLETE-DESIGN-CANVAS') return rectOf(300, 40) as DOMRect;
      if (this.classList.contains('min-h-0') && this.classList.contains('flex-1')) return rectOf(364, 72) as DOMRect;

      return original.call(this);
    });

    const { world } = await render();

    expect(world?.style.transform).toBe('translate(64px, 32px) scale(1)');
  });

  it('pans the flow by the wheel', async () => {
    const { fixture, viewport, world } = await render();

    viewport?.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, deltaY: 40, cancelable: true }));
    await fixture.whenStable();

    expect(world?.style.transform).toBe('translate(-300px, -40px) scale(1)');
  });

  it('zooms with the zoom chip', async () => {
    const { fixture, element, world } = await render();

    element.querySelector<HTMLButtonElement>('[aria-label="Vergrößern"]')?.click();
    await fixture.whenStable();

    expect(world?.style.transform).toContain('scale(1.5)');
    expect(element.querySelector('[aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe('150 %');
  });

  it('returns to the stage start at 100 % from the zoom chip', async () => {
    const { fixture, element, viewport, world } = await render();

    viewport?.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, deltaY: 40, cancelable: true }));
    element.querySelector<HTMLButtonElement>('[aria-label="Vergrößern"]')?.click();
    element.querySelector<HTMLButtonElement>('[aria-label="Auf 100 % zoomen"]')?.click();
    await fixture.whenStable();

    expect(world?.style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('names the preset select', async () => {
    const { element } = await render();

    expect(element.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe('Bildschirmgröße');
  });

  it('resets the camera when another flow is picked', async () => {
    const { fixture, viewport, world } = await render();

    viewport?.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, deltaY: 40, cancelable: true }));
    await fixture.whenStable();
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

  describe('orphan notes', () => {
    const notes = [
      { id: 'near', text: 'Nah am Graphen', x: 790, y: 262 },
      { id: 'edge', text: 'Knapp daneben', x: 1057 + 300, y: 0 },
      { id: 'far', text: 'Weit weg', x: 1057 + 400, y: 0 },
      { id: 'below', text: 'Tief unten', x: 100, y: 1200 },
      { id: 'draft', text: '', x: 5000, y: 5000 },
    ];
    const listed = (element: HTMLElement) =>
      [...element.querySelectorAll<HTMLElement>('section button')].map((button) => button.textContent?.trim());

    it('lists a note farther than 320 px from every frame and skips near ones and an empty draft', async () => {
      const { fixture, element } = await render();

      fixture.componentRef.setInput('notes', notes);
      await fixture.whenStable();

      expect(listed(element)).toEqual(['Weit weg', 'Tief unten']);
      expect(element.querySelector('section h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Verwaiste Notizen · 2',
      );
    });

    it('shows the empty hint when no note is orphaned', async () => {
      const { fixture, element } = await render();

      fixture.componentRef.setInput('notes', [notes[0]]);
      await fixture.whenStable();

      expect(listed(element)).toEqual([]);
      expect(element.querySelector('section')?.textContent).toContain('Keine');
    });

    it('measures against the frames: a wider flow makes a far note near', async () => {
      const { fixture, element } = await render();

      fixture.componentRef.setInput('notes', [notes[2]]);
      fixture.componentRef.setInput('frames', [
        ...fixture.componentInstance.frames(),
        { id: 'wide', title: 'Wide', src: '/x', col: 5, row: 0 },
      ]);
      await fixture.whenStable();

      expect(listed(element)).toEqual([]);
    });

    it('emits the note id on a click of its entry', async () => {
      const { fixture, element } = await render();
      const jumped: string[] = [];

      fixture.componentInstance.jumpToNote.subscribe((id) => jumped.push(id));
      fixture.componentRef.setInput('notes', notes);
      await fixture.whenStable();

      element.querySelectorAll<HTMLButtonElement>('section button')[1]?.click();

      expect(jumped).toEqual(['below']);
    });

    it('centres the camera on the note when jumped to', async () => {
      const { fixture, world } = await render();

      fixture.componentRef.setInput('notes', notes);
      await fixture.whenStable();
      fixture.componentInstance.jumpTo('far');
      await fixture.whenStable();

      expect(world?.style.transform).toBe('translate(' + -(1457 + 128) + 'px, ' + -48 + 'px) scale(1)');
    });

    it('centres on the rendered height of the note, not the assumed one', async () => {
      const { fixture, world } = await render();

      fixture.componentRef.setInput('notes', notes);
      await fixture.whenStable();
      vi.spyOn(world?.querySelector('[data-flow-note="far"]') as HTMLElement, 'offsetHeight', 'get').mockReturnValue(
        50,
      );
      fixture.componentInstance.jumpTo('far');
      await fixture.whenStable();

      expect(world?.style.transform).toBe('translate(' + -(1457 + 128) + 'px, ' + -25 + 'px) scale(1)');
    });
  });
});
