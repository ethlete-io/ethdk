import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { rememberedView } from '../../studio-view/remembered';
import { ListedCall } from '../../../host/design';
import { callFramesOf } from '../../system-view/system-tree';
import { CanvasFrame, SCHEME_GAP, SIDE_BY_SIDE_MAX_WIDTH } from './canvas-frame';
import { FramePoint } from './canvas-pin';
import { DesignCanvasComponent } from './design-canvas.component';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const FITTED: CanvasFrame = { id: 'default', src: 'about:blank', label: 'default', error: 'not drawn in jsdom' };

const LEGACY_CALL: ListedCall = {
  slug: 'acme/components/button',
  project: 'acme',
  eyebrow: 'Button',
  headline: 'Which button?',
  stage: 'component',
  legacy: true,
  transferred: false,
  closed: null,
  frameWidth: 960,
  variants: [{ key: 'a', name: 'Solid' }],
};

const render = async (frames: CanvasFrame[]) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture: ComponentFixture<DesignCanvasComponent> = TestBed.createComponent(DesignCanvasComponent);

  fixture.componentRef.setInput('frames', frames);
  fixture.componentRef.setInput('cameraKey', 'acme components/button');
  await fixture.whenStable();

  return fixture;
};

const frameElement = (fixture: ComponentFixture<DesignCanvasComponent>) =>
  fixture.debugElement.query(By.directive(CanvasFrameComponent));

