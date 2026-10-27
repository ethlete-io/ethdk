import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { rememberedView } from '../../studio-view/remembered';
import { CanvasFrame } from './canvas-frame';
import { DesignCanvasComponent } from './design-canvas.component';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const FITTED: CanvasFrame = { id: 'default', src: 'about:blank', label: 'default', error: 'not drawn in jsdom' };

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
    expect(host.querySelector('[data-note-anchor="at"]')?.className).toContain('has-[[data-canvas-popover]]:z-4');
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

  it('lowers the next matrix row below the note column of a frame', async () => {
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
    ).toBe(16 + 200 + 48);
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
});