describe('DesignCanvasComponent', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => vi.useRealTimers());

  it('hides a fitted frame until its size is known', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture);

    expect(frame.nativeElement.hasAttribute('data-unsized')).toBe(true);

    (frame.componentInstance as CanvasFrameComponent).widthChange.emit(150);
    (frame.componentInstance as CanvasFrameComponent).heightChange.emit(70);
    await fixture.whenStable();

    expect(frame.nativeElement.hasAttribute('data-unsized')).toBe(false);
    expect(frame.nativeElement.style.width).toBe('150px');
    expect(frame.nativeElement.style.height).toBe('70px');
  });

  it('shows only the marker of a pointed note once labels stop holding their size', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', width: 390, height: 844 }]);

    fixture.componentRef.setInput('notes', [
      { id: 'n', text: 'Hero', frameId: 'a', point: { x: 40, y: 120 } },
      { id: 'h', text: 'Library', heading: true, at: { x: 0, y: -160 } },
    ]);
    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.2 });
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-note="n"]')).toBeNull();
    expect(host.querySelector('[data-note-connector]')).toBeNull();
    expect(host.querySelector('[data-note-marker]')).not.toBeNull();
    expect(host.querySelector('[data-note="h"]')).not.toBeNull();

    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.3 });
    host.querySelector('[data-note-marker]')?.dispatchEvent(new Event('pointerenter'));
    await fixture.whenStable();

    expect(host.querySelector('[data-note="n"]')).not.toBeNull();
    expect(host.querySelector('[data-note-connector]')).not.toBeNull();
  });

  it('keeps an every-zoom note below its frame at label size once other cards hide', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', width: 390, height: 844 }]);

    fixture.componentRef.setInput('notes', [
      { id: 'n', text: 'Hero', frameId: 'a' },
      { id: 'v', text: '32 × 18', frameId: 'a', everyZoom: true },
    ]);
    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.2 });
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-note="n"]')).toBeNull();
    expect(host.querySelector('[data-note="v"]')).not.toBeNull();
    expect(host.querySelector<HTMLElement>('[data-note-anchor="below"]')?.style.transform).toBe('scale(4)');
  });

  it('shows each note at its place, and reports the world point of a click on empty space while pointing', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', width: 390, height: 844 }]);
    const picks: { x: number; y: number }[] = [];

    fixture.componentInstance.spacePick.subscribe((point) => picks.push(point));
    fixture.componentRef.setInput('notes', [
      { id: 'n', text: 'Hero', frameId: 'a', point: { x: 40, y: 120 } },
      { id: 'h', text: 'Library', heading: true, at: { x: 0, y: -160 } },
    ]);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const column = host.querySelector<HTMLElement>('[data-note-anchor="below"]');
    const marker = host.querySelector<HTMLElement>('[data-note-marker="n a"]');
    const heading = host.querySelector<HTMLElement>('[data-note-anchor="at"]');

    expect([column?.style.left, column?.style.top, column?.textContent?.trim()]).toEqual(['0px', '860px', '1Hero']);
    expect([marker?.style.left, marker?.style.top]).toEqual(['40px', '120px']);
    expect(host.querySelector('[data-note-connector]')).toBeNull();

    marker?.dispatchEvent(new Event('pointerenter'));
    await fixture.whenStable();

    expect(host.querySelector('[data-note-connector="n a"]')?.getAttribute('d')).toMatch(/^M 40 120 V 852 /);

    marker?.dispatchEvent(new Event('pointerleave'));
    await fixture.whenStable();
    expect([heading?.style.left, heading?.style.top, heading?.textContent?.trim()]).toEqual([
      '0px',
      '-160px',
      'Library',
    ]);

    host.dispatchEvent(new MouseEvent('click', { clientX: 30, clientY: 50, bubbles: true }));
    expect(picks).toEqual([]);

    fixture.componentRef.setInput('pointing', true);
    await fixture.whenStable();
    host.dispatchEvent(new MouseEvent('click', { clientX: 30, clientY: 50, bubbles: true }));
    expect(picks).toHaveLength(1);
  });

  it('numbers the pointed notes of each frame on marker and card, and draws a line only while one is hovered', async () => {
    const fixture = await render([
      { ...FITTED, id: 'a', width: 390, height: 844 },
      { ...FITTED, id: 'b', width: 390, height: 844 },
    ]);

    fixture.componentRef.setInput('notes', [
      { id: 'n', text: 'Hero', frameId: 'a', point: { x: 40, y: 120 } },
      { id: 'w', text: 'Whole', frameId: 'a' },
      { id: 'm', text: 'Button', frameId: 'a', point: { x: 80, y: 600 } },
      { id: 'o', text: 'Other', frameId: 'b', point: { x: 10, y: 10 } },
    ]);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const numberOf = (selector: string) => host.querySelector(selector)?.textContent?.trim();
    const card = host.querySelector('[data-note-key="m a"]');
    const connectors = () =>
      [...host.querySelectorAll('[data-note-connector]')].map((path) => path.getAttribute('data-note-connector'));

    expect(['n a', 'm a', 'o b'].map((key) => numberOf(`[data-note-marker="${key}"]`))).toEqual(['1', '2', '1']);
    expect(
      ['n a', 'm a', 'o b', 'w a'].map((key) => numberOf(`[data-note-key="${key}"] [data-note-number]`) ?? null),
    ).toEqual(['1', '2', '1', null]);
    expect(connectors()).toEqual([]);

    card?.dispatchEvent(new Event('pointerenter'));
    await fixture.whenStable();
    expect(connectors()).toEqual(['m a']);

    card?.dispatchEvent(new Event('pointerleave'));
    host.querySelector('[data-note-key="w a"]')?.dispatchEvent(new Event('pointerenter'));
    await fixture.whenStable();
    expect(connectors()).toEqual([]);
  });

  it('stacks notes over frames, pins over notes, and an open thread, the draft and a note in change over all', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', width: 390, height: 844 }]);
    fixture.componentRef.setInput('notes', [
      { id: 'n', text: 'Hero', frameId: 'a', point: { x: 40, y: 120 } },
      { id: 'm', text: 'Library', at: { x: 0, y: -160 } },
    ]);
    fixture.componentRef.setInput('pins', [
      { id: 'p', frameId: 'a', label: '1', text: 'one' },
      { id: 'q', frameId: 'a', label: '2', text: 'two' },
    ]);
    fixture.componentRef.setInput('draft', { frameId: 'a', point: { x: 10, y: 10 } });
    fixture.componentInstance.openPinId.set('q');
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const layer = (selector: string) => {
      const element = host.querySelector(selector);

      return Number(/(?:^|\s)z-(\d)(?:\s|$)/.exec(element?.getAttribute('class') ?? '')?.[1] ?? 0);
    };
    const pinLayer = (label: string) =>
      Number(
        /(?:^|\s)z-(\d)(?:\s|$)/.exec(
          host.querySelector(`[aria-label="Comment ${label}"]`)?.parentElement?.className ?? '',
        )?.[1] ?? 0,
      );

    expect(layer('ethlete-canvas-frame')).toBe(0);
    expect([layer('[data-note-anchor="below"]'), layer('[data-note-marker]')]).toEqual([2, 2]);
    expect(pinLayer('1')).toBe(3);
    expect([pinLayer('2'), layer('[data-comment-draft]')]).toEqual([4, 4]);
    expect(host.querySelector('[data-note-anchor="at"]')?.className).toContain('has-data-canvas-popover:z-4');
  });

  it('lays a flow out left to right along its lines and draws each line with its label', async () => {
    const page = (id: string): CanvasFrame => ({ ...FITTED, id, label: id, width: 390, height: 844 });

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);

    fixture.componentRef.setInput('frames', [page('done'), page('cart'), page('checkout')]);
    fixture.componentRef.setInput('arrangement', 'flow');
    fixture.componentRef.setInput('lines', [
      { from: 'cart', to: 'checkout', label: 'user clicks "Zur Kasse"' },
      { from: 'checkout', to: 'done' },
    ]);
    await fixture.whenStable();

    const lefts = Object.fromEntries(
      fixture.debugElement
        .queryAll(By.directive(CanvasFrameComponent))
        .map((frame) => [
          (frame.componentInstance as CanvasFrameComponent).frame().id,
          (frame.nativeElement as HTMLElement).style.left,
        ]),
    );
    const host = fixture.nativeElement as HTMLElement;

    expect(lefts).toEqual({ cart: '0px', checkout: '670px', done: '1340px' });
    expect(host.querySelectorAll('[data-flow-line]')).toHaveLength(2);
    expect([...host.querySelectorAll('[data-flow-label]')].map((label) => label.textContent?.trim())).toEqual([
      'user clicks "Zur Kasse"',
    ]);
    expect(host.querySelector<HTMLElement>('[data-flow-label]')?.style.maxWidth).toBe('200px');

    fixture.componentRef.setInput('lines', [
      {
        from: 'cart',
        to: 'checkout',
        label: 'user fills in the shipping address and the credit card details, then clicks "Pay now"',
      },
      { from: 'checkout', to: 'done' },
    ]);
    await fixture.whenStable();

    const checkout = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .find((frame) => (frame.componentInstance as CanvasFrameComponent).frame().id === 'checkout');

    expect((checkout?.nativeElement as HTMLElement).style.left).toBe('950px');
    expect(host.querySelector<HTMLElement>('[data-flow-label]')?.style.maxWidth).toBe('480px');

    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.5 });
    await fixture.whenStable();

    expect(host.querySelector<HTMLElement>('[data-flow-label]')?.style.maxWidth).toBe('240px');
  });

  it('remembers the measured size and places the frame by it after a reload', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).componentInstance as CanvasFrameComponent;

    vi.useFakeTimers();

    frame.widthChange.emit(150);
    frame.heightChange.emit(70);
    vi.advanceTimersByTime(500);

    expect(rememberedView().measuredSizes).toEqual({ 'acme components/button default': { width: 150, height: 70 } });

    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const reloaded = frameElement(await render([FITTED])).nativeElement as HTMLElement;

    expect(reloaded.hasAttribute('data-unsized')).toBe(false);
    expect(reloaded.style.width).toBe('150px');
    expect(reloaded.style.height).toBe('70px');
  });

  it('reports a camera the user moved, and a fit as no camera to keep', async () => {
    const fixture = await render([FITTED]);
    const canvas = fixture.componentInstance;
    const reported: unknown[] = [];

    vi.useFakeTimers();
    canvas.cameraChange.subscribe((camera) => reported.push(camera));
    canvas.camera.set({ x: 5, y: -900, zoom: 0.2 });
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([]);

    canvas['zoomBy'](2);
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([{ x: 10, y: -1800, zoom: 0.4 }]);

    canvas.fitAll();
    vi.advanceTimersByTime(400);
    expect(reported.at(-1)).toBeNull();
  });

  describe('when the canvas width changes', () => {
    const setup = async () => {
      const size = { width: 1200, height: 1000 };
      const resized: (() => void)[] = [];
      let host: unknown = null;

      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this === host ? size.width : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this === host ? size.height : 0;
      });
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            resized.push(() => callback([{ target: this.target } as ResizeObserverEntry], this as never));
          }
          private target: Element | null = null;
          observe(target: Element) {
            this.target = target;
          }
          disconnect() {
            return undefined;
          }
        },
      );

      const fixture = await render([{ ...FITTED, id: 'a', width: 1000, height: 600 }]);

      host = fixture.nativeElement;
      resized.forEach((resize) => resize());
      await fixture.whenStable();

      const resizeTo = async (width: number) => {
        size.width = width;
        resized.forEach((resize) => resize());
        await fixture.whenStable();
      };

      return { canvas: fixture.componentInstance, resizeTo };
    };

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('fits the view again while it is still fitted', async () => {
      const { canvas, resizeTo } = await setup();
      const before = canvas.camera().zoom;

      await resizeTo(600);

      expect(canvas.camera().zoom).toBeLessThan(before);
    });

    it('keeps the zoom the user set, and fits again after a fit', async () => {
      const { canvas, resizeTo } = await setup();

      canvas['zoomBy'](0.5);
      const zoomed = canvas.camera();

      await resizeTo(600);

      expect(canvas.camera()).toEqual(zoomed);

      canvas.fitAll();
      const fitted = canvas.camera().zoom;

      await resizeTo(300);

      expect(canvas.camera().zoom).toBeLessThan(fitted);
    });
  });

  it('keeps a focused frame in view when the canvas shrinks, until the user moves the camera', async () => {
    const size = { width: 1200, height: 1000 };
    const resized: (() => void)[] = [];
    let host: unknown = null;

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this === host ? size.width : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this === host ? size.height : 0;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(() => callback([{ target: this.target } as ResizeObserverEntry], this as never));
        }
        private target: Element | null = null;
        observe(target: Element) {
          this.target = target;
        }
        disconnect() {
          return undefined;
        }
      },
    );

    const fixture = await render([
      { ...FITTED, id: 'a', width: 390, height: 600 },
      { ...FITTED, id: 'b', width: 390, height: 600 },
    ]);
    const canvas = fixture.componentInstance;

    host = fixture.nativeElement;
    resized.forEach((resize) => resize());
    await fixture.whenStable();

    const shrink = async (height: number) => {
      size.height = height;
      resized.forEach((resize) => resize());
      await fixture.whenStable();
    };
    const bottomOf = (id: string) => {
      const placed = canvas['framesById']().get(id);
      const { y, zoom } = canvas.camera();

      return placed ? y + (placed.y + placed.height) * zoom : NaN;
    };

    canvas['zoomBy'](1);
    canvas.camera.set({ x: -5000, y: -5000, zoom: 1 });
    canvas.focusFrame('b');

    expect(bottomOf('b')).toBeGreaterThan(500);

    await shrink(500);

    expect(bottomOf('b')).toBeLessThanOrEqual(500);

    canvas['zoomBy'](2);
    const moved = canvas.camera();

    await shrink(400);

    expect(canvas.camera()).toEqual(moved);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sizes a fitted frame by its measured content, whatever size an older Studio stored for it', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        frameSizes: { 'acme components/button default': { width: 160, height: 80 } },
        measuredSizes: { 'acme components/button default': { width: 100, height: 68 } },
      }),
    );

    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).nativeElement as HTMLElement;

    expect(frame.style.width).toBe('100px');
    expect(frame.style.height).toBe('68px');

    frameElement(fixture).triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('et-resize-handles')).toBeNull();
  });

  it('sets a state group of fitted matrix rows apart by twice the row gap', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string, group: string): CanvasFrame => ({
      ...FITTED,
      id: row,
      row,
      rowGroup: group,
      column: 'current',
    });

    fixture.componentRef.setInput('frames', [
      cell('solid · rest', 'solid'),
      cell('solid · hover', 'solid'),
      cell('outline · rest', 'outline'),
    ]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    await fixture.whenStable();

    const [rest, hover, outline] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);
    const gapBelow = (above: HTMLElement | undefined, below: HTMLElement | undefined) =>
      parseFloat(below?.style.top ?? '') - parseFloat(above?.style.top ?? '') - parseFloat(above?.style.height ?? '');

    expect(gapBelow(rest, hover)).toBe(48);
    expect(gapBelow(hover, outline)).toBe(96);
  });

  it('draws a folded row head below the frame rows and an open one above its row, and emits its key on a click', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string): CanvasFrame => ({ ...FITTED, id: row, row, column: 'a', width: 200, height: 100 });
    const toggled: string[] = [];

    fixture.componentInstance.rowToggle.subscribe((key) => toggled.push(key));
    fixture.componentRef.setInput('frames', [cell('hidden'), cell('inbox')]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'a', label: 'a' }]);
    fixture.componentRef.setInput('rowHeads', [
      { key: 'unchanged inbox', label: 'inbox · unchanged in a', open: true, before: 'inbox' },
      { key: 'unchanged system', label: 'system · unchanged in a', open: false, before: 'system' },
    ]);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const heads = [...host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].filter((button) =>
      button.textContent?.includes('unchanged'),
    );
    const [, inbox] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);
    const topOf = (element: HTMLElement | undefined) => parseFloat(element?.style.top ?? '');

    expect(heads.map((head) => [head.textContent?.trim(), head.getAttribute('aria-expanded')])).toEqual([
      ['inbox · unchanged in a', 'true'],
      ['system · unchanged in a', 'false'],
    ]);
    expect(topOf(inbox) - topOf(heads[0])).toBe(48 + 24);
    expect(topOf(heads[1])).toBeGreaterThan(topOf(inbox));

    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.16 });
    await fixture.whenStable();

    expect(heads[1]?.style.transform).toBe('translateX(-4rem) scale(2)');

    heads[1]?.click();

    expect(toggled).toEqual(['unchanged system']);
  });

  it('stacks matrix sections as bands with their own column heads, and dims a pending frame under its label', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (column: string, row: string, pending?: string): CanvasFrame => ({
      ...FITTED,
      id: `${column} ${row}`,
      row,
      column,
      width: 200,
      height: 100,
      ...(pending ? { pending } : {}),
    });

    fixture.componentRef.setInput('frames', [cell('c', 'new default', 'Still drawing'), cell('a', 'old default')]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [
      { key: 'c', label: 'c', section: 'new', group: { key: 'new', label: 'r2' } },
      { key: 'a', label: 'a', section: 'old', group: { key: 'old', label: 'r1' } },
    ]);
    fixture.componentRef.setInput('rowHeads', [
      { key: 'older', label: 'r0 · x', note: 'Too loud', open: false, section: 'older' },
    ]);
    fixture.componentRef.setInput('sections', ['new', 'old', 'older']);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const [drawn, older] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);
    const groups = [...host.querySelectorAll<HTMLButtonElement>('button[aria-expanded="true"]')];
    const head = host.querySelector<HTMLElement>('[data-row-head]');

    expect(drawn?.style.left).toBe('0px');
    expect(older?.style.left).toBe('0px');
    expect(parseFloat(older?.style.top ?? '')).toBeGreaterThan(100);
    expect(groups.map((group) => [group.textContent?.trim(), group.parentElement?.style.marginTop])).toEqual([
      ['r2', '0px'],
      ['r1', older?.style.top],
    ]);
    expect(parseFloat(head?.style.top ?? '')).toBeGreaterThan(parseFloat(older?.style.top ?? ''));
    expect(head?.textContent?.trim()).toBe('Too loud');
    expect(drawn?.hasAttribute('data-pending')).toBe(true);
    expect(drawn?.querySelector('[data-frame-pending]')?.textContent?.trim()).toBe('Still drawing');
    expect(older?.querySelector('[data-frame-pending]')).toBeNull();
  });

  it('lowers the next matrix row below the note column of a frame at the largest scale the column takes', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset['noteFrame'] === undefined ? 0 : 200;
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string): CanvasFrame => ({ ...FITTED, id: row, row, rowGroup: 'solid', column: 'current' });

    fixture.componentRef.setInput('frames', [cell('rest'), cell('hover')]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    fixture.componentRef.setInput('notes', [{ id: 'n', text: 'A long note', frameId: 'rest', point: { x: 4, y: 4 } }]);
    await fixture.whenStable();

    const [rest, hover] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);

    expect(
      parseFloat(hover?.style.top ?? '') - parseFloat(rest?.style.top ?? '') - parseFloat(rest?.style.height ?? ''),
    ).toBe(16 + 200 * 2 + 48);

    fixture.componentInstance.camera.set({ x: 0, y: 0, zoom: 0.3 });
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-note-frame="rest"]')?.style.transform,
    ).toBe('scale(2)');
    vi.restoreAllMocks();
  });

  it('widens every fitted tile in a matrix column to the widest one, so the right edges line up', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        measuredSizes: {
          'acme components/button solid': { width: 100, height: 40 },
          'acme components/button outline': { width: 140, height: 40 },
        },
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string): CanvasFrame => ({ ...FITTED, id: row, row, column: 'current' });

    fixture.componentRef.setInput('frames', [cell('solid'), cell('outline')]);
    fixture.componentRef.setInput('cameraKey', 'acme components/button');
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    await fixture.whenStable();

    const rightEdges = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map(({ nativeElement }) => parseFloat(nativeElement.style.left) + parseFloat(nativeElement.style.width));

    expect(rightEdges).toEqual([140, 140]);
  });

  it('draws no border on a fitted frame, but keeps it on a frame at a width', async () => {
    const fixture = await render([FITTED, { ...FITTED, id: 'wide', width: 320, height: 200 }]);
    const [fitted, wide] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);

    expect(fitted?.hasAttribute('data-fitted')).toBe(true);
    expect(wide?.hasAttribute('data-fitted')).toBe(false);
  });

  it('draws the border of a frame above its content, and only where the frame has one', async () => {
    const fixture = await render([
      FITTED,
      { ...FITTED, id: 'wide', width: 320, height: 200 },
      { ...FITTED, id: 'empty', width: 320, height: 200, empty: 'Nothing here' },
    ]);
    const frames = () =>
      fixture.debugElement
        .queryAll(By.directive(CanvasFrameComponent))
        .map((frame) => frame.nativeElement as HTMLElement);
    const border = (frame: HTMLElement | undefined) => frame?.querySelector(':scope > [data-frame-border]');

    const [fitted, wide, empty] = frames();

    expect(border(fitted)).toBeNull();
    expect(border(empty)).toBeNull();
    expect(wide?.lastElementChild?.hasAttribute('data-frame-border')).toBe(true);
    expect(border(wide)?.classList).toContain('pointer-events-none');

    fixture.componentInstance.selectedId.set('default');
    await fixture.whenStable();

    expect(frames()[0]?.lastElementChild?.hasAttribute('data-frame-border')).toBe(true);
  });

  it('sets the text of an empty frame in its own line height, so wrapped lines stay apart at any zoom', async () => {
    const fixture = await render([{ ...FITTED, id: 'empty', width: 390, height: 120, empty: 'every page uses it' }]);
    const cell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-empty-cell]');

    expect(cell?.classList).toContain('leading-tight');
    expect(cell?.className).toContain('min(var(--et-design-canvas-label-scale),2)');
  });

  it('draws an outline over a frame at its offset in the frame', async () => {
    const fixture = await render([{ ...FITTED, id: 'wide', width: 320, height: 200 }]);

    fixture.componentRef.setInput('outlines', [
      { frameId: 'wide', x: 12, y: 34, width: 56, height: 78 },
      { frameId: 'gone', x: 0, y: 0, width: 1, height: 1 },
    ]);
    await fixture.whenStable();

    const frame = frameElement(fixture).nativeElement as HTMLElement;
    const outlines = [...fixture.nativeElement.querySelectorAll('[data-part-outline]')] as HTMLElement[];

    expect(outlines).toHaveLength(1);
    expect(parseFloat(outlines[0]?.style.left ?? '') - parseFloat(frame.style.left)).toBe(12);
    expect(parseFloat(outlines[0]?.style.top ?? '') - parseFloat(frame.style.top)).toBe(34);
    expect(outlines[0]?.style.width).toBe('56px');
    expect(outlines[0]?.style.height).toBe('78px');
  });

  describe('a frame in both colour schemes', () => {
    const PAGE: CanvasFrame = {
      id: 'page',
      src: 'about:blank',
      label: 'page',
      width: 390,
      height: 600,
      screenshot: 'http://localhost/__design/shot?part=home',
      schemes: ['light', 'dark'],
      place: { part: 'pages/home', state: 'default', size: 'phone' },
    };

    const copiesOf = (fixture: ComponentFixture<DesignCanvasComponent>) =>
      [...(frameElement(fixture).nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-scheme-copy]')].map(
        (copy) => ({
          scheme: copy.dataset['schemeCopy'],
          left: copy.style.left,
          top: copy.style.top,
          shot: copy.querySelector('img')?.getAttribute('src'),
        }),
      );

    const labelsOf = (fixture: ComponentFixture<DesignCanvasComponent>) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-scheme-label]')]
        .map((label) => [label.textContent?.trim(), label.style.left, label.style.top])
        .sort();

    it('draws a page in the light scheme, then the dark one beside it, each under its label', async () => {
      const fixture = await render([PAGE]);
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe(`${390 * 2 + SCHEME_GAP}px`);
      expect(host.style.height).toBe('600px');
      expect(copiesOf(fixture)).toEqual([
        { scheme: 'light', left: '', top: '', shot: 'http://localhost/__design/shot?part=home&scheme=light' },
        {
          scheme: 'dark',
          left: `${390 + SCHEME_GAP}px`,
          top: '0px',
          shot: 'http://localhost/__design/shot?part=home&scheme=dark',
        },
      ]);
      expect(labelsOf(fixture)).toEqual([
        ['Dark', `${390 + SCHEME_GAP}px`, '0px'],
        ['Light', '', ''],
      ]);
    });

    it('stacks the dark scheme below the light one when the two do not fit side by side', async () => {
      const fixture = await render([{ ...PAGE, width: SIDE_BY_SIDE_MAX_WIDTH + 1 }]);
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe(`${SIDE_BY_SIDE_MAX_WIDTH + 1}px`);
      expect(host.style.height).toBe(`${600 * 2 + SCHEME_GAP}px`);
      expect(copiesOf(fixture).map(({ scheme, left, top }) => [scheme, left, top])).toEqual([
        ['light', '', ''],
        ['dark', '0px', `${600 + SCHEME_GAP}px`],
      ]);
      expect(labelsOf(fixture)).toEqual([
        ['Dark', '0px', `${600 + SCHEME_GAP}px`],
        ['Light', '', ''],
      ]);
    });

    it('points pins, outlines and comment targets at the light scheme', async () => {
      const fixture = await render([PAGE]);

      fixture.componentRef.setInput('pins', [{ id: 'p', frameId: 'page', label: '1', text: 'one' }]);
      fixture.componentRef.setInput('outlines', [{ frameId: 'page', x: 12, y: 34, width: 56, height: 78 }]);
      fixture.componentRef.setInput('pointing', true);
      await fixture.whenStable();

      const host = frameElement(fixture).nativeElement as HTMLElement;
      const left = (element: Element | null) =>
        parseFloat((element as HTMLElement | null)?.style.left ?? '') - parseFloat(host.style.left);
      const target = fixture.nativeElement.querySelector('[data-comment-target]') as HTMLElement;

      expect(left(fixture.nativeElement.querySelector('[data-comment-pin]')?.parentElement)).toBe(390);
      expect(left(fixture.nativeElement.querySelector('[data-part-outline]'))).toBe(12);
      expect([target.style.width, target.style.height]).toEqual(['390px', '600px']);
    });

    it('draws a legacy call shot once, without schemes', async () => {
      const fixture = await render(
        callFramesOf({ port: 4402, call: LEGACY_CALL }).map((frame) => ({ ...frame, height: 600 })),
      );
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe('960px');
      expect(copiesOf(fixture)).toEqual([]);
      expect(labelsOf(fixture)).toEqual([]);
    });
  });

  it('goes live once the camera rests, on the frames nearest the centre, and keeps them for a while after', async () => {
    const frames = Array.from({ length: 12 }, (_, index) => ({
      ...FITTED,
      id: `f${index}`,
      label: `f${index}`,
      screenshot: `shot-${index}.png`,
      width: 40,
      height: 40,
    }));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const fixture = await render(frames);
    const canvas = fixture.componentInstance;
    const liveIds = () =>
      fixture.debugElement
        .queryAll(By.directive(CanvasFrameComponent))
        .filter((frame) => (frame.nativeElement as HTMLElement).getAttribute('data-live') === 'true')
        .map((frame) => (frame.componentInstance as CanvasFrameComponent).frame().id);

    const wait = async (ms: number) => {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
      TestBed.tick();
    };

    canvas.camera.set({ x: 0, y: 0, zoom: 0.5 });
    await wait(200);

    expect(liveIds()).toEqual([]);

    await wait(100);

    expect(liveIds()).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5']);

    canvas.camera.set({ x: 100000, y: 0, zoom: 0.5 });
    await wait(300);

    expect(liveIds()).toHaveLength(6);

    await wait(5000);

    expect(liveIds()).toEqual([]);
  });

  it('makes a double-clicked frame live, marks it, and ends it on Esc from the frame or on comment mode', async () => {
    const frames = [
      { ...FITTED, width: 320, height: 200 },
      { ...FITTED, id: 'other', width: 320, height: 200 },
    ];
    const fixture = await render(frames);
    const [first, second] = fixture.debugElement.queryAll(By.directive(CanvasFrameComponent));
    const isLive = (frame = first) => (frame?.nativeElement as HTMLElement).hasAttribute('data-active');

    first?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(isLive()).toBe(true);
    expect(first?.nativeElement.querySelector('[data-live-badge]')).not.toBeNull();

    second?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect([isLive(first), isLive(second)]).toEqual([false, true]);

    (second?.componentInstance as CanvasFrameComponent).escapeKeydown.emit();
    await fixture.whenStable();

    expect(isLive(second)).toBe(false);

    first?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    fixture.componentRef.setInput('pointing', true);
    await fixture.whenStable();

    expect(isLive()).toBe(false);
    expect(first?.nativeElement.querySelector('[data-live-badge]')).toBeNull();
  });

  it('draws the page of a live frame whose height follows its content in the viewport of a shot, clipped to the frame', async () => {
    const frames = [
      { id: 'followed', src: 'http://localhost:1/frame.html', label: 'followed', width: 320 },
      { id: 'sized', src: 'http://localhost:1/frame.html', label: 'sized', width: 390, height: 600 },
    ];
    const fixture = await render(frames);
    const [followed, sized] = fixture.debugElement.queryAll(By.directive(CanvasFrameComponent));

    followed?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    const iframeOf = (frame = followed) => (frame?.nativeElement as HTMLElement).querySelector('iframe');

    expect(iframeOf()?.style.minHeight).toBe('800px');
    expect(iframeOf()?.parentElement?.classList).toContain('overflow-hidden');

    sized?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(iframeOf(sized)?.style.minHeight).toBe('');
  });

  it('takes no height from the blank document a live iframe loads before its page', async () => {
    const fixture = await render([{ id: 'followed', src: 'about:blank', label: 'followed', width: 320 }]);
    const frame = frameElement(fixture);
    const heights: number[] = [];

    (frame.componentInstance as CanvasFrameComponent).heightChange.subscribe((height) => heights.push(height));
    frame.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(heights).toEqual([]);
  });

  it('emits the key of a column group whose switch is clicked, and shows whether it is on', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', column: 'a', width: 390, height: 844 }]);
    const switched: string[] = [];

    fixture.componentInstance.groupSwitch.subscribe((key) => switched.push(key));
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [
      { key: 'a', label: 'a', group: { key: 'round r1', label: 'r1', switch: { label: 'Changed area', on: true } } },
    ]);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-group-switch]');

    button?.click();

    expect(button?.textContent?.trim()).toBe('Changed area');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(switched).toEqual(['round r1']);
    expect(switched).not.toContain('r1');
  });

  it('draws a cropped frame as a small whole page with the crop outlined, above the crop enlarged twice', async () => {
    const crop = { areas: [{ x: 100, y: 200, width: 72, height: 54 }], frame: { width: 1440, height: 900 } };
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(CanvasFrameComponent);

    fixture.componentRef.setInput('frame', {
      id: 'a',
      src: 'about:blank',
      label: 'a',
      screenshot: 'shot.png',
      crop,
      width: 1440,
      height: 312,
    });
    fixture.componentRef.setInput('width', 1440);
    await fixture.whenStable();

    const frame = fixture.nativeElement as HTMLElement;
    const outline = frame.querySelector<HTMLElement>('[data-crop-outline]');
    const view = frame.querySelector<HTMLElement>('[data-crop-view]');

    expect(frame.querySelector<HTMLElement>('[data-crop-thumb]')?.style.width).toBe('288px');
    expect([outline?.style.left, outline?.style.top, outline?.style.width]).toEqual(['20px', '40px', '14.4px']);
    expect([view?.style.top, view?.style.width, view?.style.height]).toEqual(['204px', '144px', '108px']);
    expect((view?.firstElementChild as HTMLElement | null)?.style.transform).toBe('scale(2) translate(-100px, -200px)');
  });
  describe('on a cropped frame', () => {
    const crop = { areas: [{ x: 100, y: 200, width: 72, height: 54 }], frame: { width: 1440, height: 900 } };
    const cropped: CanvasFrame = {
      ...FITTED,
      id: 'a',
      width: 1440,
      height: 312,
      crop,
      place: { part: 'p', state: 'rest', size: 'fitted' },
    };

    it('places a pin and an outline through the crop, a pin outside it on the small whole page, and hides an outline outside it', async () => {
      const fixture = await render([cropped]);

      fixture.componentRef.setInput('pins', [
        { id: 'in', frameId: 'a', label: '1', text: 'in', point: { x: 110, y: 210 } },
        { id: 'out', frameId: 'a', label: '2', text: 'out', point: { x: 10, y: 10 } },
      ]);
      fixture.componentRef.setInput('outlines', [
        { frameId: 'a', x: 110, y: 210, width: 10, height: 5 },
        { frameId: 'a', x: 10, y: 10, width: 10, height: 5 },
      ]);
      await fixture.whenStable();

      const host = fixture.nativeElement as HTMLElement;
      const frame = frameElement(fixture).nativeElement as HTMLElement;
      const pins = [...host.querySelectorAll<HTMLElement>('[data-comment-pin]')];
      const outlines = [...host.querySelectorAll<HTMLElement>('[data-part-outline]')];
      const offset = (element: HTMLElement | undefined) => [
        parseFloat(element?.style.left ?? '') - parseFloat(frame.style.left),
        parseFloat(element?.style.top ?? '') - parseFloat(frame.style.top),
      ];

      expect(pins).toHaveLength(2);
      expect(outlines).toHaveLength(1);
      expect(offset(pins[0]?.parentElement ?? undefined)).toEqual([20, 224]);
      expect(offset(pins[1]?.parentElement ?? undefined)).toEqual([2, 2]);
      expect(offset(outlines[0])).toEqual([20, 224]);
      expect([outlines[0]?.style.width, outlines[0]?.style.height]).toEqual(['20px', '10px']);
    });

    it('stores the full-page point of a click on the crop', async () => {
      const fixture = await render([cropped]);
      const picks: FramePoint[] = [];

      fixture.componentInstance.pointPick.subscribe((pick) => picks.push(pick));
      fixture.componentRef.setInput('pointing', true);
      await fixture.whenStable();

      const target = fixture.debugElement.query(By.css('[data-comment-target]'));

      vi.spyOn(target.nativeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1440, 312));
      target.nativeElement.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 224 }));

      expect(picks).toEqual([{ frameId: 'a', point: { x: 110, y: 210 } }]);
    });

    it('stores the full-page point of a click on the small whole page above the crop', async () => {
      const fixture = await render([cropped]);
      const picks: FramePoint[] = [];

      fixture.componentInstance.pointPick.subscribe((pick) => picks.push(pick));
      fixture.componentRef.setInput('pointing', true);
      await fixture.whenStable();

      const target = fixture.debugElement.query(By.css('[data-comment-target]'));

      vi.spyOn(target.nativeElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1440, 312));
      target.nativeElement.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 60 }));

      expect(picks).toEqual([{ frameId: 'a', point: { x: 500, y: 300 } }]);
    });
  });

  it('selects the cell clicked in a grid frame, keeps it on a second click, and moves it to another cell', async () => {
    const cell = (id: string) => ({ id, row: 'filled', column: id, label: id, src: 'about:blank', width: 100 });
    const fixture = await render([
      {
        id: 'grid',
        src: '',
        label: 'grid',
        grid: { columns: ['a', 'b'], rows: ['filled'], cells: [cell('a'), cell('b')] },
      },
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const click = (id: string) =>
      host.querySelector(`[data-cell-id="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    click('a');
    expect([fixture.componentInstance.selectedId(), fixture.componentInstance.selectedCellId()]).toEqual(['grid', 'a']);

    click('a');
    expect(fixture.componentInstance.selectedCellId()).toBe('a');

    click('b');
    expect(fixture.componentInstance.selectedCellId()).toBe('b');

    fixture.componentInstance.selectedId.set(null);
    expect(fixture.componentInstance.selectedCellId()).toBeNull();
  });

  it('selects the cell under a click that lands on the shield over an inactive grid frame', async () => {
    const cell = (id: string) => ({ id, row: 'filled', column: id, label: id, src: 'about:blank', width: 100 });
    const fixture = await render([
      {
        id: 'grid',
        src: '',
        label: 'grid',
        grid: { columns: ['a', 'b'], rows: ['filled'], cells: [cell('a'), cell('b')] },
      },
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const frame = host.querySelector('ethlete-canvas-frame');
    const shield = [...(frame?.children ?? [])].find(
      (child) => child.className === 'absolute inset-0 size-full border-0',
    );
    const cellB = host.querySelector('[data-cell-id="b"]');

    expect(shield).toBeDefined();
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: (x: number) => (x >= 100 ? [shield, cellB, frame] : [shield, frame]),
    });

    try {
      shield?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 20 }));
    } finally {
      Reflect.deleteProperty(document, 'elementsFromPoint');
    }

    expect([fixture.componentInstance.selectedId(), fixture.componentInstance.selectedCellId()]).toEqual(['grid', 'b']);
  });
});
